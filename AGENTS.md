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

### Starting the dev server

The Cursor Cloud sandbox injects secrets with a `KEY_NAME=value` format into `process.env`, meaning `process.env.NEXT_PUBLIC_SUPABASE_URL` may contain `NEXT_PUBLIC_SUPABASE_URL=https://...` instead of just `https://...`. Next.js reads these env vars directly, so the Supabase client receives an invalid URL.

To work around this, launch the dev server via Python to strip the key-name prefix:

```bash
python3 -c "
import os, subprocess
def fix(name):
    v = os.environ.get(name, '')
    return v.partition('=')[2] if '=' in v else v
env = os.environ.copy()
for k in ['NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY','SUPABASE_SECRET_KEY']:
    env[k] = fix(k)
env.pop('__CURSOR_SANDBOX_ENV_RESTORE', None)
subprocess.Popen(['npx','next','dev','--port','3001'], cwd='/workspace', env=env)
"
```

Alternatively, ensure `.env.local` has the correct values and unset the shell env vars before running `npm run dev`.

### Gotchas

- **Env var prefix issue**: See "Starting the dev server" above. The sandbox `__CURSOR_SANDBOX_ENV_RESTORE` mechanism re-injects malformed env vars even after `export` overrides, so `env -u` or shell `export` alone won't work.
- The root layout (`app/layout.tsx`) calls Supabase on every render to resolve the auth session. If the Supabase URL is unreachable, pages return 500.
- Middleware redirects unauthenticated users to `/login` for all protected routes (dashboard, aircraft, members, bookings, invoices, equipment, scheduler, rosters, instructors).
- No automated test suite exists in the repository; there are no test scripts in `package.json`.
- Node.js 18.18+ is required (Next.js 16 minimum). The VM ships with Node 22 which is compatible.
