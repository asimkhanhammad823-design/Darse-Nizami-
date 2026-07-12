import { signJwt, verifyJwt, type JwtPayload } from "./jwt";
import { handleAdminRoute } from "./admin";
import { signStreamUrl } from "./b2";
import { PANEL_HTML } from "./panel";

export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
  B2_ENDPOINT: string;
  B2_REGION: string;
  B2_BUCKET: string;
  B2_KEY_ID: string;
  B2_APPLICATION_KEY: string;
}

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days
const STREAM_URL_TTL_SECONDS = 600; // long enough to survive brief pauses; refreshed by the app on failure

const CORS_HEADERS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, PUT, DELETE, OPTIONS",
  "access-control-allow-headers": "authorization, content-type",
  "access-control-max-age": "86400",
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", ...CORS_HEADERS },
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
  const accessCode = typeof body.access_code === "string" ? body.access_code.trim() : "";
  if (!accessCode) return badRequest("access_code is required");

  const user = await env.DB.prepare(
    "SELECT id, access_code, name, is_admin FROM app_user WHERE access_code = ?"
  )
    .bind(accessCode)
    .first<{ id: number; access_code: string; name: string | null; is_admin: number }>();

  if (!user) return unauthorized("Invalid access code");

  const payload: JwtPayload = {
    sub: user.id,
    access_code: user.access_code,
    is_admin: !!user.is_admin,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };
  const token = await signJwt(payload, env.JWT_SECRET);
  return json({ token, is_admin: !!user.is_admin, name: user.name });
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

  const url = await signStreamUrl(env, lecture.audio_key, STREAM_URL_TTL_SECONDS);
  return json({ url, expires_in: STREAM_URL_TTL_SECONDS });
}

async function route(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(request.url);
  const { pathname } = url;
  const method = request.method;

  if (method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (method === "GET" && pathname === "/health") {
    return json({ ok: true });
  }

  // The hosted admin panel. Serving the page needs no auth — every data
  // call it makes goes through the normal admin-token checks below.
  if (method === "GET" && (pathname === "/panel" || pathname === "/panel/")) {
    return new Response(PANEL_HTML, {
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }

  if (method === "POST" && pathname === "/login") {
    return handleLogin(request, env);
  }

  // Everything below requires a valid session token.
  const auth = await requireAuth(request, env);
  if (!auth) return unauthorized();

  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    if (!auth.is_admin) return json({ error: "Admin access required" }, 403);
    const adminResponse = await handleAdminRoute(request, env, ctx, pathname, auth);
    if (adminResponse) return withCors(adminResponse);
    return json({ error: "Not found" }, 404);
  }

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
}

function withCors(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [k, v] of Object.entries(CORS_HEADERS)) headers.set(k, v);
  return new Response(response.body, { status: response.status, headers });
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      return await route(request, env, ctx);
    } catch (err) {
      // Never leak a raw stack trace to clients; log it for `wrangler tail`.
      console.error("Unhandled error:", err);
      return json({ error: "Internal server error" }, 500);
    }
  },
};
