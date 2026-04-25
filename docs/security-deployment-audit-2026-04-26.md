# Security & Deployment Audit — 2026-04-26

## Scope

This audit reviewed:

- Authentication/session handling (`middleware`, auth session helpers)
- API authorization patterns across `app/api/**/route.ts`
- Service-role / privileged Supabase usage
- OAuth callback security (Xero)
- Security headers and deployment config
- Dependency risk
- Build/lint readiness

## What was executed

- `npm run lint` -> pass
- `npm run build` -> pass (with one warning: Next.js middleware deprecation)
- `npm audit --omit=dev --audit-level=high` -> failed with vulnerabilities (details below)

## Executive Summary

**Current launch recommendation: NO-GO until critical + high findings are addressed.**

- 1 critical issue found
- 2 high-risk issues found
- 4 medium-risk issues found

The critical issue is a tenant-binding flaw in the Xero OAuth callback that can allow cross-tenant writes using service-role access.

---

## Findings

## 1) Critical: Cross-tenant write risk in Xero OAuth callback

- Severity: **Critical**
- File: `app/api/xero/callback/route.ts`
- Evidence:
  - Callback decodes tenant from client-controlled `state` (`decoded.tenantId`) and uses it for privileged writes:
    - `tenant_id: decoded.tenantId` in `xero_connections` upsert, settings update/insert, and export log insert (lines 90, 106, 129-133, 138)
  - Session is checked for admin role, but callback does **not** verify decoded tenant equals authenticated tenant:
    - session fetch includes tenant (`includeTenant: true`) but returned `tenantId` is not used (lines 62-68)

### Why this matters

An authenticated admin/owner can potentially craft callback state/cookie values and direct privileged writes at another tenant ID if known. Because service-role client is used, this bypasses normal RLS boundaries at this write point.

### Required fix before launch

- In callback, resolve tenant using trusted server session context and enforce:
  - `decoded.tenantId === session.tenantId` (or remove tenant from state entirely and use server tenant only)
- Also validate state freshness (`timestamp`) and consider signing/encrypting state (or store server-side nonce/state rather than trusting client-echoed payload)
- Best immediate hardening: replace callback auth check with `getTenantAdminRouteContext()` and use returned `tenantId` for all writes

---

## 2) High: Known vulnerable dependency set in production tree

- Severity: **High**
- Evidence from `npm audit --omit=dev --audit-level=high`:
  - `next@16.2.1`: High severity DoS advisory (`GHSA-q4gf-8mx6-v5v3`)
  - `lodash@4.17.23`: High severity advisories (`GHSA-r5fr-rjxr-66jc`, `GHSA-f23m-r3pf-42rh`)
  - Additional moderate advisories (`postcss`, `uuid`)
- Relevant files:
  - `package.json` pins `next` to `16.2.1`
  - `npm ls` shows vulnerable versions present transitively

### Why this matters

Shipping with known high-severity advisories increases exploitability and incident risk from day 1.

### Required fix before launch

- Upgrade to patched versions and re-run audit:
  - Move `next` to patched version line recommended by advisory (currently `16.2.4` per audit output)
  - Refresh lockfile and resolve vulnerable transitive trees (`lodash`, `postcss`, `uuid`)
- Re-run:
  - `npm run lint`
  - `npm run build`
  - `npm audit --omit=dev --audit-level=high`

---

## 3) High: DB-side tenant/RLS safety still requires live-project verification

- Severity: **High (verification gap)**
- Evidence:
  - Repo includes prior caution about DEFINER/RLS verification requirements: `docs/production-readiness-audit.md`
  - Repo includes explicit SQL checklist to verify live policies/functions: `docs/sql/production-readiness-queries.sql`

### Why this matters

For this app, final authorization correctness depends heavily on live Supabase RLS + SQL function definitions. A clean app code review is not sufficient without checking the deployed DB.

### Required before production cutover

Run and archive results on target project:

- `pg_policies` for `bookings`
- overload/function definitions for `check_user_role_simple`
- function definitions for:
  - `finalize_booking_checkin_with_invoice_atomic`
  - `uncancel_booking`
  - `record_invoice_payment_atomic`
- confirm access token hook function exists and is enabled

Use `docs/sql/production-readiness-queries.sql` as the runbook.

---

## 4) Medium: Rate limiter is in-memory and instance-local

- Severity: **Medium**
- File: `lib/security/rate-limit.ts`
- Evidence:
  - Uses process-local `Map` (`const buckets = new Map<string, Bucket>()`)
  - No distributed/shared storage

### Risk

Rate limits can be bypassed via multi-instance distribution, restarts, or horizontal scale. This is mainly abuse/spam control risk for email-triggering endpoints.

### Recommendation

Move to shared limiter backend (e.g., Redis/Upstash or Supabase-backed throttling) for production consistency.

---

## 5) Medium: `send_invitation` flow is accepted but not executed in member creation

- Severity: **Medium (launch UX/logic bug)**
- File: `app/api/members/route.ts`
- Evidence:
  - Request accepts `send_invitation` (line 17)
  - Response returns `invitation_requested` (line 144)
  - No invitation is actually sent in this handler

### Risk

Operators may assume members were invited during creation when they were not, causing onboarding failures/support load on launch day.

### Recommendation

Either:
- trigger invite here when `send_invitation=true`, or
- remove flag from create flow and force explicit invite action

---

## 6) Medium: Security header baseline is partial

- Severity: **Medium**
- File: `next.config.ts`
- Evidence:
  - Includes `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`
  - Missing explicit CSP and HSTS in app-level headers

### Risk

Defense-in-depth against XSS/script injection is weaker without a CSP. HSTS enforcement may rely on platform defaults instead of app policy.

### Recommendation

- Add CSP (start with report-only if needed)
- Add HSTS if TLS is always enforced at your edge/domain

---

## 7) Medium: Middleware deprecation warning in production build

- Severity: **Medium (forward-compat/deploy hygiene)**
- Evidence:
  - `next build` warning: middleware convention deprecated; migrate to `proxy`

### Risk

Not an immediate outage, but this should be migrated to avoid future framework upgrade breakage.

---

## Deployment Readiness Status

## Blocking before public launch

1. Fix Xero callback tenant binding bug (Critical)
2. Patch high-severity dependencies and clear audit highs
3. Execute live Supabase verification queries and archive results

## Recommended same-cycle hardening

1. Replace in-memory rate limiter with shared backend
2. Resolve `send_invitation` flow mismatch
3. Add CSP/HSTS header policy
4. Plan middleware -> proxy migration

---

## Audit limitations

- This review was static + local build/dependency checks only.
- No direct connection to your production Supabase project was available in this run, so DB policy/function verification is listed as a required pre-launch gate.
