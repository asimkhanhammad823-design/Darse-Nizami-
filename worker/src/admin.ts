import type { Env } from "./index";
import type { JwtPayload } from "./jwt";
import { b2Client, deleteObjects, objectUrl } from "./b2";

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function badRequest(message: string) {
  return json({ error: message }, 400);
}

function notFound(message = "Not found") {
  return json({ error: message }, 404);
}

async function parseBody<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}

// ---- Validation helpers ----

function cleanName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= 200 ? trimmed : null;
}

function cleanInt(value: unknown, { min, max }: { min?: number; max?: number } = {}): number | null {
  if (typeof value !== "number" || !Number.isInteger(value)) return null;
  if (min !== undefined && value < min) return null;
  if (max !== undefined && value > max) return null;
  return value;
}

// D1 surfaces FOREIGN KEY / UNIQUE violations as thrown errors; translate
// them to a 400 with a readable message instead of a raw 500.
async function runOrConflict<T>(work: () => Promise<T>, conflictMessage: string): Promise<T | Response> {
  try {
    return await work();
  } catch (err) {
    const text = err instanceof Error ? err.message : String(err);
    if (/FOREIGN KEY|UNIQUE|constraint/i.test(text)) return badRequest(conflictMessage);
    throw err;
  }
}

// ---- Daraja ----

async function createDaraja(request: Request, env: Env): Promise<Response> {
  const body = await parseBody<{ name?: unknown; sort_order?: unknown }>(request);
  const name = cleanName(body?.name);
  if (!name) return badRequest("name is required");
  const sortOrder = cleanInt(body?.sort_order) ?? 0;
  const result = await env.DB.prepare(
    "INSERT INTO daraja (name, sort_order) VALUES (?, ?) RETURNING id, name, sort_order"
  )
    .bind(name, sortOrder)
    .first();
  return json(result, 201);
}

async function updateDaraja(request: Request, env: Env, id: string): Promise<Response> {
  const body = await parseBody<{ name?: unknown; sort_order?: unknown }>(request);
  if (!body) return badRequest("Invalid JSON body");
  const existing = await env.DB.prepare("SELECT id, name, sort_order FROM daraja WHERE id = ?")
    .bind(id)
    .first<{ id: number; name: string; sort_order: number }>();
  if (!existing) return notFound("Daraja not found");
  const name = body.name !== undefined ? cleanName(body.name) : existing.name;
  if (!name) return badRequest("name must be a non-empty string");
  const sortOrder = body.sort_order !== undefined ? cleanInt(body.sort_order) : existing.sort_order;
  if (sortOrder === null) return badRequest("sort_order must be an integer");
  await env.DB.prepare("UPDATE daraja SET name = ?, sort_order = ? WHERE id = ?")
    .bind(name, sortOrder, id)
    .run();
  return json({ id: Number(id), name, sort_order: sortOrder });
}

async function deleteDaraja(env: Env, ctx: ExecutionContext, id: string): Promise<Response> {
  // Collect audio keys before the cascade wipes the lecture rows.
  const { results } = await env.DB.prepare(
    `SELECT lecture.audio_key AS audio_key FROM lecture
     JOIN book ON book.id = lecture.book_id
     WHERE book.daraja_id = ?`
  )
    .bind(id)
    .all<{ audio_key: string }>();
  await env.DB.prepare("DELETE FROM daraja WHERE id = ?").bind(id).run();
  ctx.waitUntil(deleteObjects(env, results.map((r) => r.audio_key)));
  return json({ deleted: true });
}

// ---- Book ----

async function createBook(request: Request, env: Env): Promise<Response> {
  const body = await parseBody<{ daraja_id?: unknown; name?: unknown; sort_order?: unknown }>(request);
  const name = cleanName(body?.name);
  const darajaId = cleanInt(body?.daraja_id, { min: 1 });
  if (!darajaId || !name) return badRequest("daraja_id and name are required");
  const sortOrder = cleanInt(body?.sort_order) ?? 0;
  return runOrConflict(
    async () =>
      json(
        await env.DB.prepare(
          "INSERT INTO book (daraja_id, name, sort_order) VALUES (?, ?, ?) RETURNING id, daraja_id, name, sort_order"
        )
          .bind(darajaId, name, sortOrder)
          .first(),
        201
      ),
    "daraja_id does not refer to an existing daraja"
  ) as Promise<Response>;
}

async function updateBook(request: Request, env: Env, id: string): Promise<Response> {
  const body = await parseBody<{ name?: unknown; sort_order?: unknown; daraja_id?: unknown }>(request);
  if (!body) return badRequest("Invalid JSON body");
  const existing = await env.DB.prepare(
    "SELECT id, daraja_id, name, sort_order FROM book WHERE id = ?"
  )
    .bind(id)
    .first<{ id: number; daraja_id: number; name: string; sort_order: number }>();
  if (!existing) return notFound("Book not found");
  const name = body.name !== undefined ? cleanName(body.name) : existing.name;
  if (!name) return badRequest("name must be a non-empty string");
  const sortOrder = body.sort_order !== undefined ? cleanInt(body.sort_order) : existing.sort_order;
  if (sortOrder === null) return badRequest("sort_order must be an integer");
  const darajaId = body.daraja_id !== undefined ? cleanInt(body.daraja_id, { min: 1 }) : existing.daraja_id;
  if (darajaId === null) return badRequest("daraja_id must be a positive integer");
  return runOrConflict(async () => {
    await env.DB.prepare("UPDATE book SET name = ?, sort_order = ?, daraja_id = ? WHERE id = ?")
      .bind(name, sortOrder, darajaId, id)
      .run();
    return json({ id: Number(id), daraja_id: darajaId, name, sort_order: sortOrder });
  }, "daraja_id does not refer to an existing daraja") as Promise<Response>;
}

async function deleteBook(env: Env, ctx: ExecutionContext, id: string): Promise<Response> {
  const { results } = await env.DB.prepare("SELECT audio_key FROM lecture WHERE book_id = ?")
    .bind(id)
    .all<{ audio_key: string }>();
  await env.DB.prepare("DELETE FROM book WHERE id = ?").bind(id).run();
  ctx.waitUntil(deleteObjects(env, results.map((r) => r.audio_key)));
  return json({ deleted: true });
}

// ---- Lecture ----

async function createLecture(request: Request, env: Env): Promise<Response> {
  const body = await parseBody<{
    book_id?: unknown;
    title?: unknown;
    audio_key?: unknown;
    duration_seconds?: unknown;
    sort_order?: unknown;
  }>(request);
  const bookId = cleanInt(body?.book_id, { min: 1 });
  const title = cleanName(body?.title);
  const audioKey = typeof body?.audio_key === "string" && body.audio_key.trim() ? body.audio_key.trim() : null;
  if (!bookId || !title || !audioKey) {
    return badRequest("book_id, title and audio_key are required");
  }
  const durationSeconds =
    body?.duration_seconds === undefined || body?.duration_seconds === null
      ? null
      : cleanInt(body.duration_seconds, { min: 0 });
  const sortOrder = cleanInt(body?.sort_order) ?? 0;
  return runOrConflict(
    async () =>
      json(
        await env.DB.prepare(
          `INSERT INTO lecture (book_id, title, audio_key, duration_seconds, sort_order)
           VALUES (?, ?, ?, ?, ?)
           RETURNING id, book_id, title, audio_key, duration_seconds, sort_order`
        )
          .bind(bookId, title, audioKey, durationSeconds, sortOrder)
          .first(),
        201
      ),
    "book_id does not refer to an existing book"
  ) as Promise<Response>;
}

async function updateLecture(request: Request, env: Env, id: string): Promise<Response> {
  const body = await parseBody<{
    title?: unknown;
    audio_key?: unknown;
    duration_seconds?: unknown;
    sort_order?: unknown;
    book_id?: unknown;
  }>(request);
  if (!body) return badRequest("Invalid JSON body");
  const existing = await env.DB.prepare(
    "SELECT id, book_id, title, audio_key, duration_seconds, sort_order FROM lecture WHERE id = ?"
  )
    .bind(id)
    .first<{
      id: number;
      book_id: number;
      title: string;
      audio_key: string;
      duration_seconds: number | null;
      sort_order: number;
    }>();
  if (!existing) return notFound("Lecture not found");

  const title = body.title !== undefined ? cleanName(body.title) : existing.title;
  if (!title) return badRequest("title must be a non-empty string");
  const audioKey =
    body.audio_key !== undefined
      ? typeof body.audio_key === "string" && body.audio_key.trim()
        ? body.audio_key.trim()
        : null
      : existing.audio_key;
  if (!audioKey) return badRequest("audio_key must be a non-empty string");
  const durationSeconds =
    body.duration_seconds !== undefined ? cleanInt(body.duration_seconds, { min: 0 }) : existing.duration_seconds;
  const sortOrder = body.sort_order !== undefined ? cleanInt(body.sort_order) : existing.sort_order;
  if (sortOrder === null) return badRequest("sort_order must be an integer");
  const bookId = body.book_id !== undefined ? cleanInt(body.book_id, { min: 1 }) : existing.book_id;
  if (bookId === null) return badRequest("book_id must be a positive integer");

  return runOrConflict(async () => {
    await env.DB.prepare(
      "UPDATE lecture SET title = ?, audio_key = ?, duration_seconds = ?, sort_order = ?, book_id = ? WHERE id = ?"
    )
      .bind(title, audioKey, durationSeconds, sortOrder, bookId, id)
      .run();
    return json({
      id: Number(id),
      book_id: bookId,
      title,
      audio_key: audioKey,
      duration_seconds: durationSeconds,
      sort_order: sortOrder,
    });
  }, "book_id does not refer to an existing book") as Promise<Response>;
}

async function deleteLecture(env: Env, ctx: ExecutionContext, id: string): Promise<Response> {
  const lecture = await env.DB.prepare("SELECT audio_key FROM lecture WHERE id = ?")
    .bind(id)
    .first<{ audio_key: string }>();
  await env.DB.prepare("DELETE FROM lecture WHERE id = ?").bind(id).run();
  if (lecture) ctx.waitUntil(deleteObjects(env, [lecture.audio_key]));
  return json({ deleted: true });
}

async function getLectureAdmin(env: Env, id: string): Promise<Response> {
  const lecture = await env.DB.prepare(
    "SELECT id, book_id, title, audio_key, duration_seconds, sort_order FROM lecture WHERE id = ?"
  )
    .bind(id)
    .first();
  if (!lecture) return notFound("Lecture not found");
  return json(lecture);
}

// ---- Page markers ----

async function createMarker(request: Request, env: Env, lectureId: string): Promise<Response> {
  const body = await parseBody<{ time_seconds?: unknown; page_number?: unknown }>(request);
  const timeSeconds = cleanInt(body?.time_seconds, { min: 0 });
  const pageNumber = cleanInt(body?.page_number, { min: 1 });
  if (timeSeconds === null || pageNumber === null) {
    return badRequest("time_seconds (>= 0) and page_number (>= 1) are required");
  }
  return runOrConflict(
    async () =>
      json(
        await env.DB.prepare(
          `INSERT INTO page_marker (lecture_id, time_seconds, page_number)
           VALUES (?, ?, ?)
           RETURNING id, lecture_id, time_seconds, page_number`
        )
          .bind(lectureId, timeSeconds, pageNumber)
          .first(),
        201
      ),
    "lecture does not exist"
  ) as Promise<Response>;
}

async function updateMarker(request: Request, env: Env, id: string): Promise<Response> {
  const body = await parseBody<{ time_seconds?: unknown; page_number?: unknown }>(request);
  if (!body) return badRequest("Invalid JSON body");
  const existing = await env.DB.prepare(
    "SELECT id, lecture_id, time_seconds, page_number FROM page_marker WHERE id = ?"
  )
    .bind(id)
    .first<{ id: number; lecture_id: number; time_seconds: number; page_number: number }>();
  if (!existing) return notFound("Marker not found");
  const timeSeconds = body.time_seconds !== undefined ? cleanInt(body.time_seconds, { min: 0 }) : existing.time_seconds;
  if (timeSeconds === null) return badRequest("time_seconds must be an integer >= 0");
  const pageNumber = body.page_number !== undefined ? cleanInt(body.page_number, { min: 1 }) : existing.page_number;
  if (pageNumber === null) return badRequest("page_number must be an integer >= 1");
  await env.DB.prepare("UPDATE page_marker SET time_seconds = ?, page_number = ? WHERE id = ?")
    .bind(timeSeconds, pageNumber, id)
    .run();
  return json({ id: Number(id), lecture_id: existing.lecture_id, time_seconds: timeSeconds, page_number: pageNumber });
}

async function deleteMarker(env: Env, id: string): Promise<Response> {
  await env.DB.prepare("DELETE FROM page_marker WHERE id = ?").bind(id).run();
  return json({ deleted: true });
}

// ---- Audio upload (streamed through the Worker into the private bucket) ----

const AUDIO_CONTENT_TYPES: Record<string, string> = {
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  aac: "audio/aac",
  ogg: "audio/ogg",
  opus: "audio/opus",
  wav: "audio/wav",
  flac: "audio/flac",
};

async function uploadAudio(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const filename = url.searchParams.get("filename") || "";
  const ext = filename.includes(".") ? filename.split(".").pop()!.toLowerCase() : "";
  const contentType = AUDIO_CONTENT_TYPES[ext];
  if (!contentType) {
    return badRequest(
      `Unsupported audio file. Allowed extensions: ${Object.keys(AUDIO_CONTENT_TYPES).join(", ")}`
    );
  }
  const contentLength = request.headers.get("content-length");
  const size = Number(contentLength);
  if (!contentLength || !Number.isFinite(size) || size <= 0) {
    return badRequest("The uploaded file is empty or its size is unknown");
  }
  const MAX_UPLOAD_BYTES = 500 * 1024 * 1024; // 500 MB per file
  if (size > MAX_UPLOAD_BYTES) {
    return json({ error: "File too large (max 500 MB). Please split the lecture into parts." }, 413);
  }
  if (!request.body) return badRequest("Missing request body");

  const key = `audio/lec_${Math.floor(Date.now() / 1000)}_${crypto.randomUUID().slice(0, 8)}.${ext}`;

  // Stream the incoming body straight to B2 without buffering it in memory.
  // UNSIGNED-PAYLOAD lets aws4fetch sign the request without hashing the body.
  // `duplex: "half"` is REQUIRED by the runtime whenever the request body is
  // a stream (without it, constructing the Request throws); the explicit
  // content-length keeps the upload fixed-length so the SigV4 signature that
  // covers it matches what B2 receives.
  const signed = await b2Client(env).sign(
    new Request(objectUrl(env, key), {
      method: "PUT",
      headers: {
        "content-length": contentLength,
        "content-type": contentType,
        "x-amz-content-sha256": "UNSIGNED-PAYLOAD",
      },
      body: request.body,
      duplex: "half",
    } as RequestInit & { duplex: "half" })
  );
  const b2Response = await fetch(signed);
  if (!b2Response.ok) {
    return json({ error: `Storage upload failed (${b2Response.status})` }, 502);
  }
  return json({ audio_key: key }, 201);
}

// ---- Users (student access codes) ----

// Unambiguous alphabet (no 0/O, 1/I/L) so codes are easy to read out loud.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function generateAccessCode(length = 8): string {
  // Rejection sampling to avoid modulo bias: 248 = floor(256/31)*31, so bytes
  // >= 248 are discarded, keeping every code character equally likely.
  const n = CODE_ALPHABET.length;
  const limit = Math.floor(256 / n) * n;
  let code = "";
  while (code.length < length) {
    const buf = new Uint8Array(length);
    crypto.getRandomValues(buf);
    for (const b of buf) {
      if (b < limit) {
        code += CODE_ALPHABET[b % n];
        if (code.length === length) break;
      }
    }
  }
  return code;
}

async function listUsers(env: Env): Promise<Response> {
  const { results } = await env.DB.prepare(
    "SELECT id, access_code, name, is_admin FROM app_user ORDER BY id ASC"
  ).all();
  return json(results);
}

async function createUser(request: Request, env: Env): Promise<Response> {
  const body = await parseBody<{ name?: unknown; access_code?: unknown; is_admin?: unknown }>(request);
  const name = body?.name === undefined || body?.name === null ? null : cleanName(body.name);
  if (body?.name !== undefined && body?.name !== null && body?.name !== "" && name === null) {
    return badRequest("name must be a string");
  }
  let accessCode: string;
  if (body?.access_code !== undefined && body?.access_code !== null && body?.access_code !== "") {
    if (typeof body.access_code !== "string" || body.access_code.trim().length < 6) {
      return badRequest("access_code must be at least 6 characters");
    }
    accessCode = body.access_code.trim();
  } else {
    accessCode = generateAccessCode();
  }
  const isAdmin = body?.is_admin ? 1 : 0;
  return runOrConflict(
    async () =>
      json(
        await env.DB.prepare(
          "INSERT INTO app_user (access_code, name, is_admin) VALUES (?, ?, ?) RETURNING id, access_code, name, is_admin"
        )
          .bind(accessCode, name, isAdmin)
          .first(),
        201
      ),
    "That access code is already in use"
  ) as Promise<Response>;
}

async function updateUser(request: Request, env: Env, id: string, auth: JwtPayload): Promise<Response> {
  const body = await parseBody<{ name?: unknown; access_code?: unknown; is_admin?: unknown }>(request);
  if (!body) return badRequest("Invalid JSON body");
  const existing = await env.DB.prepare(
    "SELECT id, access_code, name, is_admin FROM app_user WHERE id = ?"
  )
    .bind(id)
    .first<{ id: number; access_code: string; name: string | null; is_admin: number }>();
  if (!existing) return notFound("User not found");
  const name = body.name !== undefined ? (body.name === null || body.name === "" ? null : cleanName(body.name)) : existing.name;
  let accessCode = existing.access_code;
  if (body.access_code !== undefined) {
    if (typeof body.access_code !== "string" || body.access_code.trim().length < 6) {
      return badRequest("access_code must be at least 6 characters");
    }
    accessCode = body.access_code.trim();
  }
  const isAdmin = body.is_admin !== undefined ? (body.is_admin ? 1 : 0) : existing.is_admin;
  // Don't let an admin remove their own admin rights and lock themselves out.
  if (Number(id) === auth.sub && isAdmin === 0) {
    return badRequest("You cannot remove admin rights from the account you are logged in with");
  }
  return runOrConflict(async () => {
    await env.DB.prepare("UPDATE app_user SET access_code = ?, name = ?, is_admin = ? WHERE id = ?")
      .bind(accessCode, name, isAdmin, id)
      .run();
    return json({ id: Number(id), access_code: accessCode, name, is_admin: isAdmin });
  }, "That access code is already in use") as Promise<Response>;
}

async function deleteUser(env: Env, id: string, auth: JwtPayload): Promise<Response> {
  if (Number(id) === auth.sub) {
    return badRequest("You cannot delete the account you are logged in with");
  }
  await env.DB.prepare("DELETE FROM app_user WHERE id = ?").bind(id).run();
  return json({ deleted: true });
}

export async function handleAdminRoute(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  pathname: string,
  auth: JwtPayload
): Promise<Response | null> {
  const method = request.method;
  let m: RegExpMatchArray | null;

  if (method === "POST" && pathname === "/admin/darajas") return createDaraja(request, env);
  m = pathname.match(/^\/admin\/darajas\/(\d+)$/);
  if (m && method === "PUT") return updateDaraja(request, env, m[1]);
  if (m && method === "DELETE") return deleteDaraja(env, ctx, m[1]);

  if (method === "POST" && pathname === "/admin/books") return createBook(request, env);
  m = pathname.match(/^\/admin\/books\/(\d+)$/);
  if (m && method === "PUT") return updateBook(request, env, m[1]);
  if (m && method === "DELETE") return deleteBook(env, ctx, m[1]);

  if (method === "POST" && pathname === "/admin/lectures") return createLecture(request, env);
  m = pathname.match(/^\/admin\/lectures\/(\d+)$/);
  if (m && method === "GET") return getLectureAdmin(env, m[1]);
  if (m && method === "PUT") return updateLecture(request, env, m[1]);
  if (m && method === "DELETE") return deleteLecture(env, ctx, m[1]);

  m = pathname.match(/^\/admin\/lectures\/(\d+)\/markers$/);
  if (m && method === "POST") return createMarker(request, env, m[1]);

  m = pathname.match(/^\/admin\/markers\/(\d+)$/);
  if (m && method === "PUT") return updateMarker(request, env, m[1]);
  if (m && method === "DELETE") return deleteMarker(env, m[1]);

  if (method === "POST" && pathname === "/admin/upload") return uploadAudio(request, env);

  if (method === "GET" && pathname === "/admin/users") return listUsers(env);
  if (method === "POST" && pathname === "/admin/users") return createUser(request, env);
  m = pathname.match(/^\/admin\/users\/(\d+)$/);
  if (m && method === "PUT") return updateUser(request, env, m[1], auth);
  if (m && method === "DELETE") return deleteUser(env, m[1], auth);

  return null;
}
