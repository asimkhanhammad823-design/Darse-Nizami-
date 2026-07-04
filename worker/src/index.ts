import { AwsClient } from "aws4fetch";
import { signJwt, verifyJwt, type JwtPayload } from "./jwt";

export interface Env {
  DB: D1Database;
  AUDIO_BUCKET: R2Bucket;
  JWT_SECRET: string;
  R2_ACCOUNT_ID: string;
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
}

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days
const STREAM_URL_TTL_SECONDS = 120;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function badRequest(message: string) {
  return json({ error: message }, 400);
}

function unauthorized(message = "Unauthorized") {
  return json({ error: message }, 401);
}

async function requireAuth(request: Request, env: Env): Promise<JwtPayload | null> {
  const authHeader = request.headers.get("authorization") || "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  return verifyJwt(match[1], env.JWT_SECRET);
}

async function handleLogin(request: Request, env: Env): Promise<Response> {
  let body: { access_code?: string };
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON body");
  }
  const accessCode = body.access_code?.trim();
  if (!accessCode) return badRequest("access_code is required");

  const user = await env.DB.prepare(
    "SELECT id, access_code, is_admin FROM app_user WHERE access_code = ?"
  )
    .bind(accessCode)
    .first<{ id: number; access_code: string; is_admin: number }>();

  if (!user) return unauthorized("Invalid access code");

  const payload: JwtPayload = {
    sub: user.id,
    access_code: user.access_code,
    is_admin: !!user.is_admin,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };
  const token = await signJwt(payload, env.JWT_SECRET);
  return json({ token, is_admin: !!user.is_admin });
}

async function handleDarajas(env: Env): Promise<Response> {
  const { results } = await env.DB.prepare(
    "SELECT id, name, sort_order FROM daraja ORDER BY sort_order ASC, id ASC"
  ).all();
  return json(results);
}

async function handleBooksForDaraja(env: Env, darajaId: string): Promise<Response> {
  const { results } = await env.DB.prepare(
    "SELECT id, daraja_id, name, sort_order FROM book WHERE daraja_id = ? ORDER BY sort_order ASC, id ASC"
  )
    .bind(darajaId)
    .all();
  return json(results);
}

async function handleLecturesForBook(env: Env, bookId: string): Promise<Response> {
  // audio_key is intentionally excluded from the response.
  const { results } = await env.DB.prepare(
    "SELECT id, book_id, title, duration_seconds, sort_order FROM lecture WHERE book_id = ? ORDER BY sort_order ASC, id ASC"
  )
    .bind(bookId)
    .all();
  return json(results);
}

async function handleMarkersForLecture(env: Env, lectureId: string): Promise<Response> {
  const { results } = await env.DB.prepare(
    "SELECT id, lecture_id, time_seconds, page_number FROM page_marker WHERE lecture_id = ? ORDER BY time_seconds ASC"
  )
    .bind(lectureId)
    .all();
  return json(results);
}

async function handleStreamUrl(env: Env, lectureId: string): Promise<Response> {
  const lecture = await env.DB.prepare("SELECT audio_key FROM lecture WHERE id = ?")
    .bind(lectureId)
    .first<{ audio_key: string }>();
  if (!lecture) return json({ error: "Lecture not found" }, 404);

  const client = new AwsClient({
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    service: "s3",
    region: "auto",
  });

  const endpoint = `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/dars-audio/${encodeURIComponent(
    lecture.audio_key
  )}`;

  const signedRequest = await client.sign(
    new Request(`${endpoint}?X-Amz-Expires=${STREAM_URL_TTL_SECONDS}`, { method: "GET" }),
    { aws: { signQuery: true } }
  );

  return json({ url: signedRequest.url, expires_in: STREAM_URL_TTL_SECONDS });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;
    const method = request.method;

    if (method === "POST" && pathname === "/login") {
      return handleLogin(request, env);
    }

    // Everything below requires a valid session token.
    const auth = await requireAuth(request, env);
    if (!auth) return unauthorized();

    if (method === "GET" && pathname === "/darajas") {
      return handleDarajas(env);
    }

    let m: RegExpMatchArray | null;

    m = pathname.match(/^\/darajas\/(\d+)\/books$/);
    if (method === "GET" && m) return handleBooksForDaraja(env, m[1]);

    m = pathname.match(/^\/books\/(\d+)\/lectures$/);
    if (method === "GET" && m) return handleLecturesForBook(env, m[1]);

    m = pathname.match(/^\/lectures\/(\d+)\/markers$/);
    if (method === "GET" && m) return handleMarkersForLecture(env, m[1]);

    m = pathname.match(/^\/lectures\/(\d+)\/stream-url$/);
    if (method === "GET" && m) return handleStreamUrl(env, m[1]);

    return json({ error: "Not found" }, 404);
  },
};
