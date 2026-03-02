# Repository Guidelines

## Project Structure & Module Organization
- `app/`: Next.js App Router pages, layouts, route handlers (`route.ts`), and server actions (`actions.ts`).
- `components/`: Feature components; `components/ui/` contains shadcn/ui primitives.
- `lib/`: Shared domain logic (Supabase, auth, settings), generated schema (`lib/schema/generated.ts`), and types (`lib/types/`).
- `contexts/`, `hooks/`: React context providers and reusable hooks.
- `public/`: Static assets served at `/`.
- `docs/`: Design/notes and SQL references.

## Build, Test, and Development Commands
Use npm (repo includes `package-lock.json`). Node 20+ is recommended (Next requires `>=20.9.0`).
- `npm ci`: Install dependencies in a clean, reproducible way.
- `npm run dev`: Start the dev server at `http://localhost:3000`.
- `npm run lint`: Run ESLint (Next core-web-vitals + TypeScript rules).
- `npm run build`: Production build.
- `npm run start`: Run the production server after a build.
- `npm run schema:generate`: Regenerate `lib/schema/generated.ts` from `lib/types/database.ts`.

## Coding Style & Naming Conventions
- TypeScript + React (strict TS in `tsconfig.json`).
- Prefer absolute imports via `@/…` (see `components.json` aliases).
- Match existing formatting: 2-space indentation, double quotes, and generally no semicolons.
- Filenames are typically kebab-case (e.g. `components/aircraft/aircraft-charge-rates-table.tsx`).
- For client components, include `"use client"` at the top of the file.

## Testing Guidelines
No dedicated test runner is currently configured (no `npm test` script). For changes:
- Run `npm run lint` and do a quick manual smoke test in `npm run dev`.
- Add coverage-friendly tests if you introduce risky logic (suggested future: Vitest/Jest + Playwright).

## Commit & Pull Request Guidelines
Commit history is short, plain-language, and lower-case (e.g. “bug fixes”, “invoice creation page added”).
- Commits: keep subjects concise and scoped (optional pattern: `area: summary`).
- PRs: include a clear description, link relevant issues, and add screenshots/screen recordings for UI changes.
- Call out any required env var or schema changes in the PR description.

## Security & Configuration Tips
- Do not commit secrets: `.env*` is gitignored. Use `.env.local` for local dev.
- Required Supabase vars (see `lib/supabase/env.ts`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or `NEXT_PUBLIC_SUPABASE_ANON_KEY`), and `SUPABASE_SECRET_KEY` (or `SUPABASE_SERVICE_ROLE_KEY`).
