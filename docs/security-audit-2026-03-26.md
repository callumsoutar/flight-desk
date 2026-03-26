# Security Audit - 2026-03-26

Scope: follow-up review and remediation pass across the Flight Desk application, continuing from the earlier email-endpoint hardening work completed on 2026-03-26.

## Executive Summary

- This document now reflects the current repository state after a follow-up re-review on 2026-03-26.
- The original hardening work from this pass remains in place: strict payload validation, centralized redacted logging, shared HTTP security helpers, and CI security automation.
- The auth server actions in `app/actions/auth.ts` have now also been remediated to stop returning raw Supabase/setup error text to the UI.
- Dependency remediation previously listed as outstanding is no longer outstanding: `next` is already on `16.2.1` and `localtunnel` is no longer present.
- Remaining meaningful follow-up work is limited to:
  - choosing a long-term rate-limit storage approach if multi-instance deployments are expected
  - migrating `middleware.ts` to the newer `proxy` convention
  - optionally tightening lint policy further

## Completed Work

### 1) Endpoint Validation Audit

Status: completed for body-parsing API routes and server actions reviewed in scope.

- Converted route payload schemas from permissive `z.object(...)` parsing to rejecting unknown keys with `z.strictObject(...)`.
- Applied the change across JSON-mutating API handlers under `app/api/**/route.ts`.
- Applied the same hardening to shared booking creation input validation and relevant server actions:
  - `lib/bookings/create-booking.ts`
  - `app/bookings/actions.ts`
  - `app/rosters/actions.ts`

Security effect:

- Prevents silent acceptance/stripping of unexpected request properties.
- Reduces the attack surface for mass-assignment style mistakes and accidental backend behavior changes from extra client-supplied fields.

### 2) Centralized Logging With Redaction

Status: implemented.

- Added:
  - `lib/security/logger.ts`
- Logger now redacts:
  - access/refresh tokens
  - authorization headers
  - email addresses
  - request/response bodies
  - HTML payloads
  - attachments
- Replaced remaining ad hoc `console.error` / `console.warn` usage in server routes and server utilities with the redacting logger.

Key files updated include:

- `lib/email/send-email.ts`
- `lib/xero/client.ts`
- `lib/xero/get-xero-client.ts`
- `lib/xero/export-invoice.ts`
- `lib/xero/sync-contact.ts`
- `lib/xero/sync-accounts.ts`
- `lib/xero/upsert-account.ts`
- `lib/auth/session.ts`
- `lib/bookings/create-booking.ts`
- `app/api/bookings/trial/route.ts`
- `app/api/xero/*`
- `app/bookings/actions.ts`
- `app/rosters/actions.ts`

Security effect:

- Prevents provider payloads, raw exception objects, contact emails, and token-adjacent values from landing in server logs.
- Creates a single logging path that can be extended later to external logging sinks.

### 3) Error Detail Leakage Review

Status: completed for the routes and auth server actions reviewed in scope.

Remediated routes:

- `app/api/xero/void-invoice/route.ts`
  - Removed validation detail echoing.
  - Replaced RPC/provider error responses with generic client-facing failures.
- `app/api/xero/sync-accounts/route.ts`
  - Removed raw exception message from 500 responses.
- `app/api/bookings/[id]/checkin/correct/route.ts`
  - Removed direct RPC error message leakage on 500 responses.
- `app/api/members/[id]/access/cancel-invite/route.ts`
  - Removed Supabase admin delete error leakage.
- `app/api/bookings/[id]/checkin/approve/route.ts`
- `app/api/bookings/[id]/debrief/route.ts`
- `app/api/bookings/[id]/experience/route.ts`
- `app/api/bookings/[id]/send-confirmation-email/route.ts`
  - Standardized invalid-payload handling to generic 400 responses.

Note:

- Some routes still intentionally return user-facing business-rule failures such as `Forbidden`, `Not found`, conflict messages, or domain validation messages. Those are acceptable where they reflect expected application behavior rather than internal stack/provider details.
- `app/actions/auth.ts` now logs original sign-in/sign-up/setup failures server-side via `lib/security/logger.ts` and returns curated user-safe error messages to the UI.

### 4) Shared HTTP Security Helpers

Status: implemented.

- Added:
  - `lib/security/http.ts`
- Introduced shared helpers for:
  - no-store responses
  - generic invalid payload responses
  - generic internal server error responses

Security effect:

- Reduces inconsistent error handling between routes.
- Makes future API hardening cheaper to apply uniformly.

### 5) Automated Security Checks In CI

Status: implemented.

- Added ESLint enforcement to block direct `console.*` usage in `app/**` and `lib/**` except for the redacting logger implementation:
  - `eslint.config.mjs`
- Added npm scripts:
  - `security:audit`
  - `security:check`
- Added GitHub Actions workflows:
  - `.github/workflows/security.yml`
  - `.github/workflows/codeql.yml`

Security effect:

- Regressions in unsafe server logging now fail lint.
- Dependency advisories are now checkable in CI.
- CodeQL provides a baseline SAST pass without additional local tooling.

### 6) Verification / Build Integrity

Status: partially stale; historical note retained, current status recorded below.

- Restored `lib/email/templates/checkin-approved.tsx` because the prior change set had deleted the template while `app/api/bookings/[id]/checkin/approve/route.ts` still imported it.
- At the time of the original pass, the security changes themselves built successfully.
- Current repository status on re-review:
  - `npm run lint` passes
  - `npm run build` still emits the `middleware.ts` deprecation warning
  - `npm run build` currently fails later on an unrelated TypeScript RPC typing issue in `lib/reports/fetch-financial-report-data.ts`

## Findings From This Pass

### High / Significant

1. Permissive payload schemas were still common across API mutation routes.

- Risk: unexpected keys were being accepted and silently dropped, which weakens input contracts and increases the chance of future authorization or mass-assignment bugs.
- Fix: switched reviewed route schemas to strict object validation.

2. Server logs still contained raw provider payloads and identifiers in several Xero, booking, and email flows.

- Risk: PII, tokens, email addresses, and third-party error bodies could be retained in logs.
- Fix: centralized redacting logger and replaced all remaining direct `console.*` usage in `app/` and `lib/`.

3. A subset of API routes still returned raw backend/provider error content.

- Risk: internal implementation detail leakage to authenticated clients.
- Fix: replaced exposed internal errors with generic 400/500 responses in the identified routes above.

### Medium

4. In-memory rate limiting is still process-local.

Current state:

- `lib/security/rate-limit.ts` still uses an in-process `Map`
- the limiter is applied to:
  - `app/api/email/send-invoice/route.ts`
  - `app/api/email/send-statement/route.ts`
  - `app/api/bookings/[id]/send-confirmation-email/route.ts`

Risk:

- acceptable for a single-instance deployment
- not reliable across multiple instances, cold starts, or restarts

5. `middleware.ts` still uses a deprecated Next.js convention.

Current state:

- `npm run build` emits the `middleware` to `proxy` deprecation warning

Risk:

- low immediate risk
- should be migrated before the convention is removed in a future Next.js release

### Resolved Since Original Pass

6. Dependency remediation previously listed as outstanding has already been applied.

Current state:

- `next` is now `16.2.1`
- `localtunnel` is no longer present in `package.json` or `package-lock.json`

Impact:

- the previously documented `next@16.1.6` and `localtunnel -> axios` follow-up items should be treated as resolved in this repo state

## Remaining Suggested Fixes / Improvements

These are the items still worth doing in the current repository state.

### 1) Choose the Long-Term Rate-Limit Approach

Current state:

- High-risk email routes are rate-limited in-process only through `lib/security/rate-limit.ts`.

Recommendation:

- Redis is not planned for this application, so pick one of these two explicit approaches and document the choice:

Option A: keep the current in-memory limiter and explicitly scope it to single-instance deployments.

- Lowest implementation cost.
- Acceptable if the app runs as one long-lived instance.
- Document clearly that throttling resets on restart/deploy and does not coordinate across instances.

Option B: move the limiter to Supabase/Postgres-backed state.

- Best fit if multi-instance correctness is needed without adding Redis.
- Implement via a small table or RPC keyed by route + tenant + user with an expiry window.
- Preserves consistent throttling across instances and deployments.

Suggested follow-up:

- If you expect only a single app instance, keep the current limiter and add a short note to deployment/security docs.
- If you expect horizontal scaling or frequent cold starts, implement the database-backed limiter.

### 2) Auth Error Disclosure

Current state:

- Resolved.
- `app/actions/auth.ts` now returns curated user-safe responses and logs the original failures through `lib/security/logger.ts`.

Reason to keep this note:

- Future contributors should know this item has already been completed and should not be reopened unless raw auth/provider errors are reintroduced.

### 3) Migrate Deprecated Next Middleware Convention

Current state:

- `npm run build` emits a deprecation warning for `middleware.ts`.

Recommended improvement:

- Migrate to the newer `proxy` convention when convenient so security controls remain aligned with the supported Next.js path.

### 4) Tighten Lint Policy Further If Desired

Current state:

- `no-console` now protects `app/**` and `lib/**`.

Recommended improvement:

- Extend the same policy to other server-only folders if more are added later.
- Consider making warnings fatal in CI once the existing unused-variable warnings are cleaned up.

## Validation Performed

Re-checked on 2026-03-26 against the current repository state:

- `npm run lint`
  - passed
- `npm run build`
  - emits the `middleware.ts` deprecation warning
  - currently fails on an unrelated TypeScript RPC typing error in `lib/reports/fetch-financial-report-data.ts`
- package manifest review
  - `next` is `16.2.1`
  - `localtunnel` is not present in `package.json` or `package-lock.json`
- code review confirmation
  - `app/actions/auth.ts` now uses curated UI-safe auth messages with server-side logging
  - `lib/security/rate-limit.ts` remains process-local
  - `middleware.ts` remains on the deprecated convention
  - `eslint.config.mjs` still scopes `no-console` to `app/**` and `lib/**`

## Files Added For This Pass

- `.github/workflows/security.yml`
- `.github/workflows/codeql.yml`
- `lib/security/http.ts`
- `lib/security/logger.ts`
- `lib/email/templates/checkin-approved.tsx`

## Conclusion

This audit note is now updated to match the current codebase rather than the original point-in-time state.

- strict request validation remains broadly enforced
- redacted centralized logging remains in place
- auth server action error disclosure has now been remediated
- CI security automation remains in place
- the previously listed dependency remediation item is already resolved

The main remaining decisions are operational rather than application-layer security defects: whether the current single-instance rate limiter is sufficient for the intended deployment model, and when to migrate `middleware.ts` to `proxy`. This document should be treated as the source of truth for what remains open from this pass.
