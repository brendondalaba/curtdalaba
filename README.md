# Curt Dalaba · Sermons

A private library of sermon recordings. Only signed-in members can browse or play them, and
creating an account requires an access code that an existing member shares.

Astro 7 (server-rendered) + Tailwind CSS v4, running entirely on Cloudflare's free plan: a
Worker for the site, D1 for members and sermons, and a private R2 bucket for the audio.
Installable as a phone app (PWA). Scaffolded from bd-style; requires Node 22.22 or newer.

## How access is protected

| Piece | Protection |
| --- | --- |
| Every page and API route | `src/middleware.ts` checks the session cookie against D1 and redirects or returns 401 |
| Sessions | Random 256-bit token in an HttpOnly, Secure, SameSite=Lax cookie. D1 stores only its SHA-256, so the table can't be used to sign in |
| Passwords | PBKDF2-SHA256 with a random salt per member (`src/lib/password.ts`). Sign-in takes the same time whether or not the email exists |
| Audio files | Private R2 bucket with no public URL. Streamed only by `/api/audio/[id]` after the session check, with `Cache-Control: private, no-store` |
| Sign-up | `/signup` checks the access code server-side (rate-limited, constant-time) before creating the account |
| Data | D1 is only reachable from the Worker; admin-only actions check the role on the server |
| Brute force | Cloudflare rate limiter: 10 sign-in, sign-up, reset or password-change attempts per minute per IP |
| Forms | Astro rejects cross-site form posts (`checkOrigin`) |

Once someone is signed in they can, like any streaming site, technically save what they play. The
code gates who gets in; it can't stop a member from sharing a recording they've heard.

## Features

- Sermon list with search (title, passage, date) and a year filter
- Sticky player: resume where you left off (synced to your account), 15s back / 30s forward,
  0.75×–2× speed, lock-screen and headphone controls (Media Session API)
- Admin page: upload (chunked, up to 500 MB), edit and delete sermons, change the access code,
  make or remove admins, remove members, and make one-time password reset links
- Account page: change password (signs out other devices), install-app instructions, light/dark theme

### Forgotten passwords

The site doesn't send email. A member who forgets their password asks an admin, who clicks
**Reset link** next to them on the Admin page and texts or emails the link. The link works once,
for 3 days, and signs the member out of their other devices.

## One-time setup

The D1 database (`curtdalaba`) and R2 bucket (`curtdalaba-sermons`) already exist, and the schema
in `migrations/` has been applied. There are no secrets to set.

1. **Workers & Pages → Create → Import a repository** and pick `brendondalaba/curtdalaba`.
   Name the Worker `curtdalaba`. Build command `npm run build`, deploy command `npx wrangler deploy`.
2. Open the site and **create the first account** with the access code. Read the code with
   `npx wrangler d1 execute curtdalaba --remote --command "select access_code from app_settings"`.
   **The first account becomes the admin** automatically; everyone after is a regular member.
3. Change the access code from the Admin page if you like, and share it.
4. Later, add `curtdalaba.com` under the Worker's **Domains & Routes**.

### Free plan limits

- Workers: 100,000 requests a day, about 10 ms of CPU per request. Password hashing is tuned to
  fit (`ITERATIONS` in `src/lib/password.ts`); raise it to 100,000 on the Workers Paid plan.
- D1: 5 million rows read and 100,000 rows written a day. Playback progress saves every 30 s
  while playing, which is the main source of writes.
- R2: 10 GB of storage; streaming is free.

## Schema changes

Add a numbered file to `migrations/`, update the row types in `src/lib/db.ts`, then:

```bash
npx wrangler d1 migrations apply curtdalaba --local    # local dev database
npx wrangler d1 migrations apply curtdalaba --remote   # production, before deploying code that needs it
```

## Development

```bash
npx wrangler d1 migrations apply curtdalaba --local   # once, to create the local database
npm run dev       # http://localhost:4321 (workerd with local D1 and R2)
npm run check     # Biome + astro check
npm run format    # apply Biome fixes
npm run build
npm run typegen   # regenerate worker-configuration.d.ts after editing wrangler.jsonc
```

Local dev uses a local D1 and R2 simulation, never the live data.

- Conventions: [docs/CODE_STYLE.md](docs/CODE_STYLE.md)
- Design tokens and UI rules: [docs/DESIGN.md](docs/DESIGN.md) (values in `src/styles/tokens.css`)
