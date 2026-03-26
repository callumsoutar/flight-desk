# Auth/App Skeleton (Login, JWT Claims, Onboarding, RBAC)

This document describes the *minimal skeleton* of authentication + onboarding + multi-tenant role-based access control (RBAC) in this codebase, so it can be replicated in a new app.

Scope:
- App layout/auth state wiring (Next.js App Router)
- Session/JWT handling (`getClaims()`, `getUser()`, cookie-based SSR)
- Login (email+password, OAuth callback), logout
- Signup + onboarding flows (tenant creation + membership)
- Tenant-aware RBAC (roles, route/API guards, and Supabase RLS integration)

Non-goals:
- Full feature routes (bookings, aircraft, invoices, etc.) except where they show auth patterns

---

## Tech Stack Anchors

- Framework: Next.js App Router (`app/`)
- Next.js conventions: Server Components by default; add small `use client` islands only when needed
- Auth + DB: Supabase (`@supabase/ssr`, `@supabase/supabase-js`)
- Multi-tenancy: `tenants` + `tenant_users` join table
- RBAC roles: Supabase custom Postgres roles (JWT `role` claim) + `tenant_users.role` (tenant-scoped canonical role)

Key deps: `package.json`
- `@supabase/ssr`, `@supabase/supabase-js`

---

## The Golden Rule (How Auth Is Verified)

Throughout the app, the "trusted user" is derived as:
1. `supabase.auth.getClaims()` to verify the JWT signature (and refresh cookies if needed)
2. `supabase.auth.getUser()` to fetch the user from Supabase Auth server
3. **Only accept the user if `claims.sub === authenticatedUser.id`**

This pattern appears in:
- `app/layout.tsx` (initial SSR auth state)
- `app/api/auth/me/route.ts` (canonical client sync endpoint)
- `app/api/auth/onboarding/route.ts` (protect onboarding API)
- `components/auth/role-guard.tsx` (server-side route guard)

Why both calls:
- `getClaims()` is the "signature verified" source of truth for `sub` (user id)
- `getUser()` ensures user data is fetched from the Auth server (Supabase security guidance)
- The ID match prevents accidentally trusting a user object that doesn't correspond to the verified token subject

---

## Session Model (SSR Cookies + Middleware Refresh)

### Supabase Clients

- Server client (cookie-based SSR): `lib/supabase/server.ts`
  - Uses `createServerClient()` and `next/headers` cookies store
  - Writes cookies via `setAll()` when running in contexts that allow it (middleware/route handlers)

- Browser client: `lib/supabase/client.ts`
  - Uses `createBrowserClient()` for client-side auth operations (OAuth redirects, local `getSession()`, etc.)

- Admin client (service role): `lib/supabase/admin.ts`
  - Uses secret key env vars, disables session persistence/refresh
  - **Only for server-side privileged operations** (signup/onboarding provisioning)

### Middleware

- Entry: `middleware.ts`
- Core logic: `lib/supabase/middleware.ts` (`updateSession(request)`)

What it does:
- Creates a Supabase SSR client bound to the incoming request cookies
- Calls `supabase.auth.getClaims()` (signature verified; also refreshes session cookie when needed)
- Computes `userId = claims?.sub ?? null`
- If request is not for a "public" path and `!userId`, redirects to `/login`

Public paths list (current):
- `/login`, `/signup`, `/auth`, `/onboarding`, `/api/auth`

Important behavior:
- Middleware is intentionally kept focused on "session refresh + auth gate".
- Authorization is expected to be enforced via:
  - Database RLS (canonical)
  - Server-side checks in API routes / server components (defense in depth)

---

## App Layout (How Auth State Enters React)

## Next.js Structure (Server First)

Follow Next.js best practices:
- Use Server Components by default for pages/layouts and data fetching.
- Only mark components `use client` when they truly need client-only features (local state, effects, event handlers, browser APIs).
- When client behavior is needed, create a small dedicated client component and compose it into a Server Component, rather than making whole pages client-side.

Auth-related guidance in this repo already leans this way:
- SSR derives initial auth state in `app/layout.tsx` and passes it into a client `AuthProvider`.
- Client-only concerns (cross-tab sync, focus refresh, UI gating) live in `contexts/auth-context.tsx` and UI components.

### Root Layout SSR Resolution

File: `app/layout.tsx`

On every request SSR:
- Builds server Supabase client
- Runs the "golden rule" flow to derive `user` (or `null`)
- Resolves:
  - `initialRole` from verified JWT claims (custom Postgres role via `claims.role`) (preferred)
  - `initialProfile` via `fetchUserProfile(supabase, user)` (`lib/auth/user-profile.ts`)
- Wraps the app with:
  - `AuthProvider initialUser initialRole initialProfile` (`contexts/auth-context.tsx`)

### Client Auth Context

File: `contexts/auth-context.tsx`

State stored:
- `user`, `role`, `profile`, `loading`

How it stays in sync:
- On mount, calls `refreshUser()` which fetches `/api/auth/me` (no-store) and updates state
- Subscribes to a `BroadcastChannel("aerosafety-auth")` so other tabs can force refresh
- Refreshes again on window focus

Logout:
- Clears local state immediately
- Calls server action `signOut` (`app/actions/auth.ts`) to clear HTTP-only cookies
- Broadcasts "auth-changed"
- Hard-navigates to `/login` (full reset)

Why `/api/auth/me` exists:
- It's the one endpoint that turns "cookies on the server" into "user/role/profile state on the client"

---

## Login / Logout Flows

### Email + Password Login

- UI: `app/login/page.tsx` -> `components/login-form.tsx`
- Server action: `app/actions/auth.ts` (`signInWithEmail`)

Flow:
1. Client submits email+password
2. Calls server action `signInWithEmail(email, password)`
3. Server action calls `supabase.auth.signInWithPassword()`
4. On success, it `revalidatePath("/", "layout")` so SSR picks up the new cookie session
5. Client broadcasts "auth-changed", calls `router.refresh()`, and then hard-navigates to `/`

Notes:
- Using a server action for login is intentional: it ensures cookies are set server-side correctly.

### OAuth Login (Google shown)

- UI: `components/login-form.tsx` uses browser client:
  - `supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: "/auth/callback" } })`

- Callback handler: `app/auth/callback/route.ts`

Callback flow:
1. Supabase redirects to `/auth/callback?code=...`
2. Route handler exchanges code: `supabase.auth.exchangeCodeForSession(code)`
3. If user looks like a "new OAuth user without tenant membership", redirect to `/onboarding`
4. Else redirect to `next` (default `/`)

Tenant check heuristic (current):
- If `user.user_metadata.tenant_id` missing AND no `tenant_users` rows exist for user -> go to onboarding

### Logout

- Client triggers `AuthProvider.signOut()`
- Calls `app/actions/auth.ts` -> `supabase.auth.signOut()`
- Revalidates layout and navigates to `/login`

---

## Signup + Onboarding (Provisioning Tenants)

This app is multi-tenant. A user must belong to at least one `tenant_users` membership to be "fully onboarded".

There are two ways a user gets a tenant:

### A) Full Signup (creates tenant + user)

- UI: `app/signup/page.tsx` -> `components/signup-form.tsx`
- API: `app/api/auth/signup/route.ts` (uses admin client)

What the signup API does (simplified):
1. Validate input with `zod`
2. Generate a unique tenant slug
3. Check for existing email (currently via `supabase.auth.admin.listUsers()`)
4. Create tenant row in `tenants`
5. Create Auth user via `auth.admin.createUser()` with `user_metadata`:
   - `first_name`, `last_name`, `tenant_id`, `is_tenant_owner`
6. Insert membership row in `tenant_users` for (tenant, user, role = `'owner'`)
8. Insert row in app `users` table (profile)
9. Return 201 + "check email to verify"

Expected user experience:
- Signup does *not* automatically log the user in.
- User verifies email, then signs in from `/login`.

### B) OAuth Onboarding (creates tenant for an already-authenticated user)

- UI: `app/onboarding/page.tsx`
- API: `app/api/auth/onboarding/route.ts`

Client page behavior:
1. Uses browser client `supabase.auth.getSession()` to confirm session exists
2. If no session, redirects to `/login`
3. If user already has a `tenant_users` row, redirects to `/`
4. Otherwise shows form to create organization
5. Submits to `/api/auth/onboarding` with `userId` + org info

Onboarding API behavior:
1. Uses server client + "golden rule" to verify requester is authenticated
2. Validates request body via `zod`
3. Ensures `body.userId === currentUser.id` (no creating orgs for other users)
4. Uses admin client to:
   - Ensure user has no existing tenant membership
   - Create tenant + `tenant_users` owner membership
   - Upsert row in `users` table
   - Update auth user metadata to set `tenant_id` + `is_tenant_owner`

---

## RBAC + Tenant Authorization (How Access Is Decided)

## Centralized Authorization (Make It Simple And Hard To Bypass)

The app should have a single, centralized place to decide "who can access what", so that:
- Hiding a sidebar tab is trivial and consistent (UX gating).
- Direct navigation to a restricted page reliably redirects away (route/page gating).
- API routes enforce the same policy (server gating).
- Database RLS remains the final, non-bypassable boundary.

Practical pattern to replicate:
1. Define a canonical role model (`UserRole`) and a mapping from JWT `claims.role` to that model.
2. Define route-level permissions in one place (for example `lib/auth/route-permissions.ts`), e.g.:
   - `/invoices` allowed roles: owner/admin/instructor
3. Reuse that same permission source in:
   - Sidebar/nav filtering (so "members" never see the Invoicing tab)
   - A server-side route guard (so "members" get redirected if they hit `/invoices`)
   - API guard helpers used by `/api/invoices/**` handlers

Implementation options for route/page gating:
- Middleware-based redirects (fast fail, best UX), using `ROUTE_PERMISSIONS`.
- Server-component gating (authoritative at render time), using `RoleGuard`-style checks.

Minimum requirement:
- Whatever you choose, avoid scattering ad-hoc role checks throughout the app.
  Centralize them so adding/removing permissions is a one-file change.

### Role Types

Type: `lib/types/roles.ts`
- `UserRole = "owner" | "admin" | "instructor" | "member" | "student"`
- `ROLE_HIERARCHY` exists for "minimum role" checks

### Canonical Role Storage (Tenant-Scoped)

Canonical (DB):
- `tenant_users` row for (tenant_id, user_id) with a `role` column of type `user_role` (enum)

This allows:
- Fast tenant-scoped role checks in SQL/RLS
- A single authoritative place to change a user's role

Note:
- This repo currently models tenant roles via `tenant_users.role_id -> roles.name`.
- For a custom-roles-first replication, prefer a direct `tenant_users.role user_role` column (and drop the `roles` table) unless you need role metadata.

### Supabase Custom Roles (Postgres Roles via JWT `role` Claim)

Goal:
- Use Supabase "custom roles" so the JWT `role` claim maps to a Postgres role.
- Write RLS policies using `TO <role>` rather than checking role strings inside `USING`.

Important properties:
- The JWT `role` claim determines which Postgres role is used when applying RLS.
- Supabase requires custom roles to be granted to `authenticator` (so the API can `SET ROLE`).

Recommended role naming:
- Use prefixed roles to avoid ambiguity with Postgres/system roles: `app_owner`, `app_admin`, `app_instructor`, `app_member`, `app_student`.

Create roles (example):
```sql
create role app_owner;
create role app_admin;
create role app_instructor;
create role app_member;
create role app_student;

-- Allow the Supabase API gateway to assume these roles:
grant app_owner to authenticator;
grant app_admin to authenticator;
grant app_instructor to authenticator;
grant app_member to authenticator;
grant app_student to authenticator;

-- Recommended: inherit baseline authenticated grants (schema/table usage).
-- Alternative: grant schema/table privileges directly to each app_* role.
grant authenticated to app_owner;
grant authenticated to app_admin;
grant authenticated to app_instructor;
grant authenticated to app_member;
grant authenticated to app_student;
```

### How JWT `role` Gets Set (Custom Access Token Hook)

Supabase Auth issues tokens with required claims including `role`.
To set `role` to one of your `app_*` roles, implement a Custom Access Token hook that:
- Reads the user's tenant role from `tenant_users.role` (typically via `get_user_tenant(auth.uid())`-style logic for current tenant).
- Writes `claims.role` to the matching Postgres role (for example, `app_owner`).
- Leaves `role` as `authenticated` when the user is logged in but not yet onboarded (no tenant membership).

High-level hook behavior:
- If user has an active membership: `claims.role = 'app_' || tenant_users.role`
- Else: `claims.role = 'authenticated'`

Notes:
- Users with no tenant membership still need to call onboarding endpoints; keep them `authenticated` until membership exists.
- When a role changes, the token updates on refresh; you may still need drift detection + forced refresh/logout for immediate effect.

### Storage Policies (Why Supabase Docs Mention Custom Roles)

Supabase Storage authorization is also enforced via Postgres RLS on `storage.objects`.
Custom roles let you write policies like:
```sql
create policy "App owners can read private files"
on storage.objects
for select
to app_owner
using (bucket_id = 'private');
```

If you need folder-based rules, Supabase provides helper functions like `storage.foldername(name)` for parsing object paths; apply them inside `USING/WITH CHECK` as needed.

### App-Side Role Resolution (UI/UX)

Preferred:
- Treat the verified claims as the source of the current app role:
  - `claims.role` is expected to be one of: `app_owner|app_admin|app_instructor|app_member|app_student|authenticated`.
  - Map `app_*` to `UserRole` for the UI.

Fallback (if hook not configured yet):
- Query `tenant_users.role` for the current user and tenant.

Tenant resolution + context:
- `lib/auth/tenant.ts`:
  - `getTenantId()` reads membership list for current user (by `claims.sub`)
  - `getTenantContext()` joins `tenant_users` to return:
    - `tenantId`, `tenant`, `userRole`, `userId`
  - All functions explicitly warn: **never trust client-provided tenant IDs**

### API Guards

- `lib/api/require-staff-access.ts`
  - `requireStaffAccess()` (deprecated): owner/admin only
  - `requireTenantAccess(requiredRoles?)`: returns `{ error, context }`

- `lib/api/require-operations-access.ts`
  - `requireOperationsAccess(request, roles=...)`: returns `{ supabase, user, tenantContext }` or `{ error }`
  - Uses `getClaims()` + `getUser()` and tenant context to enforce roles

Example usage:
- `app/api/example-protected/route.ts`

### Server Component Guard (Not Widely Used Yet)

- `components/auth/role-guard.tsx`
  - Server component that redirects unauthorized users
  - Uses the same "golden rule" and centralized role resolution

### UI-Only Role Gating

- `components/app-sidebar.tsx` filters navigation items by `role` from auth context.
- This improves UX but must not be treated as security.

### Route Permissions Matrix (Present but Not Wired to Middleware)

- `lib/auth/route-permissions.ts` defines route -> allowed roles.
- Current `middleware.ts` does not apply it; only checks "authenticated vs not".
- If you replicate this app, decide whether to:
  - Keep middleware minimal (current behavior), or
  - Add role-based route redirects using `ROUTE_PERMISSIONS` (defense in depth)

---

## Database Layer (RLS Is the Real Security Boundary)

The app's intended "defense in depth" is:
1. Middleware blocks unauthenticated traffic from reaching protected pages
2. API routes do explicit tenant+role checks for write/privileged operations
3. **Supabase Postgres RLS** enforces row-level authorization no matter what

Multi-tenant schema and helpers live in migrations:
- `supabase/migrations/020_add_multi_tenant_support.sql`
  - Tables: `tenants`, `tenant_users`
  - Helper functions:
    - `get_user_tenant(user_id)`
    - `tenant_user_has_role(user_id, tenant_id, required_roles[])`
    - `current_user_has_tenant_role(required_roles[])`
    - `get_tenant_user_role(user_id, tenant_id)`

For a custom-roles-first approach, you can simplify policies to:
- Use `TO app_*` roles for coarse authorization
- Use tenant constraints in `USING/WITH CHECK` to prevent tenant spoofing

Example policy pattern (tenant-scoped INSERT):
```sql
create policy "Staff can insert aircraft"
on public.aircraft
for insert
to app_owner, app_admin, app_instructor
with check (
  tenant_id = public.get_user_tenant(auth.uid())
);
```

Role change tracking (for session invalidation logic):
- `supabase/migrations/024_add_role_change_propagation.sql`
  - `tenant_users.role_changed_at`
  - `needs_session_refresh(user_id, token_issued_at)`
  - `get_current_role_state(user_id)`

RLS policies often call `tenant_user_has_role(auth.uid(), get_user_tenant(auth.uid()), ...)`.
Example migration updating policies:
- `supabase/migrations/20260215094500_align_scheduler_rls_with_tenant_roles.sql`

---

## Environment Variables (Auth + Admin)

Client + server SSR (public):
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (preferred) or `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Admin (server-only secret):
- `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY`

Used in:
- `lib/supabase/server.ts`
- `lib/supabase/client.ts`
- `lib/supabase/middleware.ts`
- `lib/supabase/admin.ts`

---

## Known Gaps / Things To Decide When Replicating

- `lib/auth/route-permissions.ts` exists but middleware does not apply role checks.
- `components/auth/role-guard.tsx` exists but is not currently used by pages.
- `components/login-form.tsx` links to `/forgot-password`, but no route exists in `app/`.
- Password reset redirect points to `/settings/password`, but no such page exists in `app/`.
- Some older docs in `docs/` describe `user_roles`-based RBAC; current code/migrations focus on `tenant_users`.
- `docs/JWT_SYNC_SETUP.md` references `supabase/functions/sync-role-to-jwt`, but `supabase/functions/` is not present in this repo snapshot.
- If you adopt Supabase custom roles, you must implement the Custom Access Token hook that sets `claims.role` and ensure the `app_*` roles are created and granted properly.

---

## Replication Checklist (Bare Minimum)

If you want another bot to replicate the same skeleton in a new app, implement these pieces:

1. Supabase SSR wiring
   - `lib/supabase/server.ts`, `lib/supabase/client.ts`, `lib/supabase/middleware.ts`
   - `middleware.ts` that refreshes session and redirects unauthenticated users away from protected routes

2. "Golden rule" auth verification
   - Always `getClaims()` then `getUser()` and require `claims.sub === user.id`

3. Root layout auth bootstrap
   - SSR resolve user/role/profile and seed a client auth context

4. Client auth context + `/api/auth/me`
   - `AuthProvider` that calls `/api/auth/me` on mount/focus and supports cross-tab sync

5. Login flows
   - Server action for email/password login that sets cookies + `revalidatePath("/", "layout")`
   - OAuth sign-in redirect + `/auth/callback` code exchange route

6. Multi-tenant provisioning
   - Signup API that creates tenant + user + membership (admin client)
   - OAuth onboarding page + API that creates tenant + membership for logged-in users

7. RBAC primitives
   - Role type list + hierarchy
   - Tenant context resolver (`getTenantContext`)
   - Role mapping from verified claims (`claims.role` -> `UserRole`)
   - API guard helpers (returning 401/403 consistently)

8. Database RLS
   - `tenants`, `tenant_users`, (optional `roles` table only if you want it)
   - RLS policies using helper functions so RLS is always the final security boundary
