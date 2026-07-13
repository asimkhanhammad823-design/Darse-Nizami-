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

Login now uses a **username + password**. Create the first admin:

```bash
npx wrangler d1 execute dars_db --remote --command \
  "INSERT INTO app_user (access_code, username, password, name, is_admin) VALUES ('admin', 'admin', 'CHOOSE-A-PASSWORD', 'Admin', 1);"
```

(Use your own values instead of `admin` / `CHOOSE-A-PASSWORD`.) Every other
user — students and more admins — is created from the panel's **Users** page
after this, never SQL again.

> **Upgrading an existing install?** If you already had the old access-code
> login, the migration copies each old code into both the username and the
> password, so you log in the first time with
> `username = old-code`, `password = old-code`, then change them on the
> Users page.

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

1. GitHub repo → **Actions** tab → **Build Android APK** → **Run workflow**.
2. When it finishes (~10 minutes), the APK is published automatically to a
   public release. From then on, **everyone downloads the app straight from
   the landing page** (next step) — no GitHub login needed. (A copy is also
   under the run's **Artifacts**.)

## Step 5 — One link for everything

There is now a single page that serves as the entry point:

```
https://dars-worker.<your-subdomain>.workers.dev/
```

On it:
- **📥 Download the App** button — students (and admins) install the Android
  app from here.
- **Login** (username + password) — an **admin** logs in here and lands in
  the panel. Students don't log in on the web; they log in inside the app
  with the username + password you give them.

Hand your admin(s): this link + their username & password, and point them at
[GUIDE.md](GUIDE.md) (simple usage guide in Urdu). Create each student on the
panel's **Users** page (username + password auto-generate if left blank) and
give them their two credentials.

## Free-tier housekeeping (nothing to do, just know)

- Deleting lectures from the panel also deletes their audio from B2, so
  storage cleans itself.
- If audio ever approaches 10 GB, re-encode uploads at 64 kbps
  (≈ 28 MB/hour → 10 GB ≈ 350 hours of lectures).
- Login attempts are rate-limited by the Worker automatically.
