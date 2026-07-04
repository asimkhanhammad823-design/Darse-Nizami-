import type { Env } from "./index";

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

// ---- Daraja ----

async function createDaraja(request: Request, env: Env): Promise<Response> {
  const body = await parseBody<{ name?: string; sort_order?: number }>(request);
  if (!body?.name) return badRequest("name is required");
  const result = await env.DB.prepare(
    "INSERT INTO daraja (name, sort_order) VALUES (?, ?) RETURNING id, name, sort_order"
  )
    .bind(body.name, body.sort_order ?? 0)
    .first();
  return json(result, 201);
}

async function updateDaraja(request: Request, env: Env, id: string): Promise<Response> {
  const body = await parseBody<{ name?: string; sort_order?: number }>(request);
  if (!body) return badRequest("Invalid JSON body");
  const existing = await env.DB.prepare("SELECT id, name, sort_order FROM daraja WHERE id = ?")
    .bind(id)
    .first<{ id: number; name: string; sort_order: number }>();
  if (!existing) return notFound("Daraja not found");
  const name = body.name ?? existing.name;
  const sortOrder = body.sort_order ?? existing.sort_order;
  await env.DB.prepare("UPDATE daraja SET name = ?, sort_order = ? WHERE id = ?")
    .bind(name, sortOrder, id)
    .run();
  return json({ id: Number(id), name, sort_order: sortOrder });
}

async function deleteDaraja(env: Env, id: string): Promise<Response> {
  await env.DB.prepare("DELETE FROM daraja WHERE id = ?").bind(id).run();
  return json({ deleted: true });
}

// ---- Book ----

async function createBook(request: Request, env: Env): Promise<Response> {
  const body = await parseBody<{ daraja_id?: number; name?: string; sort_order?: number }>(request);
  if (!body?.daraja_id || !body?.name) return badRequest("daraja_id and name are required");
  const result = await env.DB.prepare(
    "INSERT INTO book (daraja_id, name, sort_order) VALUES (?, ?, ?) RETURNING id, daraja_id, name, sort_order"
  )
    .bind(body.daraja_id, body.name, body.sort_order ?? 0)
    .first();
  return json(result, 201);
}

async function updateBook(request: Request, env: Env, id: string): Promise<Response> {
  const body = await parseBody<{ name?: string; sort_order?: number; daraja_id?: number }>(request);
  if (!body) return badRequest("Invalid JSON body");
  const existing = await env.DB.prepare(
    "SELECT id, daraja_id, name, sort_order FROM book WHERE id = ?"
  )
    .bind(id)
    .first<{ id: number; daraja_id: number; name: string; sort_order: number }>();
  if (!existing) return notFound("Book not found");
  const name = body.name ?? existing.name;
  const sortOrder = body.sort_order ?? existing.sort_order;
  const darajaId = body.daraja_id ?? existing.daraja_id;
  await env.DB.prepare("UPDATE book SET name = ?, sort_order = ?, daraja_id = ? WHERE id = ?")
    .bind(name, sortOrder, darajaId, id)
    .run();
  return json({ id: Number(id), daraja_id: darajaId, name, sort_order: sortOrder });
}

async function deleteBook(env: Env, id: string): Promise<Response> {
  await env.DB.prepare("DELETE FROM book WHERE id = ?").bind(id).run();
  return json({ deleted: true });
}

// ---- Lecture ----

async function createLecture(request: Request, env: Env): Promise<Response> {
  const body = await parseBody<{
    book_id?: number;
    title?: string;
    audio_key?: string;
    duration_seconds?: number;
    sort_order?: number;
  }>(request);
  if (!body?.book_id || !body?.title || !body?.audio_key) {
    return badRequest("book_id, title and audio_key are required");
  }
  const result = await env.DB.prepare(
    `INSERT INTO lecture (book_id, title, audio_key, duration_seconds, sort_order)
     VALUES (?, ?, ?, ?, ?)
     RETURNING id, book_id, title, audio_key, duration_seconds, sort_order`
  )
    .bind(body.book_id, body.title, body.audio_key, body.duration_seconds ?? null, body.sort_order ?? 0)
    .first();
  return json(result, 201);
}

async function updateLecture(request: Request, env: Env, id: string): Promise<Response> {
  const body = await parseBody<{
    title?: string;
    audio_key?: string;
    duration_seconds?: number;
    sort_order?: number;
    book_id?: number;
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

  const title = body.title ?? existing.title;
  const audioKey = body.audio_key ?? existing.audio_key;
  const durationSeconds = body.duration_seconds ?? existing.duration_seconds;
  const sortOrder = body.sort_order ?? existing.sort_order;
  const bookId = body.book_id ?? existing.book_id;

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
}

async function deleteLecture(env: Env, id: string): Promise<Response> {
  await env.DB.prepare("DELETE FROM lecture WHERE id = ?").bind(id).run();
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
  const body = await parseBody<{ time_seconds?: number; page_number?: number }>(request);
  if (body?.time_seconds === undefined || body?.page_number === undefined) {
    return badRequest("time_seconds and page_number are required");
  }
  const result = await env.DB.prepare(
    `INSERT INTO page_marker (lecture_id, time_seconds, page_number)
     VALUES (?, ?, ?)
     RETURNING id, lecture_id, time_seconds, page_number`
  )
    .bind(lectureId, body.time_seconds, body.page_number)
    .first();
  return json(result, 201);
}

async function updateMarker(request: Request, env: Env, id: string): Promise<Response> {
  const body = await parseBody<{ time_seconds?: number; page_number?: number }>(request);
  if (!body) return badRequest("Invalid JSON body");
  const existing = await env.DB.prepare(
    "SELECT id, lecture_id, time_seconds, page_number FROM page_marker WHERE id = ?"
  )
    .bind(id)
    .first<{ id: number; lecture_id: number; time_seconds: number; page_number: number }>();
  if (!existing) return notFound("Marker not found");
  const timeSeconds = body.time_seconds ?? existing.time_seconds;
  const pageNumber = body.page_number ?? existing.page_number;
  await env.DB.prepare("UPDATE page_marker SET time_seconds = ?, page_number = ? WHERE id = ?")
    .bind(timeSeconds, pageNumber, id)
    .run();
  return json({ id: Number(id), lecture_id: existing.lecture_id, time_seconds: timeSeconds, page_number: pageNumber });
}

async function deleteMarker(env: Env, id: string): Promise<Response> {
  await env.DB.prepare("DELETE FROM page_marker WHERE id = ?").bind(id).run();
  return json({ deleted: true });
}

export async function handleAdminRoute(
  request: Request,
  env: Env,
  pathname: string
): Promise<Response | null> {
  const method = request.method;
  let m: RegExpMatchArray | null;

  if (method === "POST" && pathname === "/admin/darajas") return createDaraja(request, env);
  m = pathname.match(/^\/admin\/darajas\/(\d+)$/);
  if (m && method === "PUT") return updateDaraja(request, env, m[1]);
  if (m && method === "DELETE") return deleteDaraja(env, m[1]);

  if (method === "POST" && pathname === "/admin/books") return createBook(request, env);
  m = pathname.match(/^\/admin\/books\/(\d+)$/);
  if (m && method === "PUT") return updateBook(request, env, m[1]);
  if (m && method === "DELETE") return deleteBook(env, m[1]);

  if (method === "POST" && pathname === "/admin/lectures") return createLecture(request, env);
  m = pathname.match(/^\/admin\/lectures\/(\d+)$/);
  if (m && method === "GET") return getLectureAdmin(env, m[1]);
  if (m && method === "PUT") return updateLecture(request, env, m[1]);
  if (m && method === "DELETE") return deleteLecture(env, m[1]);

  m = pathname.match(/^\/admin\/lectures\/(\d+)\/markers$/);
  if (m && method === "POST") return createMarker(request, env, m[1]);

  m = pathname.match(/^\/admin\/markers\/(\d+)$/);
  if (m && method === "PUT") return updateMarker(request, env, m[1]);
  if (m && method === "DELETE") return deleteMarker(env, m[1]);

  return null;
}
