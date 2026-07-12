from urllib.parse import quote

from fastapi import FastAPI, File, Form, Request, UploadFile
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from starlette.middleware.sessions import SessionMiddleware

from .config import SESSION_SECRET
from .storage import ALLOWED_EXTENSIONS, delete_audio, extension_of, upload_audio
from .worker_client import WorkerClient, WorkerError, login as worker_login

app = FastAPI(title="Dars-e-Nizami Admin")
app.add_middleware(SessionMiddleware, secret_key=SESSION_SECRET)
app.mount("/static", StaticFiles(directory="app/static"), name="static")
templates = Jinja2Templates(directory="app/templates")


class InputError(Exception):
    """A user-input problem that should be shown as a friendly error page."""

    def __init__(self, message: str):
        super().__init__(message)
        self.message = message


def get_client(request: Request) -> WorkerClient | None:
    token = request.session.get("token")
    if not token:
        return None
    return WorkerClient(token)


def require_login(request: Request):
    client = get_client(request)
    if client is None:
        return RedirectResponse(url="/login", status_code=303)
    return client


def parse_mmss(value: str) -> int:
    """Accepts 'mm:ss', 'h:mm:ss' or plain seconds. Raises InputError on junk."""
    value = value.strip()
    parts = value.split(":")
    if not (1 <= len(parts) <= 3) or not all(p.strip().isdigit() for p in parts):
        raise InputError(
            f"'{value}' is not a valid time. Use mm:ss (e.g. 12:30), h:mm:ss, or plain seconds."
        )
    numbers = [int(p) for p in parts]
    if len(numbers) > 1 and any(n > 59 for n in numbers[1:]):
        raise InputError(f"'{value}' is not a valid time: minutes/seconds parts must be 0-59.")
    total = 0
    for n in numbers:
        total = total * 60 + n
    return total


def format_mmss(total_seconds) -> str:
    if total_seconds is None:
        return "-"
    total_seconds = int(total_seconds)
    hours, remainder = divmod(total_seconds, 3600)
    minutes, seconds = divmod(remainder, 60)
    if hours:
        return f"{hours}:{minutes:02d}:{seconds:02d}"
    return f"{minutes:02d}:{seconds:02d}"


templates.env.filters["mmss"] = format_mmss


def lecture_url(lecture_id: int, title: str, book_id: int) -> str:
    return f"/lectures/{lecture_id}?title={quote(title)}&book_id={book_id}"


def error_page(request: Request, message: str, status_code: int = 400) -> HTMLResponse:
    back_url = request.headers.get("referer") or "/"
    return templates.TemplateResponse(
        "error.html",
        {"request": request, "message": message, "back_url": back_url},
        status_code=status_code,
    )


@app.exception_handler(WorkerError)
async def worker_error_handler(request: Request, exc: WorkerError):
    if exc.status_code == 401:
        # Token expired or revoked — send the admin back to the login page.
        request.session.clear()
        return RedirectResponse(url="/login", status_code=303)
    return error_page(request, exc.message, status_code=exc.status_code if exc.status_code >= 400 else 500)


@app.exception_handler(InputError)
async def input_error_handler(request: Request, exc: InputError):
    return error_page(request, exc.message)


@app.get("/login", response_class=HTMLResponse)
async def login_page(request: Request):
    return templates.TemplateResponse("login.html", {"request": request, "error": None})


@app.post("/login")
async def login_submit(request: Request, access_code: str = Form(...)):
    try:
        result = await worker_login(access_code)
    except WorkerError as exc:
        return templates.TemplateResponse(
            "login.html", {"request": request, "error": exc.message}
        )
    if not result.get("is_admin"):
        return templates.TemplateResponse(
            "login.html", {"request": request, "error": "This access code is not an admin account."}
        )
    request.session["token"] = result["token"]
    return RedirectResponse(url="/", status_code=303)


@app.get("/logout")
async def logout(request: Request):
    request.session.clear()
    return RedirectResponse(url="/login", status_code=303)


@app.get("/", response_class=HTMLResponse)
async def home(request: Request):
    client = require_login(request)
    if isinstance(client, RedirectResponse):
        return client
    darajas = await client.get("/darajas")
    return templates.TemplateResponse("home.html", {"request": request, "darajas": darajas})


@app.post("/darajas")
async def create_daraja(request: Request, name: str = Form(...), sort_order: int = Form(0)):
    client = require_login(request)
    if isinstance(client, RedirectResponse):
        return client
    await client.post("/admin/darajas", {"name": name, "sort_order": sort_order})
    return RedirectResponse(url="/", status_code=303)


@app.post("/darajas/{daraja_id}/update")
async def update_daraja(request: Request, daraja_id: int, name: str = Form(...), sort_order: int = Form(0)):
    client = require_login(request)
    if isinstance(client, RedirectResponse):
        return client
    await client.put(f"/admin/darajas/{daraja_id}", {"name": name, "sort_order": sort_order})
    return RedirectResponse(url="/", status_code=303)


@app.post("/darajas/{daraja_id}/delete")
async def delete_daraja(request: Request, daraja_id: int):
    client = require_login(request)
    if isinstance(client, RedirectResponse):
        return client
    await client.delete(f"/admin/darajas/{daraja_id}")
    return RedirectResponse(url="/", status_code=303)


@app.get("/darajas/{daraja_id}", response_class=HTMLResponse)
async def daraja_detail(request: Request, daraja_id: int, name: str = ""):
    client = require_login(request)
    if isinstance(client, RedirectResponse):
        return client
    books = await client.get(f"/darajas/{daraja_id}/books")
    return templates.TemplateResponse(
        "daraja.html",
        {"request": request, "daraja_id": daraja_id, "daraja_name": name, "books": books},
    )


@app.post("/darajas/{daraja_id}/books")
async def create_book(request: Request, daraja_id: int, name: str = Form(...), sort_order: int = Form(0)):
    client = require_login(request)
    if isinstance(client, RedirectResponse):
        return client
    await client.post("/admin/books", {"daraja_id": daraja_id, "name": name, "sort_order": sort_order})
    return RedirectResponse(url=f"/darajas/{daraja_id}", status_code=303)


@app.post("/books/{book_id}/update")
async def update_book(
    request: Request,
    book_id: int,
    name: str = Form(...),
    sort_order: int = Form(0),
    daraja_id: int = Form(...),
):
    client = require_login(request)
    if isinstance(client, RedirectResponse):
        return client
    await client.put(f"/admin/books/{book_id}", {"name": name, "sort_order": sort_order})
    return RedirectResponse(url=f"/darajas/{daraja_id}", status_code=303)


@app.post("/books/{book_id}/delete")
async def delete_book(request: Request, book_id: int, daraja_id: int = Form(...)):
    client = require_login(request)
    if isinstance(client, RedirectResponse):
        return client
    await client.delete(f"/admin/books/{book_id}")
    return RedirectResponse(url=f"/darajas/{daraja_id}", status_code=303)


@app.get("/books/{book_id}", response_class=HTMLResponse)
async def book_detail(request: Request, book_id: int, name: str = "", daraja_id: int = 0):
    client = require_login(request)
    if isinstance(client, RedirectResponse):
        return client
    lectures = await client.get(f"/books/{book_id}/lectures")
    return templates.TemplateResponse(
        "book.html",
        {
            "request": request,
            "book_id": book_id,
            "book_name": name,
            "daraja_id": daraja_id,
            "lectures": lectures,
        },
    )


@app.post("/books/{book_id}/lectures")
async def create_lecture(
    request: Request,
    book_id: int,
    title: str = Form(...),
    sort_order: int = Form(0),
    audio_file: UploadFile = File(...),
):
    client = require_login(request)
    if isinstance(client, RedirectResponse):
        return client

    filename = audio_file.filename or ""
    extension = extension_of(filename)
    if extension not in ALLOWED_EXTENSIONS:
        raise InputError(
            f"'{filename}' is not a supported audio file. "
            f"Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}."
        )
    file_bytes = await audio_file.read()
    if not file_bytes:
        raise InputError("The uploaded audio file is empty.")

    audio_key, duration_seconds = upload_audio(file_bytes, filename)
    try:
        await client.post(
            "/admin/lectures",
            {
                "book_id": book_id,
                "title": title,
                "audio_key": audio_key,
                "duration_seconds": duration_seconds,
                "sort_order": sort_order,
            },
        )
    except WorkerError:
        # Don't leave an orphaned object in the bucket if the DB insert failed.
        delete_audio(audio_key)
        raise
    return RedirectResponse(url=f"/books/{book_id}", status_code=303)


@app.post("/lectures/{lecture_id}/update")
async def update_lecture(
    request: Request,
    lecture_id: int,
    title: str = Form(...),
    sort_order: int = Form(0),
    book_id: int = Form(...),
):
    client = require_login(request)
    if isinstance(client, RedirectResponse):
        return client
    await client.put(f"/admin/lectures/{lecture_id}", {"title": title, "sort_order": sort_order})
    return RedirectResponse(url=f"/books/{book_id}", status_code=303)


@app.post("/lectures/{lecture_id}/delete")
async def delete_lecture(request: Request, lecture_id: int, book_id: int = Form(...)):
    client = require_login(request)
    if isinstance(client, RedirectResponse):
        return client
    await client.delete(f"/admin/lectures/{lecture_id}")
    return RedirectResponse(url=f"/books/{book_id}", status_code=303)


@app.get("/lectures/{lecture_id}", response_class=HTMLResponse)
async def lecture_detail(request: Request, lecture_id: int, title: str = "", book_id: int = 0):
    client = require_login(request)
    if isinstance(client, RedirectResponse):
        return client
    markers = await client.get(f"/lectures/{lecture_id}/markers")
    stream = await client.get(f"/lectures/{lecture_id}/stream-url")
    for marker in markers:
        marker["mmss"] = format_mmss(marker["time_seconds"])
    return templates.TemplateResponse(
        "lecture.html",
        {
            "request": request,
            "lecture_id": lecture_id,
            "lecture_title": title,
            "book_id": book_id,
            "markers": markers,
            "stream_url": stream["url"],
            "stream_expires_in": stream.get("expires_in", 600),
        },
    )


@app.post("/lectures/{lecture_id}/markers")
async def create_marker(
    request: Request,
    lecture_id: int,
    time_mmss: str = Form(...),
    page_number: int = Form(...),
    book_id: int = Form(0),
    title: str = Form(""),
):
    client = require_login(request)
    if isinstance(client, RedirectResponse):
        return client
    time_seconds = parse_mmss(time_mmss)
    await client.post(
        f"/admin/lectures/{lecture_id}/markers",
        {"time_seconds": time_seconds, "page_number": page_number},
    )
    return RedirectResponse(url=lecture_url(lecture_id, title, book_id), status_code=303)


@app.post("/markers/{marker_id}/update")
async def update_marker(
    request: Request,
    marker_id: int,
    time_mmss: str = Form(...),
    page_number: int = Form(...),
    lecture_id: int = Form(...),
    book_id: int = Form(0),
    title: str = Form(""),
):
    client = require_login(request)
    if isinstance(client, RedirectResponse):
        return client
    time_seconds = parse_mmss(time_mmss)
    await client.put(f"/admin/markers/{marker_id}", {"time_seconds": time_seconds, "page_number": page_number})
    return RedirectResponse(url=lecture_url(lecture_id, title, book_id), status_code=303)


@app.post("/markers/{marker_id}/delete")
async def delete_marker(
    request: Request,
    marker_id: int,
    lecture_id: int = Form(...),
    book_id: int = Form(0),
    title: str = Form(""),
):
    client = require_login(request)
    if isinstance(client, RedirectResponse):
        return client
    await client.delete(f"/admin/markers/{marker_id}")
    return RedirectResponse(url=lecture_url(lecture_id, title, book_id), status_code=303)


# ---- Users (student access codes) ----


@app.get("/users", response_class=HTMLResponse)
async def users_page(request: Request, new_code: str = ""):
    client = require_login(request)
    if isinstance(client, RedirectResponse):
        return client
    users = await client.get("/admin/users")
    return templates.TemplateResponse(
        "users.html",
        {"request": request, "users": users, "new_code": new_code},
    )


@app.post("/users")
async def create_user(
    request: Request,
    name: str = Form(""),
    access_code: str = Form(""),
    is_admin: str = Form(""),
):
    client = require_login(request)
    if isinstance(client, RedirectResponse):
        return client
    body: dict = {"is_admin": bool(is_admin)}
    if name.strip():
        body["name"] = name.strip()
    if access_code.strip():
        if len(access_code.strip()) < 6:
            raise InputError("Access code must be at least 6 characters (leave blank to auto-generate).")
        body["access_code"] = access_code.strip()
    created = await client.post("/admin/users", body)
    # Surface the (possibly auto-generated) code so it can be handed to the student.
    return RedirectResponse(url=f"/users?new_code={quote(created['access_code'])}", status_code=303)


@app.post("/users/{user_id}/update")
async def update_user(
    request: Request,
    user_id: int,
    name: str = Form(""),
    access_code: str = Form(...),
    is_admin: str = Form(""),
):
    client = require_login(request)
    if isinstance(client, RedirectResponse):
        return client
    if len(access_code.strip()) < 6:
        raise InputError("Access code must be at least 6 characters.")
    await client.put(
        f"/admin/users/{user_id}",
        {
            "name": name.strip() or None,
            "access_code": access_code.strip(),
            "is_admin": bool(is_admin),
        },
    )
    return RedirectResponse(url="/users", status_code=303)


@app.post("/users/{user_id}/delete")
async def delete_user(request: Request, user_id: int):
    client = require_login(request)
    if isinstance(client, RedirectResponse):
        return client
    await client.delete(f"/admin/users/{user_id}")
    return RedirectResponse(url="/users", status_code=303)
