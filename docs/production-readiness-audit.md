# Production readiness audit — FlightDesk

**Scope:** Go / no-go review focused on security, tenant isolation, financial integrity, reliability, and production behavior. Not a style or best-practices pass.

**Overall decision:** **DEPLOY WITH CAUTION**

You are not in “do not deploy” territory if production Supabase matches the repo migrations and the access token hook is live. You are not fully “safe to deploy” until **bookings RLS** and **DEFINER RPC tenant binding** are verified on the live database (not only in TypeScript).

---

## 1. Authentication & authorization

**Verdict: CAUTION**

### Critical issues

None identified as definite production breakers from code alone.

### Important fixes (soon)

- **Middleware uses JWT claims only** (`getClaims()`), not `getUser()`. Revoked sessions and role changes may remain effective until the access token expires. Acceptable for many apps, but know your incident response story.
- **`AUTH_CLAIMS_STRICT` defaults on** (`lib/auth/session.ts`): tenant and role come from the JWT unless you opt into DB fallbacks. Production **must** have the Supabase **custom access token hook** deployed (see `docs/sql/access-token-hook.sql`) so `tenant_id` / `app_role` are always present; otherwise users can get empty tenant or role and hard failures or mis-routing.

### What could go wrong

1. Hook missing or misconfigured → some sessions have no `tenant_id` in the JWT → “Account not configured” / broken API calls.
2. Admin demotes a user → they may still act as the old role until the JWT expires (if the UI does not double-check with authoritative role everywhere).
3. `signUpWithEmail` uses the service role for `create_tenant_for_new_user` and deletes the auth user on failure — if delete fails, you can get orphan auth users (operational noise, not a cross-tenant leak by itself).

### Quick fixes

- Confirm the access token hook is **enabled** in the Supabase Dashboard for production and matches the deployed SQL.
- Document max JWT lifetime versus security expectations for school operators.

---

## 2. Supabase RLS & multi-tenant isolation

**Verdict: CAUTION** (confirm product intent on live `pg_policies`; staff-only writes verified on production sample)

### Critical issues

`bookings` policies are defined across multiple historical migrations (for example insert/delete hardening in `20260312190000_security_audit_remediation.sql`); **always verify the live database** with `pg_policies` — do not infer from a single migration file.

On the production project sampled for this audit: **`bookings_tenant_select`** allows any tenant member who `user_belongs_to_tenant(tenant_id)` to read rows (scheduler-style). **`bookings_tenant_update`** uses a broad `USING (user_belongs_to_tenant(tenant_id))` but **`WITH CHECK`** requires `tenant_user_has_role(..., get_user_tenant(auth.uid()), owner|admin|instructor)` — so **non-staff cannot persist updates**, including crafted calls to `updateBookingAction`, which relies on RLS (`app/bookings/actions.ts`).

### Important fixes

- Confirm **`SELECT` visibility** (all members vs own row only) matches product and privacy expectations.
- Several **SECURITY DEFINER** RPCs select rows **by id only** (for example `record_invoice_payment_atomic` locks the invoice by `p_invoice_id` without an explicit `tenant_id = get_user_tenant()` predicate in the migration on disk). Safety then depends on **`check_user_role_simple` semantics** (whether the **2-arg** overload still used by many RPCs ties membership to the **current** tenant). Generated types can show a 2-arg `check_user_role_simple` (`lib/types/database.ts`) while newer SQL uses a **3-arg** form — implies **overloads or schema drift**; run a one-time DB audit: list `pg_proc` for that name and review each body.

### What could go wrong

1. Weak `bookings` UPDATE RLS → privilege escalation via server actions.
2. Mis-scoped **`check_user_role_simple` overload** → DEFINER RPCs touching another tenant’s row if an id is ever known (random UUID guessing is not a soundness argument for finance).

### Quick fixes

- Add explicit `AND … tenant_id = get_user_tenant(v_actor)` (or equivalent) to DEFINER RPCs that touch invoices, bookings, or aircraft by id — defense in depth, minimal change.

---

## 3. API routes / server actions

**Verdict: SAFE** (with the standard JWT caveats in section 1)

### Critical issues

None found: sensitive routes use `getTenantScopedRouteContext` / staff / admin helpers with **`requireUser: true`** and **`authoritativeTenant: true`** (`lib/api/tenant-route.ts`). Examples: `app/api/bookings/route.ts`, `app/api/invoices/route.ts`.

`/api` is not behind Next middleware — correct if **every** handler enforces session; sampled handlers do.

### Important fixes

- `app/api/auth/me/route.ts` returns **200** with `{ user: null }` when unauthenticated — fine for SPAs; do not treat status code alone as “logged in” in external clients.

### What could go wrong

1. A **new** route added without `getTenantScopedRouteContext` → accidental public data (process risk, not the current default).

---

## 4. Database logic (transactions, invoices, financial data)

**Verdict: SAFE** (core payment path is sound)

### Critical issues

- **`record_invoice_payment_atomic`** uses **`SELECT … FOR UPDATE`** on the invoice before applying payment (`20260312000000_fix_record_payment_dates_constraint.sql`) — prevents double-pay races under concurrency.
- **Member credit** uses a dedicated atomic RPC with tenant and membership checks (`20260325100000_add_member_credit_payment_atomic.sql`).

### Important fixes

- Server actions may pre-check balance then call the RPC — redundant with the RPC’s `FOR UPDATE`; harmless. Treat the **RPC** as the source of truth, not the action alone.

### What could go wrong

1. App code deployed against an old DB without these functions → hard failures (keep a deploy checklist).
2. Date / clamping logic on `paid_date` vs `issue_date` can produce surprising but consistent timestamps across timezones — reporting nuance, not silent corruption.

---

## 5. Core business logic (critical flows)

**Verdict: CAUTION** → **finalize + uncancel hardening applied** (re-verify after every deploy; other DEFINER RPCs may still use 2-arg checks)

### Live-database follow-up (Supabase)

The following was confirmed against the connected project (not only file excerpts):

- **`check_user_role_simple(user_id, allowed_roles[])`** (2-arg): checks role **across any tenant** membership (no `tenant_id` filter). **`check_user_role_simple(user_id, tenant_id, allowed_roles[])`** (3-arg): correctly scopes to one tenant. Both overloads may exist; callers must use the right one inside **SECURITY DEFINER** functions.
- **`uncancel_booking`** (after migration **`harden_uncancel_booking`**, version `20260327010341` on the linked project): requires `auth.uid()`, **`user_belongs_to_tenant`** for the booking’s tenant, and **3-arg** `check_user_role_simple` for owner / admin / instructor in that tenant.
- **`finalize_booking_checkin_with_invoice_atomic`** (migration **`harden_finalize_booking_checkin_tenant`**, version **`20260327012757`**): loads **`bookings.tenant_id`**, requires **`user_belongs_to_tenant`** and **3-arg** staff check in that tenant; rejects invoice or aircraft whose **`tenant_id`** does not match the booking’s tenant. Uses **`SET search_path TO ''`** with qualified `public.*` / `pg_catalog.set_config`.
- **`cancel_booking`** may still enforce tenant membership but **not** staff-only; confirm product intent.

### Mitigation in repository

- **`supabase/migrations/20260327012757_harden_finalize_booking_checkin_tenant.sql`** — replaces **`finalize_booking_checkin_with_invoice_atomic`** as above.
- **`uncancel_booking`** is hardened under the name **`harden_uncancel_booking`** on production (`20260327010341`); ensure that file exists in your local `supabase/migrations/` if you rebuild databases from git (some clones may need to pull remote-only migrations).

Re-verify with **`pg_get_functiondef`** (or `docs/sql/production-readiness-queries.sql`) after deploy.

### Important fixes (ongoing)

- `createBookingInTenant` enforces student vs staff rules in application code (`lib/bookings/create-booking.ts`) — keep RLS aligned with that intent.

---

## 6. Frontend critical flows (booking, etc.)

**Verdict: CAUTION**

### Critical issues

- Booking updates depend on **RLS** for who may update a row (`booking-detail-client.tsx` → `updateBookingAction`). There is no extra role gate in that action beyond tenant context.

### What could go wrong

1. The UI may hide actions, but a crafted client can still call server actions — **RLS must be correct** (see section 2).

---

## 7. Error handling & edge cases

**Verdict: SAFE / CAUTION**

### Critical issues

Many routes use `try/catch` → generic 500; sampled paths do not appear to leak raw DB errors to clients.

### Important fixes

- Sign-up failure logging may include PII-adjacent fields (`app/actions/auth.ts`) — align with your logging and retention policy.

---

## 8. Environment variables & secrets

**Verdict: SAFE**

### Critical issues

- `getSupabasePublicEnv` / `getSupabaseAdminEnv` **throw** if required vars are missing — misconfiguration tends to fail fast.

### Important fixes

- Service role is confined to server code (`lib/supabase/admin.ts` + `"server-only"`) — keep it that way.

---

## 9. Deployment configuration (Vercel)

**Verdict: CAUTION**

### Critical issues

None in `vercel.json` beyond **`"regions": ["syd1"]`** — if users are not Oceania-centric, latency is a product issue, not a safety issue.

### Important fixes

No cron or edge headers in repo — fine if unused.

---

## Final system risk assessment

**Verdict: CAUTION overall** — no single “ship = breach” finding in the application layer from the repo alone. **Bookings UPDATE** on the sampled production database is **staff-gated via policy `WITH CHECK`**; **SELECT** is tenant-wide for members (confirm intent). **Finalize check-in** and **uncancel** RPCs are **tenant-bound** as in section 5. Remaining gap class: **other finance / DEFINER RPCs** that still authorize with the **2-arg** `check_user_role_simple` and lock rows **by id only** — audit with `pg_get_functiondef` and `docs/sql/production-readiness-queries.sql`.

---

## Production readiness decision

**DEPLOY WITH CAUTION**

---

## Top three risks remaining

1. **`bookings` SELECT** allows any active member of the tenant to read rows (sampled production). Confirm that matches privacy / product expectations; **UPDATE** is staff-only via **`WITH CHECK`** on the same sample.
2. **SECURITY DEFINER** RPCs beyond finalize/uncancel may still use the **2-arg** `check_user_role_simple` and select by **`p_*_id` only** — prioritize **`record_invoice_payment_atomic`** and similar finance paths for **tenant_id** alignment or **3-arg** checks.
3. **JWT-only middleware + strict claims** → operational dependency on the **access token hook** (function must exist **and** be **enabled** under Authentication → Hooks) and a sensible token TTL when roles change.

---

## If you had one day before launch

1. Run the queries in **`docs/sql/production-readiness-queries.sql`** (or Supabase MCP **`execute_sql`**) plus **`get_advisors`** (`security`) and **`list_migrations`** vs `supabase/migrations/`.
2. In the Dashboard, confirm the **custom access token hook** is **enabled** and matches **`docs/sql/access-token-hook.sql`** (`flightdesk_access_token_hook`).
3. Confirm migrations **`harden_uncancel_booking`** (`20260327010341`) and **`harden_finalize_booking_checkin_tenant`** (`20260327012757`) are **applied**, then spot-check **`finalize_booking_checkin_with_invoice_atomic`** and **`uncancel_booking`** with **`pg_get_functiondef`**.
4. Add minimal **`tenant_id`** guards (or **3-arg** role checks) to any remaining high-impact DEFINER RPCs flagged in step 1.

---

## Deeper follow-up (evidence-based)

To move **CAUTION → SAFE** with proof: capture **`pg_policies`** for **`bookings`**, **`pg_get_functiondef`** for all **`check_user_role_simple`** overloads, and for **`record_invoice_payment_atomic`** / other finance RPCs still using the **2-arg** helper after finalize hardening.
