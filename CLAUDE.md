@AGENTS.md

# curtdalaba

Astro + Tailwind CSS v4 + TypeScript, scaffolded from bd-style.

## Before you change anything

- Code conventions: `docs/CODE_STYLE.md`. UI and color rules: `docs/DESIGN.md`. Read the relevant one first.
- UI uses role colors from `src/styles/tokens.css` (`bg-primary`, `text-muted-foreground`, ...). Never raw hex,
  never Tailwind palette colors, never `dark:` classes; tokens already handle light and dark.

## Workflow

- npm only. After changes, run `npm run check` (Biome lint + type check) and fix what it reports.
- `npm run format` applies Biome's safe fixes and formatting. Don't hand-format.
- Keep changes small and focused. Commit messages use Conventional Commits (`feat: ...`, `fix: ...`).
- Ask before adding a dependency; prefer the platform or a few lines of code.

## Project notes

- Private sermon library. Deploys to the Cloudflare Worker `curtdalaba` via Workers Builds from
  GitHub `brendondalaba/curtdalaba` (`main`). Setup steps are in `README.md`.
- Bindings and env come from `import { env } from "cloudflare:workers"` (not `Astro.locals.runtime`,
  removed in Astro 6). Run `npm run typegen` after editing `wrangler.jsonc`.
- Auth: Supabase via `@supabase/ssr` cookies, checked in `src/middleware.ts`. Public paths are listed
  there; anything new is private by default. Secret-key client (`createSupabaseAdminClient`) is only
  for sign-up and member management.
- Audio lives in R2 at `sermons/<sermon id>` and is only served by `src/pages/api/audio/[id].ts`.
  Never add a public bucket URL or put audio in `public/`.
- Schema changes: add a new file in `supabase/migrations/` and update `src/lib/database.types.ts`.
- On this machine the project sits on OneDrive (`/mnt/c`), which makes `astro dev`/`preview` slow to
  start; `npx wrangler dev -c dist/server/wrangler.json` after a build is a quicker local check.
