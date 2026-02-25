# AGENTS.md

## Cursor Cloud specific instructions

### Overview

**Flight Desk Pro** is a multi-tenant Next.js 16 web app for aero clubs/flight schools (members, aircraft, bookings, invoicing, equipment, training, rosters). All data lives in a hosted Supabase project (PostgreSQL + Auth + RLS); there is no local database.

### Quick reference

| Action | Command |
|--------|---------|
| Dev server | `npm run dev` (port 3000) |
| Lint | `npm run lint` |
| Build | `npm run build` |
| Schema gen | `npm run schema:generate` |

### Environment variables

A `.env.local` file is required (gitignored). The app needs at minimum:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
- `SUPABASE_SECRET_KEY` (or `SUPABASE_SERVICE_ROLE_KEY`)

Without valid Supabase credentials, the dev server starts and the login page renders, but authentication and all data-dependent pages will fail with fetch errors.

### Gotchas

- The root layout (`app/layout.tsx`) calls Supabase on every render to resolve the auth session. If the Supabase URL is unreachable, pages may show server errors or slow timeouts.
- Middleware redirects unauthenticated users to `/login` for all protected routes (dashboard, aircraft, members, bookings, invoices, equipment, scheduler, rosters, instructors).
- No automated test suite exists in the repository; there are no test scripts in `package.json`.
- Node.js 18.18+ is required (Next.js 16 minimum). The VM ships with Node 22 which is compatible.
