# Curt Dalaba · Sermons

A private library of sermon recordings. Only signed-in members can browse or play them, and
creating an account requires an access code that an existing member shares.

Astro 7 (server-rendered) + Tailwind CSS v4 + Supabase Auth/Postgres, hosted on a Cloudflare
Worker, with audio in a private Cloudflare R2 bucket. Installable as a phone app (PWA). Scaffolded
from bd-style; requires Node 22.22 or newer.

## How access is protected

| Piece | Protection |
| --- | --- |
| Every page and API route | `src/middleware.ts` verifies the Supabase session (`getClaims`) and redirects or returns 401 |
| Audio files | Private R2 bucket with no public URL. Streamed only by `/api/audio/[id]` after the session check, with `Cache-Control: private, no-store` |
| Sign-up | `/signup` checks the access code server-side (rate-limited, constant-time), then creates the user with the secret key |
| Bypassing the site | A database trigger rejects any new user not created by the sign-up endpoint, so the public Supabase sign-up API can't be used to skip the code |
| Data | Row level security on every table. Members read sermons and their own progress; only admins write |
| Brute force | Cloudflare rate limiter: 10 sign-in/sign-up/reset attempts per minute per IP |

Once someone is signed in they can, like any streaming site, technically save what they play. The
code gates who gets in; it can't stop a member from sharing a recording they've heard.

## Features

- Sermon list with search (title, passage, date) and a year filter
- Sticky player: resume where you left off (synced to your account), 15s back / 30s forward,
  0.75×–2× speed, lock-screen and headphone controls (Media Session API)
- Admin page: upload (chunked, up to 500 MB), edit and delete sermons, change the access code,
  make or remove admins, remove members
- Account page: change password, install-app instructions, light/dark theme
- Password reset by email

## One-time setup

### 1. Supabase

1. Create a project and run `supabase/migrations/20261121000000_init.sql` (SQL editor, CLI or MCP).
2. **Authentication → Sign In / Providers → Email**: turn off **Allow new users to sign up**
   (the trigger already blocks it; this makes it explicit). Leave **Confirm email** as is: the site
   creates users already confirmed.
3. **Authentication → URL Configuration**: set **Site URL** to the live URL and add
   `https://<site>/auth/callback` (and `http://localhost:4321/auth/callback`) to **Redirect URLs**.
4. Copy the project URL and the **publishable** key into `vars` in `wrangler.jsonc`, and the
   **secret** key into `.dev.vars` locally (see `.dev.vars.example`).

The default Supabase email sender only sends a few emails per hour. If password resets become
common, add custom SMTP under **Authentication → Emails**.

### 2. Cloudflare

1. Enable R2 in the dashboard and create a bucket named `curtdalaba-sermons` (leave public
   access off).
2. **Workers & Pages → Create → Import a repository** and pick `brendondalaba/curtdalaba`.
   Name the Worker `curtdalaba`. Build command `npm run build`, deploy command `npx wrangler deploy`.
3. In the Worker's **Settings → Variables and Secrets**, add a **secret** `SUPABASE_SECRET_KEY`
   (or run `npx wrangler secret put SUPABASE_SECRET_KEY`).
4. Later, add `curtdalaba.com` under the Worker's **Domains & Routes**, then update the Supabase
   Site URL and redirect URLs to match.

### 3. First admin

Sign up on the site with the access code (the migration generates a random one; read it with
`select access_code from app_settings;`). Then make yourself an admin:

```sql
update public.profiles set is_admin = true where email = 'you@example.com';
```

After that, admins manage everything from the **Admin** page.

## Development

```bash
npm run dev       # http://localhost:4321 (runs in workerd with local R2)
npm run check     # Biome + astro check
npm run format    # apply Biome fixes
npm run build
npm run typegen   # regenerate worker-configuration.d.ts after editing wrangler.jsonc
```

Local dev uses a local R2 simulation, but the real Supabase project.

- Conventions: [docs/CODE_STYLE.md](docs/CODE_STYLE.md)
- Design tokens and UI rules: [docs/DESIGN.md](docs/DESIGN.md) (values in `src/styles/tokens.css`)
