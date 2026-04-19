# Supabase database workflow (local + hosted)

Use this document as the **canonical workflow** for schema and migration work in this repo. Agents should follow it when changing the database, RLS, functions, or seeds.

## Source of truth

- **Git-tracked SQL migrations** under `supabase/migrations/` are the source of truth for schema, policies, functions, triggers, and versioned seed data.
- **Neither** “whatever is on local Docker” **nor** “whatever is on hosted Supabase” is the source of truth **by itself**. The migration history in the repo is.

## Recommended workflow

1. **Add or edit a migration file** in `supabase/migrations/` (timestamp prefix, one logical change per migration when practical).
2. **Apply and test against local Supabase** (Docker): e.g. `supabase db reset` to prove a **clean** database can be built from **all** migrations in order.
3. **Commit and merge** the migration files.
4. **Deploy the same migrations to hosted production** using your team process (e.g. `supabase db push`, CI pipeline, or Supabase branching if you use it).

Always aim for **the same migration files** to run successfully on a fresh local DB and on hosted.

## What to avoid (unless you immediately capture it in SQL)

- **Defining schema only in the Supabase Dashboard (hosted)** without a matching migration in `supabase/migrations/`. That causes drift: production (or staging) no longer matches Git, and teammates cannot reproduce the state.
- **Hand-editing local Postgres** (SQL client, one-off Studio changes on local) without recording the change in a migration. Same drift problem.
- **Using `supabase db reset` on production.** Reset is for **local development** only. Production is updated by **applying new migrations**, not wiping the database.

## Role of local vs hosted

| Environment | Purpose |
|-------------|---------|
| **Local (Docker)** | Fast iteration, destructive tests, `db reset`, verifying migrations from scratch. |
| **Hosted** | Real data, access controls, backups. Updated by **pushing/applying migrations** from the repo. |

You do **not** choose “develop on local **or** develop on hosted” as the primary model. You choose **migrations in the repo first**, then validate on **local**, then apply to **hosted**.

## `supabase db reset` (local)

- Rebuilds the local database from migration files (and local config/seeds as defined by your Supabase project).
- Use it to **catch ordering bugs**, missing dependencies between migrations, and broken seeds.
- Expect **local data loss**; that is normal for dev.

## If you prototyped in the Dashboard

If you must experiment in Studio:

1. Reproduce the final intent in a **new migration file**, or use **`supabase db diff`** (when appropriate for your setup) to generate SQL, then **review and commit** it.
2. Never leave “production was changed in the UI” as the only record of a schema change.

## Agent checklist (schema / RLS / RPC changes)

- [ ] Every change is represented under `supabase/migrations/` (new file or clearly scoped edit if your team allows amend-in-place—prefer **new** migrations for anything already merged to main).
- [ ] Local Supabase applies all migrations cleanly (e.g. after `supabase db reset`).
- [ ] No reliance on manual hosted-only steps without a migration.
- [ ] RLS and security-sensitive objects are treated as part of the migration story, not ad-hoc fixes in production.

## Related repo paths

- Migrations: `supabase/migrations/`
- Generated app schema (if used): `npm run schema:generate` from `lib/types/database.ts` (see root `AGENTS.md`)

## Official references

- [Supabase CLI: Local development](https://supabase.com/docs/guides/cli/local-development)
- [Database migrations](https://supabase.com/docs/guides/deployment/database-migrations)
