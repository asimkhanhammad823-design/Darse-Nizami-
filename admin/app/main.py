from fastapi import FastAPI, File, Form, Request, UploadFile
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from starlette.middleware.sessions import SessionMiddleware

from .config import SESSION_SECRET
from .storage import upload_audio
from .worker_client import WorkerClient, WorkerError, login as worker_login

app = FastAPI(title="Dars-e-Nizami Admin")
app.add_middleware(SessionMiddleware, secret_key=SESSION_SECRET)
app.mount("/static", StaticFiles(directory="app/static"), name="static")
templates = Jinja2Templates(directory="app/templates")


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
    value = value.strip()
    if ":" in value:
        minutes, seconds = value.split(":", 1)
        return int(minutes) * 60 + int(seconds)
    return int(value)


def format_mmss(total_seconds: int) -> str:
    minutes, seconds = divmod(int(total_seconds), 60)
    return f"{minutes:02d}:{seconds:02d}"


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
    file_bytes = await audio_file.read()
    audio_key, duration_seconds = upload_audio(file_bytes, audio_file.filename)
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
    return RedirectResponse(url=f"/lectures/{lecture_id}?title={title}&book_id={book_id}", status_code=303)


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
    return RedirectResponse(url=f"/lectures/{lecture_id}?title={title}&book_id={book_id}", status_code=303)


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
    return RedirectResponse(url=f"/lectures/{lecture_id}?title={title}&book_id={book_id}", status_code=303)
