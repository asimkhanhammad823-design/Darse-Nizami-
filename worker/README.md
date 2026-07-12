# Dars-e-Nizami Worker (Phase 1: Cloudflare Backend)

Serverless API: Cloudflare Workers + D1 (database) + Backblaze B2 (private
audio storage, S3-compatible). 100% free tier, no VPS.

> Note: the original plan used Cloudflare R2 for audio storage, but R2 requires
> adding a billing card to the Cloudflare account (even on the free tier) to
> enable it. Backblaze B2 gives the same private-bucket + signed-URL model
> without that requirement, so it's used instead. The only difference is B2's
> free egress is capped at ~3x your stored data per month (still effectively
> free at this project's scale) rather than R2's unlimited free egress.

## 0. Prerequisites

- Node.js 18+ installed
- A free Cloudflare account (https://dash.cloudflare.com/sign-up)

## 1. Install dependencies

```bash
cd worker
npm install
```

## 2. Log in to Cloudflare via wrangler

```bash
npx wrangler login
```

This opens a browser window to authorize the CLI against your Cloudflare account.

## 3. Create the D1 database

```bash
npx wrangler d1 create dars_db
```

This prints a `database_id`. Copy it into `wrangler.toml` under
`[[d1_databases]] database_id = "..."`.

## 4. Apply the schema (migration)

```bash
# local (for `wrangler dev` testing)
npm run db:migrate:local

# remote (real Cloudflare D1, used in production)
npm run db:migrate:remote
```

## 5. Create a Backblaze B2 account + private bucket

1. Sign up free at https://www.backblaze.com/b2/sign-up.html (no card required
   for the free 10GB tier).
2. In the B2 dashboard, create a **Private** bucket (e.g. `dars-audio`).
3. Under **App Keys**, create a new Application Key scoped to just that bucket
   (Read and Write). Note down: **keyID**, **applicationKey**, and the
   bucket's S3-compatible **Endpoint** (e.g. `s3.us-east-005.backblazeb2.com`).
4. Put the non-secret values (endpoint, region, bucket name) into
   `wrangler.toml` under `[vars]` — these are already filled in for this
   project's bucket.

## 6. Set secrets (never put these in code or wrangler.toml)

```bash
npx wrangler secret put JWT_SECRET
# paste a long random string, e.g. output of: openssl rand -hex 32

npx wrangler secret put B2_KEY_ID
# paste your Backblaze application keyID

npx wrangler secret put B2_APPLICATION_KEY
# paste your Backblaze applicationKey
```

## 8. Create your first admin user (one manual step)

Only the very first admin needs manual SQL — after that, all users
(students and additional admins) are managed from the admin panel's
**Users** page:

```bash
npx wrangler d1 execute dars_db --remote --command "INSERT INTO app_user (access_code, name, is_admin) VALUES ('ADMIN123', 'Admin', 1);"
npx wrangler d1 execute dars_db --remote --command "INSERT INTO daraja (name, sort_order) VALUES ('Darja Awwal', 1);"
```

(Adding a lecture also requires an `audio_key` pointing at a real object already
uploaded to the `dars-audio` B2 bucket — you can upload one manually via the
Backblaze B2 dashboard's file browser for this early test.)

## 9. Run locally

```bash
npm run dev
```

Test:

```bash
curl -X POST http://localhost:8787/login -H "content-type: application/json" \
  -d '{"access_code":"ADMIN123"}'
# => {"token":"...", "is_admin": true}

curl http://localhost:8787/darajas -H "authorization: Bearer <token>"
```

## 10. Deploy to Cloudflare (free tier, always-on, no VPS)

```bash
npm run deploy
```

Wrangler prints your live URL, e.g. `https://dars-worker.<your-subdomain>.workers.dev`.

## API summary

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/health` | none | `{ok: true}` — quick deploy check |
| POST | `/login` | none | body `{access_code}` → `{token, is_admin, name}` |
| GET | `/darajas` | Bearer token | list of darajas |
| GET | `/darajas/:id/books` | Bearer token | books in a darja |
| GET | `/books/:id/lectures` | Bearer token | lectures (no `audio_key`) |
| GET | `/lectures/:id/markers` | Bearer token | page markers, sorted |
| GET | `/lectures/:id/stream-url` | Bearer token | `{url, expires_in:600}` signed B2 URL |

Admin endpoints (require a token whose user has `is_admin = 1`):

| Method | Path | Notes |
|---|---|---|
| POST | `/admin/darajas` | `{name, sort_order?}` |
| PUT / DELETE | `/admin/darajas/:id` | delete cascades and removes B2 audio |
| POST | `/admin/books` | `{daraja_id, name, sort_order?}` |
| PUT / DELETE | `/admin/books/:id` | delete cascades and removes B2 audio |
| POST | `/admin/lectures` | `{book_id, title, audio_key, duration_seconds?, sort_order?}` |
| GET / PUT / DELETE | `/admin/lectures/:id` | delete also removes the B2 audio object |
| POST | `/admin/lectures/:id/markers` | `{time_seconds, page_number}` |
| PUT / DELETE | `/admin/markers/:id` | |
| GET / POST | `/admin/users` | create body `{name?, access_code?, is_admin?}` — omit `access_code` to auto-generate a random 8-char code |
| PUT / DELETE | `/admin/users/:id` | you cannot delete your own account |

## Phase 1 test checklist

- [ ] `wrangler dev` starts with no errors
- [ ] `/login` with a valid access code returns a token; invalid code returns 401
- [ ] `/darajas`, `/darajas/:id/books`, `/books/:id/lectures`, `/lectures/:id/markers` all work with the token and return 401 without it
- [ ] `/lectures/:id/stream-url` returns a URL that plays the audio in a browser/VLC
- [ ] That same URL returns an access-denied error if you wait ~10 minutes and try again
- [ ] `wrangler deploy` succeeds and the deployed URL behaves the same as local
