# Security Audit - 2026-03-26

Scope: follow-up review and remediation pass across the Flight Desk application, continuing from the earlier email-endpoint hardening work completed on 2026-03-26.

## Executive Summary

- Completed the remaining endpoint validation pass for server routes and server actions that accept JSON payloads.
- Added a centralized server logging utility with redaction for common secrets, provider payloads, HTML bodies, email addresses, and tokens.
- Removed remaining internal error leakage from the highest-risk API routes reviewed in this pass.
- Added CI security automation for linting, dependency auditing, and CodeQL scanning.
- Re-verified the application with `npm run lint`, `npm run build`, and a live `npm audit` run on 2026-03-26.

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

Status: materially improved.

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

Status: completed.

- Restored `lib/email/templates/checkin-approved.tsx` because the prior change set had deleted the template while `app/api/bookings/[id]/checkin/approve/route.ts` still imported it.
- Verified that the current codebase builds successfully after the security changes.

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

4. Dependency audit still reports unresolved advisories as of 2026-03-26.

Live `npm audit --audit-level=high` results on 2026-03-26:

- `next@16.1.6`
  - multiple moderate advisories
  - fix path points to `next@16.2.1`
- `localtunnel -> axios`
  - high severity
  - currently a development dependency
- additional high-severity advisories in transitive packages including:
  - `@hono/node-server`
  - `hono`
  - `flatted`
  - `picomatch`
  - `minimatch`
  - `express-rate-limit`

Important context:

- Several findings are in development-only tooling or indirect dependencies.
- They were not auto-fixed in this pass because the required upgrades include breaking or out-of-range changes and should be validated deliberately.

## Remaining Suggested Fixes / Improvements

These are the items still worth doing after this pass.

### 1) Dependency Remediation

Recommended next actions:

- Upgrade `next` from `16.1.6` to the patched release line identified by audit.
- Review whether `localtunnel` is still required; if not, remove it to eliminate the `axios` advisory chain.
- Run `npm audit fix` in a branch, then manually validate.
- Only use `npm audit fix --force` after reviewing the resulting version jumps.

### 2) Replace In-Memory Rate Limiting

Current state:

- High-risk email routes are rate-limited in-process only.

Recommended improvement:

- Move `lib/security/rate-limit.ts` to Redis/Upstash-backed storage for multi-instance correctness and consistent throttling under scale.

### 3) Review Auth Server Actions For User-Facing Error Disclosure

Current state:

- `app/actions/auth.ts` still returns raw Supabase/auth setup error messages directly to the UI.

Risk:

- Low to moderate information disclosure depending on exact provider responses.

Recommended improvement:

- Replace raw messages with curated user-safe responses and log the original error server-side through `lib/security/logger.ts`.

### 4) Migrate Deprecated Next Middleware Convention

Current state:

- `npm run build` emits a deprecation warning for `middleware.ts`.

Recommended improvement:

- Migrate to the newer `proxy` convention when convenient so security controls remain aligned with the supported Next.js path.

### 5) Tighten Lint Policy Further If Desired

Current state:

- `no-console` now protects `app/**` and `lib/**`.

Recommended improvement:

- Extend the same policy to other server-only folders if more are added later.
- Consider making warnings fatal in CI once the existing unused-variable warnings are cleaned up.

## Validation Performed

Executed on 2026-03-26:

- `npm run lint`
  - passed with warnings only
  - current warnings are unrelated unused-variable warnings in existing booking/email template files
- `npm run build`
  - passed
- `npm run security:audit`
  - completed successfully after allowing registry access
  - reported 10 vulnerabilities total: 8 high, 2 moderate

## Files Added For This Pass

- `.github/workflows/security.yml`
- `.github/workflows/codeql.yml`
- `lib/security/http.ts`
- `lib/security/logger.ts`
- `lib/email/templates/checkin-approved.tsx`

## Conclusion

This pass closes the remaining application-level work from the prior audit that was practical to complete safely inside the repo:

- strict request validation is now broadly enforced
- redacted centralized logging is in place
- major internal error leaks were removed
- CI security automation was added

The main remaining risk is dependency hygiene rather than application-layer authorization or input-handling weakness. The next priority should be deliberate dependency upgrades, especially the Next.js patch release and any removable dev-only vulnerable tooling.
