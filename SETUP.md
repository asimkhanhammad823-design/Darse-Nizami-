# One-time Setup Checklist (owner only)

Everything below is done **once** by you (the repo owner). After this, the
admins only ever use the `/panel` link in a browser, and students only
install the APK — nobody needs a PC setup again. Total cost: **$0**.

Data storage is already wired up and free:

- **Database** (darjas, books, lectures, markers, users) → **Cloudflare D1**
  (free, 5 GB). The `database_id` in `worker/wrangler.toml` is already set.
- **Audio files** → **Backblaze B2** private bucket `dars-audio`
  (free, 10 GB). Endpoint/region/bucket are already in `wrangler.toml`.

## Step 1 — Cloudflare secrets (once, from any PC with Node.js)

If you already did this when first deploying the worker, skip to Step 2.

```bash
cd worker
npm install
npx wrangler login                      # opens browser, log in to Cloudflare
npx wrangler secret put JWT_SECRET      # paste output of: openssl rand -hex 32
npx wrangler secret put B2_KEY_ID       # from Backblaze B2 → App Keys
npx wrangler secret put B2_APPLICATION_KEY
npm run db:migrate:remote               # creates the tables in D1
npm run deploy                          # deploys API + /panel
```

## Step 2 — First admin user (one SQL command, once)

```bash
npx wrangler d1 execute dars_db --remote --command \
  "INSERT INTO app_user (access_code, name, is_admin) VALUES ('CHOOSE-A-CODE', 'Admin', 1);"
```

Every other user (students, more admins) is created from the panel's
**Users** page after this — never SQL again.

## Step 3 — Auto-deploy from GitHub (optional but recommended)

So future updates deploy themselves without a PC:

1. Create a Cloudflare API token: https://dash.cloudflare.com/profile/api-tokens
   → "Create Token" → template **Edit Cloudflare Workers**, and add
   **Account → D1 → Edit** permission.
2. GitHub repo → **Settings → Secrets and variables → Actions →
   New repository secret** → name `CLOUDFLARE_API_TOKEN`, paste the token.
3. Done. Every push touching `worker/` now deploys automatically
   (see `.github/workflows/deploy-worker.yml`). You can also trigger it
   manually from the **Actions** tab.

## Step 4 — Build the student APK in the cloud (no Flutter needed)

1. GitHub repo → **Actions** tab → **Build Android APK** → **Run workflow**
   (optionally paste your worker URL if it differs from the default).
2. When it finishes (~10 minutes), open the run → **Artifacts** →
   download `dars-nizami-apk`.
3. Send the `dars-nizami.apk` file inside it to students (WhatsApp/USB).
   On the phone: tap the file → allow "install unknown apps" once → install.

## Step 5 — Hand over to the admins

Give your admin(s) two things:

- The panel link: `https://dars-worker.<your-subdomain>.workers.dev/panel`
- Their admin access code

…and point them at [GUIDE.md](GUIDE.md) (simple usage guide in Urdu).

## Free-tier housekeeping (nothing to do, just know)

- Deleting lectures from the panel also deletes their audio from B2, so
  storage cleans itself.
- If audio ever approaches 10 GB, re-encode uploads at 64 kbps
  (≈ 28 MB/hour → 10 GB ≈ 350 hours of lectures).
- Login attempts are rate-limited by the Worker automatically.
