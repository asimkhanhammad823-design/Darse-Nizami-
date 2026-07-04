# Dars-e-Nizami Admin Panel (Phase 2)

A small local tool (FastAPI + server-rendered HTML) you run on your own PC only
when adding content. It talks to the Cloudflare Worker (Phase 1) for all data,
and uploads audio directly to the private Backblaze B2 bucket.

No hosting cost: you run it with `uvicorn` on `localhost` and close it when done.

## 1. Prerequisites

- Python 3.10+
- The Phase 1 Worker already deployed (you have its URL, e.g.
  `https://dars-worker.<subdomain>.workers.dev`)
- Your Backblaze B2 keyID / applicationKey (same ones used for the Worker secrets)
- An admin user already inserted in D1 (`is_admin = 1`), e.g. the `ADMIN123`
  access code created during Phase 1 testing

## 2. Setup

```bash
cd admin
python -m venv venv

# Windows
venv\Scripts\activate
# macOS/Linux
source venv/bin/activate

pip install -r requirements.txt
```

## 3. Configure

```bash
cp .env.example .env
```

Edit `.env` and fill in:

- `WORKER_BASE_URL` — your deployed Worker URL
- `B2_KEY_ID`, `B2_APPLICATION_KEY`, `B2_ENDPOINT`, `B2_REGION`, `B2_BUCKET` — same as the Worker's B2 secrets
- `SESSION_SECRET` — any long random string (e.g. output of `openssl rand -hex 32`)

`.env` is git-ignored — never commit it.

## 4. Run

```bash
uvicorn app.main:app --reload --port 8000
```

Open http://localhost:8000 in your browser, log in with your admin access code.

## 5. Using the admin panel

1. **Darjas** — home page lets you create a Darja and lists existing ones.
2. **Books** — click a Darja to see/add its Books.
3. **Lectures** — click a Book to see/add its Lectures. Adding a lecture
   uploads the chosen audio file straight to the private B2 bucket and saves
   the resulting object key + detected duration on the lecture.
4. **Page markers** — click a Lecture to open the marker editor: an inline
   audio player (streamed via the same short-lived signed URL the app uses),
   a "Mark current time" button that grabs the player's current position,
   and a table of existing markers you can edit or delete.

Deleting a Darja/Book cascades to everything under it (enforced by the D1
foreign keys with `ON DELETE CASCADE`).

## Phase 2 test checklist

- [ ] Can log in with the admin access code; a non-admin code is rejected
- [ ] Can create a Darja → Book → Lecture (with real audio upload)
- [ ] The lecture's audio plays in the inline player on the marker-editor page
- [ ] Can add a marker by typing mm:ss and a page number
- [ ] Can add a marker with "Mark current time" while the player is playing
- [ ] Can edit and delete markers
- [ ] Can rename/reorder/delete Darjas, Books, and Lectures
