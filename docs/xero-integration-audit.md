# Xero Integration Audit Report

> **Date:** 2026-03-10
> **Auditor:** Financial Systems Architect & Security Auditor (AI)
> **Scope:** All Xero-related code, API routes, database schema, components, and configuration
> **Branch:** `cursor/financial-systems-xero-audit-9454` (based on `main` with Xero integration)
> **Reference Spec:** `docs/xero-integration.md` v1.0 (2026-03-09)

---

## Executive Summary

The Xero integration is architecturally sound and follows the documented specification closely. The separation of Xero data into dedicated `xero_*` tables, the opt-in tenant model, the idempotent export flow, and the comprehensive audit logging in `xero_export_logs` are well-designed. The OAuth flow works correctly, the token refresh logic is solid, and the invoice export pipeline enforces duplicate prevention via both application-level checks and database constraints.

However, the audit has identified **4 critical issues** that could lead to incorrect financial records, silent data corruption, or security vulnerabilities. The most severe are: (1) OAuth tokens readable by any tenant user via RLS, (2) booking check-in invoice items missing `xero_tax_type`, causing incorrect tax treatment in Xero, (3) Xero API responses stored and used without runtime type validation, risking `"undefined"` literals being persisted as tokens, and (4) the `default_revenue_account_code` and `default_tax_type` settings are configured in the UI but never consumed as fallbacks, meaning items without GL codes will always fail to export rather than using the configured default.

These critical issues should be resolved before production use of the integration.

---

## Critical Issues [🔴 Severity: Critical]

### C1. OAuth Tokens Readable by Any Tenant User via RLS

**Evidence:**
- `supabase/migrations/20260310120000_xero_integration.sql`, lines 37–39
- Policy `xero_connections_tenant_select` uses `USING (public.user_belongs_to_tenant(tenant_id))`

**Issue:**
The `xero_connections` table stores `access_token` and `refresh_token` as plain text columns. The RLS SELECT policy grants read access to **any** user belonging to the tenant — including students, non-admin staff, and any role. While the API routes correctly use the admin client and never return tokens, a user with the Supabase anon key (which is public/publishable) could query the `xero_connections` table directly from client-side code and extract OAuth tokens.

The spec explicitly acknowledges this risk (§3.2): _"the RLS SELECT policy should be further restricted in a follow-up to only return non-token columns to the regular client."_

**Risk:** A malicious or curious tenant user could extract the Xero OAuth tokens and make unauthorised Xero API calls, modify financial data, or exfiltrate sensitive accounting information.

**Remediation:**
Either (a) restrict the SELECT policy to exclude `access_token` and `refresh_token` columns using a security-barrier view, or (b) use Supabase Vault / `pgsodium` to encrypt the token columns at rest and only decrypt via the admin client, or (c) revoke the generic tenant-scoped SELECT policy and create a restricted policy/view that returns only non-sensitive columns (`id`, `tenant_id`, `xero_tenant_name`, `created_at`, `connected_by`).

---

### C2. Booking Check-In Creates Invoice Items Without `xero_tax_type`

**Evidence:**
- `app/api/bookings/[id]/checkin/approve/route.ts`, lines 99–106 (RPC items have no `xero_tax_type`)
- Lines 201–227: post-RPC GL code backfill only updates `gl_code`, never `xero_tax_type`

**Issue:**
When a booking is checked in and approved, the `approve_booking_checkin_atomic` RPC creates invoice items in the database. After the RPC, the API route back-fills `gl_code` on the newly created items by resolving the chargeable type hierarchy and flight type GL codes. However, `xero_tax_type` is **never set** on these items.

When these items are later exported to Xero, `export-invoice.ts` (line 111) maps `null` xero_tax_type to `"NONE"`: `TaxType: item.xero_tax_type ?? "NONE"`. For taxable items (e.g., aircraft hire subject to GST), this results in **zero tax being applied in Xero**, creating an incorrect financial record.

**Risk:** Invoices originating from booking check-ins will have incorrect tax treatment in Xero, leading to GST/VAT discrepancies, potential regulatory non-compliance, and inaccurate financial reporting.

**Remediation:**
In the post-RPC backfill section of `app/api/bookings/[id]/checkin/approve/route.ts`, also resolve and set `xero_tax_type` for each invoice item. For items linked to chargeables, use `chargeables.xero_tax_type`. For synthetic items (aircraft hire, instructor rate), either derive from the chargeable or from the flight type, or fall back to the tenant's `default_tax_type` setting.

---

### C3. Xero API Token Response Not Validated — Risk of Storing `"undefined"` as Token

**Evidence:**
- `lib/xero/client.ts`, `exchangeCodeForTokens()` returns `body` (untyped, could be `null`)
- `lib/xero/client.ts`, `refreshXeroTokens()` returns `body` (untyped, could be `null`)
- `lib/xero/get-xero-client.ts`, line 27: `String(refreshed.access_token)` — if `access_token` is `undefined`, this becomes the string literal `"undefined"`
- `app/api/xero/callback/route.ts`, line 78: `String(tokens.access_token)` — same risk

**Issue:**
Both `exchangeCodeForTokens` and `refreshXeroTokens` parse the Xero response body as JSON and return it without any runtime type validation. The `parseResponseBody` helper (line 20 of `client.ts`) includes `.catch(() => null)`, meaning a malformed JSON response results in `null` being returned. Callers then access properties like `tokens.access_token` on a potentially `null` object, and wrap them in `String()` which converts `undefined` to the string `"undefined"`.

If Xero returns an unexpected response shape (e.g., a 200 with empty body, or changed field names), the system would store `"undefined"` as the access_token and `"undefined"` as the refresh_token, silently corrupting the connection. All subsequent API calls would fail with opaque 401 errors.

**Risk:** Silent connection corruption after token exchange or refresh, with no clear error trail. The stored `"undefined"` string would pass all type checks since it's a non-empty string.

**Remediation:**
Add runtime validation of the token response shape before storing. For example:

```typescript
function validateTokenResponse(body: unknown): XeroTokenResponse {
  if (!body || typeof body !== "object") throw new Error("Empty token response from Xero")
  const b = body as Record<string, unknown>
  if (typeof b.access_token !== "string" || !b.access_token) throw new Error("Missing access_token")
  if (typeof b.refresh_token !== "string" || !b.refresh_token) throw new Error("Missing refresh_token")
  if (typeof b.expires_in !== "number") throw new Error("Missing expires_in")
  return b as unknown as XeroTokenResponse
}
```

---

### C4. `default_revenue_account_code` and `default_tax_type` Settings Are Never Consumed

**Evidence:**
- `lib/settings/xero-settings.ts`: `default_revenue_account_code` and `default_tax_type` defined
- `components/settings/xero-settings-form.tsx`: UI allows setting these values
- `app/api/settings/xero/route.ts`: PATCH endpoint persists these values
- `lib/xero/export-invoice.ts`: **Never reads `xeroSettings`** — does not fall back to defaults

**Issue:**
The Xero Settings UI lets admins configure a "Default revenue account" (GL code) and "Default tax type". These are persisted in `tenant_settings.settings.xero`. However, the invoice export logic in `export-invoice.ts` never reads these settings. If an invoice item has no `gl_code`, the export **hard-fails** with `"Invoice contains items without GL code"` rather than falling back to the configured default.

This means:
1. Admins configure defaults expecting them to work, but they have no effect.
2. Any invoice with an item missing a GL code cannot be exported, even though a default was configured.
3. Same applies to `default_tax_type` — it's stored but never used as a fallback for `null` `xero_tax_type` values.

**Risk:** Misleading UX (admins believe defaults are applied), unnecessary export failures for invoices with missing GL codes, and incorrect tax treatment when `xero_tax_type` is null (defaults to `"NONE"` instead of the configured default).

**Remediation:**
In `export-invoice.ts`, after fetching invoice items, resolve the Xero settings for the tenant. Use `default_revenue_account_code` as a fallback when `item.gl_code` is null, and `default_tax_type` as a fallback when `item.xero_tax_type` is null. Consider making this explicit in the UI (e.g., "Items without a GL code will use this default").

---

## High Priority Issues [🟠 Severity: High]

### H1. No Server-Side Console Logging in Xero Library Functions

**Evidence:**
- `lib/xero/export-invoice.ts`: 0 console.log/error/warn calls
- `lib/xero/sync-contact.ts`: 0 console.log/error/warn calls
- `lib/xero/client.ts`: 0 console.log/error/warn calls
- `lib/xero/sync-accounts.ts`: 0 console.log/error/warn calls
- `lib/xero/get-xero-client.ts`: 0 console.log/error/warn calls
- Only `app/api/xero/disconnect/route.ts` has 1 `console.warn`

**Issue:**
The spec (§11.4) explicitly requires server-side `console.error`/`console.warn` logging for all Xero API interactions, in addition to database logging in `xero_export_logs`. Currently, the lib functions have **zero** console-level logging. If a Xero API call fails, the error is recorded in `xero_export_logs` but produces no output in Vercel function logs or server stdout. This makes production debugging significantly harder since `xero_export_logs` requires a database query to inspect.

**Remediation:**
Add structured `console.error` calls in all catch blocks and failure paths across the Xero library. Example:
```typescript
console.error(`[xero] Export failed for invoice ${invoiceId}`, { tenantId, error: message })
```

---

### H2. Bulk Export Uses `Promise.all` Without Rate Limiting

**Evidence:**
- `app/api/xero/export-invoices/route.ts`, lines 35–37

**Issue:**
The export endpoint processes all invoice IDs with `Promise.all(parsed.data.invoiceIds.map(...))`. Each export involves multiple Xero API calls (contact sync lookup/create + invoice creation = 2–3 calls). Exporting 20+ invoices simultaneously could fire 40–60 concurrent Xero API requests, exceeding Xero's 60-requests-per-minute rate limit.

While the `xeroFetchWithRetry` function handles 429 responses with exponential backoff, hitting the rate limit causes unnecessary delays and retries. If many exports trigger retries, the Vercel function could hit its execution time limit.

**Remediation:**
Process exports sequentially or use a concurrency limiter (e.g., batches of 3–5 at a time):
```typescript
const results = []
for (const invoiceId of parsed.data.invoiceIds) {
  results.push(await exportInvoiceToXero(tenantId, invoiceId, user.id))
}
```

---

### H3. GL Code Resolution Ambiguity Between `chargeables.gl_code` and `chargeable_types.gl_code`

**Evidence:**
- First migration adds `chargeables.gl_code` column
- Second migration (`20260310153000`) adds `chargeable_types.gl_code` column
- `app/invoices/new/actions.ts`, line 148: resolves GL code from `chargeable_types.gl_code`, never from `chargeables.gl_code`
- `app/api/chargeables/route.ts`: `chargeables.gl_code` is not in the create/update schema
- The chargeables GET endpoint does not return `gl_code` from the chargeables table — only from the joined `chargeable_types.gl_code`

**Issue:**
Two GL code columns exist: `chargeables.gl_code` (per-item) and `chargeable_types.gl_code` (per-type). Only the type-level code is used in practice. The per-chargeable `gl_code` column is:
- Never written by any API route
- Never read by invoice creation logic
- A dead column in the current implementation

This creates confusion about the intended data model: should overrides be per-chargeable or per-type? The schema suggests per-chargeable, the code says per-type.

**Remediation:**
Either (a) remove `chargeables.gl_code` if per-type is the intended model, or (b) implement a resolution chain: `chargeables.gl_code` → `chargeable_types.gl_code` → `default_revenue_account_code`, where the first non-null value wins. Document the chosen approach.

---

### H4. `xero_export_logs` Error Entries Missing `response_payload`

**Evidence:**
- `lib/xero/export-invoice.ts`, lines 137–143 (error log insert)
- Compare with lines 118–125 (success log insert with `response_payload: xeroResponse`)

**Issue:**
When an export fails due to a Xero API error, the error log entry includes `error_message` but omits `response_payload`. The actual Xero error response body (which often contains field-level validation details) is lost. This makes it much harder to debug Xero-side rejections, especially for issues like invalid account codes, duplicate invoice numbers, or contact validation failures.

**Remediation:**
In the catch block, if the error is a `XeroApiError`, include `error.body` as the `response_payload`:
```typescript
response_payload: error instanceof XeroApiError ? error.body : null
```

---

### H5. No Token Encryption at Rest

**Evidence:**
- `supabase/migrations/20260310120000_xero_integration.sql`: `access_token text NOT NULL`, `refresh_token text NOT NULL`
- No reference to `pgcrypto`, `pgsodium`, or Supabase Vault in any migration or code
- Spec (§4.6): _"Tokens stored server-side only (encrypted at rest via Supabase column encryption or vault)"_

**Issue:**
The spec requires tokens to be encrypted at rest, but they are stored as plain text. Anyone with database read access (backup access, admin panel, database dump) can read all OAuth tokens. This is a significant gap for a financial integration.

**Remediation:**
Use Supabase Vault (`vault.create_secret()` / `vault.decrypted_secrets`) or `pgsodium` column encryption to encrypt `access_token` and `refresh_token`. The application code would need to decrypt on read (admin client only).

---

### H6. Stale `xero_contacts` Mapping Not Verified on Export

**Evidence:**
- `lib/xero/sync-contact.ts`, lines 18–25: returns immediately if mapping exists
- `lib/xero/export-invoice.ts`, line 99: uses the returned contact ID without verification

**Issue:**
When `syncXeroContact` finds an existing mapping in `xero_contacts`, it returns the cached `xero_contact_id` immediately without checking if the contact still exists in Xero. If the contact was deleted or merged in Xero's UI, the export will send an invoice referencing a non-existent ContactID, causing a Xero API error.

The spec (§7.3) notes: _"If a xero_contacts mapping exists but the Xero contact was deleted in Xero, the export will fail. The retry logic detects this (404 from Xero) and recreates the contact + mapping."_ However, the current implementation does NOT detect 404 errors from invoice creation and does NOT delete/recreate the contact mapping on retry.

**Remediation:**
Add a verification step: when using a cached contact mapping, catch `XeroApiError` with status 400/404 referencing the ContactID during invoice creation. If detected, delete the stale `xero_contacts` mapping and re-run `syncXeroContact` to create a fresh mapping.

---

### H7. `xero_accounts`, `xero_contacts`, and `xero_invoices` Have Overly Permissive RLS `FOR ALL` Policies

**Evidence:**
- `supabase/migrations/20260310120000_xero_integration.sql`:
  - `xero_accounts`: lines 79–82 — `FOR ALL USING (user_belongs_to_tenant)`
  - `xero_contacts`: lines 105–108 — `FOR ALL USING (user_belongs_to_tenant)`
  - `xero_invoices`: lines 132–135 — `FOR ALL USING (user_belongs_to_tenant)`

**Issue:**
The `FOR ALL` policy grants INSERT, UPDATE, and DELETE access to any user in the tenant, including students and non-admin staff. A student with direct Supabase client access could:
- Delete `xero_invoices` records, causing re-export of already-exported invoices
- Modify `xero_accounts` to change GL code mappings
- Delete `xero_contacts` to force re-creation

While the API routes enforce role checks, these policies provide no defense-in-depth at the database level.

**Remediation:**
Split the `FOR ALL` policy into separate SELECT (for all tenant users) and INSERT/UPDATE/DELETE (restricted to admin/owner roles via an `is_tenant_admin()` helper function or equivalent).

---

### H8. `connected_by` Column Never Populated

**Evidence:**
- `supabase/migrations/20260310120000_xero_integration.sql`, line 24: `connected_by uuid REFERENCES public.users(id)`
- `app/api/xero/callback/route.ts`, lines 72–83: upsert does not include `connected_by`

**Issue:**
The `xero_connections` table has a `connected_by` column to record which user initiated the Xero connection. However, the OAuth callback route does not populate this field. The callback validates the state cookie but does not re-authenticate the user from the session.

This is an audit trail gap — there's no record of who connected (or reconnected) Xero.

**Remediation:**
In the callback route, authenticate the current user via `getAuthSession()` and include their `user.id` as `connected_by` in the upsert. Alternatively, encode the user ID in the state payload during the connect step.

---

## Recommendations & Improvements [🟡 Severity: Medium / Low]

### M1. No `updated_at` Trigger on xero_* Tables

**Evidence:** All four tables with `updated_at` columns (`xero_connections`, `xero_accounts`, `xero_contacts`, `xero_invoices`) set `DEFAULT now()` but have no `ON UPDATE` trigger.

**Impact:** `updated_at` always reflects creation time, not the last modification time. This undermines time-based auditing and cache invalidation.

**Recommendation:** Create a shared trigger function and attach it:
```sql
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_xero_connections_updated_at BEFORE UPDATE ON xero_connections
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
-- Repeat for xero_accounts, xero_contacts, xero_invoices
```

---

### M2. Add PKCE to OAuth Flow

**Evidence:** `app/api/xero/connect/route.ts` — no `code_verifier` or `code_challenge` in the auth URL

**Impact:** Without PKCE, the OAuth flow is vulnerable to authorization code interception attacks if the redirect URI is ever compromised or a browser extension intercepts the callback.

**Recommendation:** Generate a `code_verifier`, compute `code_challenge` (S256), include in the auth URL, and store the verifier in the state cookie for use during token exchange.

---

### M3. No Xero API Response Schema Validation

**Evidence:** `lib/xero/client.ts` — all responses cast with `as` without runtime validation

**Impact:** If Xero changes their API response shape (field renames, structure changes), the code would silently process malformed data. For example, `response.Invoices?.[0]?.InvoiceID` returning `undefined` would store `null` as the Xero invoice ID.

**Recommendation:** Add Zod schemas for critical Xero response types (`XeroTokenResponse`, `XeroInvoicesResponse`, `XeroContactsResponse`) and validate before use.

---

### M4. No Daily Rate Limit Tracking

**Evidence:** No counter or tracking mechanism for cumulative Xero API calls per tenant per day.

**Impact:** Xero has a daily API call limit (typically 5,000/day for standard apps). Without tracking, a tenant with high export volume could silently hit the daily limit, causing all API calls to fail for the rest of the day.

**Recommendation:** Add a simple counter (e.g., in-memory or Redis) that tracks API calls per `xero_tenant_id` per day and warns or throttles when approaching the limit.

---

### M5. No Reconciliation/Drift Detection Between Supabase and Xero

**Evidence:** No code exists to compare local `xero_invoices` state with actual Xero invoice state.

**Impact:** If an invoice is voided, approved, or modified in Xero's UI after export, the local state will be stale. The app will continue showing "Exported" for an invoice that was voided in Xero.

**Recommendation:** Implement a periodic reconciliation job (e.g., daily) that fetches exported invoices from Xero and compares status with local records. Flag any drift for operator review.

---

### M6. `xero_export_logs` Has No Retention Policy

**Evidence:** No TTL, archival, or cleanup logic for the `xero_export_logs` table.

**Impact:** The table will grow indefinitely. For active tenants exporting many invoices, this could impact query performance and storage costs over time.

**Recommendation:** Add a scheduled job or policy to archive logs older than N days (e.g., 90 or 365 days).

---

### M7. Debug Endpoint Exposes OAuth Configuration Details

**Evidence:** `app/api/xero/connect/route.ts`, lines 66–80: `?debug=1` returns `client_id`, `redirect_uri`, `scope`, and full `authorize_url`.

**Impact:** While the client secret is not exposed, the client ID and redirect URI are configuration details that could aid an attacker in crafting phishing URLs or testing misconfigured OAuth apps.

**Recommendation:** Either remove the debug endpoint for production or restrict it to `process.env.NODE_ENV === "development"`.

---

### M8. `GlCodeSelect` Component Fetches Accounts on Every Mount

**Evidence:** `components/settings/gl-code-select.tsx` — `useEffect` calls `/api/xero/accounts` on every mount with no caching.

**Impact:** If multiple `GlCodeSelect` components are rendered on the same page (e.g., in a list of chargeables), each triggers an independent API call. This is inefficient and could cause UI flicker.

**Recommendation:** Use Tanstack Query (already in the project's stack) with a shared query key for Xero accounts, enabling automatic caching and deduplication.

---

### M9. Missing Validation of `xero_tax_type` Against Known Xero Tax Types

**Evidence:** `app/api/chargeables/route.ts` — `xero_tax_type` accepts any string up to 40 chars.

**Impact:** Users can enter invalid tax type codes (e.g., "TAX123") which would be stored and later cause Xero API errors at export time.

**Recommendation:** Either validate against a known list of Xero tax types (e.g., `OUTPUT2`, `OUTPUT`, `NONE`, `EXEMPTOUTPUT`, `ZERORATED`) or validate at export time against the connected Xero tenant's tax settings.

---

### M10. Invoices Page Always Fetches Xero Settings (Even for Non-Xero Tenants)

**Evidence:** `lib/invoices/fetch-invoices.ts`, lines 90–93: calls `fetchXeroSettings` for every invoice list fetch.

**Impact:** For tenants without Xero, this is an unnecessary database query on every page load. The `.catch(() => false)` fallback prevents errors, but the extra query adds latency.

**Recommendation:** Pass `xeroEnabled` as a parameter from the page-level server component (which already fetches settings) rather than re-fetching in the data layer.

---

### M11. Idempotency Key Not Tenant-Scoped (Cosmetic)

**Evidence:** `lib/xero/export-invoice.ts`, line 106: `invoice-${invoiceId}`

**Impact:** Xero scopes idempotency keys by the `xero-tenant-id` header, so cross-tenant collisions cannot occur. However, for clarity and defense-in-depth, the key should include the tenant context.

**Recommendation:** Use `tenant-${tenantId}-invoice-${invoiceId}` for explicit scoping.

---

### M12. Type Bug in `tables.ts`

**Evidence:** `lib/types/tables.ts`, line 176: `export type TenantSettingsInsert = Tables["tenant_sets"]["Insert"]` — references `"tenant_sets"` instead of `"tenant_settings"`.

**Impact:** This is a compilation error that would be caught by TypeScript if this type alias is ever imported.

**Recommendation:** Fix to `Tables["tenant_settings"]["Insert"]`.

---

## Supabase Schema Changes Required

| Table | Column/Object | Action | Reason |
|---|---|---|---|
| `xero_connections` | `access_token`, `refresh_token` | **MODIFY** — encrypt via Vault/pgsodium | Tokens stored as plain text; spec requires encryption at rest |
| `xero_connections` | RLS SELECT policy | **MODIFY** — restrict to non-token columns | Any tenant user can currently read OAuth tokens |
| `xero_connections` | `updated_at` | **ADD trigger** | No auto-update trigger; `updated_at` never changes after creation |
| `xero_accounts` | `updated_at` | **ADD trigger** | Same as above |
| `xero_accounts` | RLS `FOR ALL` policy | **MODIFY** — split into SELECT (all) + write (admin only) | Overly permissive; any tenant user can modify |
| `xero_contacts` | `updated_at` | **ADD trigger** | Same as above |
| `xero_contacts` | RLS `FOR ALL` policy | **MODIFY** — split into SELECT (all) + write (admin only) | Same as above |
| `xero_invoices` | `updated_at` | **ADD trigger** | Same as above |
| `xero_invoices` | RLS `FOR ALL` policy | **MODIFY** — split into SELECT (all) + write (admin only) | Same as above |
| `xero_export_logs` | — | **ADD** retention policy / partitioning | Table will grow unboundedly |
| `chargeables` | `gl_code` | **REMOVE** or **document as override** | Dead column — never read or written by any code path. All GL code resolution goes through `chargeable_types.gl_code`. If intended as a per-item override, implement the resolution chain. |
| `invoice_items` | `xero_tax_type` | No DDL change — **code fix needed** | Column exists but is never populated by the booking check-in path |

---

## Positive Findings

### P1. Well-Designed Separation of Concerns
All Xero data lives in dedicated `xero_*` tables. No existing business tables (`invoices`, `users`, `chargeables`) were polluted with Xero-specific columns beyond the GL code and tax type fields, which are semantically appropriate additions.

### P2. Idempotent Export Design
The combination of the `UNIQUE (tenant_id, invoice_id)` constraint on `xero_invoices`, the pending-status lock pattern, and the `Idempotency-Key` header on Xero API calls provides triple-layered duplicate prevention. This is excellent.

### P3. Comprehensive Export Audit Trail
Every export attempt, success, failure, token refresh, contact sync, and connection event is logged in `xero_export_logs` with structured `request_payload` and `response_payload` JSONB columns. The log table has appropriate indexes for efficient querying.

### P4. Clean Opt-In Tenant Architecture
The integration is fully opt-in via `tenant_settings.settings.xero.enabled`. Tenants without Xero see zero UI changes. The conditional rendering pattern (`xeroEnabled ? <Component /> : null`) is consistently applied across all components.

### P5. Robust OAuth State Validation
The connect/callback flow uses a base64url-encoded state parameter containing `tenantId`, `nonce`, and `timestamp`, validated against an httpOnly cookie. This provides solid CSRF protection. The state cookie has appropriate security attributes (`httpOnly`, `secure` in production, `sameSite: lax`, `maxAge: 600`).

### P6. Admin Client Used for Token Operations
All token reads/writes correctly use `createSupabaseAdminClient()` to bypass RLS, ensuring the regular Supabase client never handles tokens. The status endpoint correctly returns only non-sensitive fields.

### P7. Token Refresh with Proactive 5-Minute Window
The `expiresSoon` check in `get-xero-client.ts` refreshes tokens when they expire within 5 minutes, preventing mid-request expiration. Refresh events are logged in `xero_export_logs`.

### P8. GL Code Validation at Export Time
Before sending to Xero, the export logic validates every invoice item's GL code against the cached `xero_accounts` table, ensuring only valid, active account codes are used. This prevents Xero-side rejections.

### P9. Rate Limit Handling with Exponential Backoff
The `xeroFetchWithRetry` function correctly handles HTTP 429 responses with exponential backoff (1s, 2s, 4s) and up to 3 retries. This follows Xero's recommended retry pattern.

### P10. Input Validation with Zod
All API route inputs are validated with Zod schemas before processing. The `bodySchema` in `export-invoices/route.ts` validates UUID format for all invoice IDs. The chargeables route validates field lengths, types, and constraints.

### P11. Invoices Always Exported as DRAFT
The export payload always sets `Status: "DRAFT"`, ensuring no invoice is auto-approved in Xero. This is the correct approach for a one-way sync — the accountant can review and approve in Xero.

### P12. Xero Environment Variables Are Server-Side Only
No `NEXT_PUBLIC_` prefix on any Xero environment variable. The `getXeroEnv()` function throws descriptive errors for missing variables. The client secret is never logged or included in response payloads.

---

## Suggested Next Steps

Prioritised action list for the development team:

### Immediate (Before Next Release)

1. **Fix C3** — Add runtime validation for Xero token responses. This is a one-function fix that prevents silent data corruption.

2. **Fix C4** — Implement default GL code and tax type fallback in `export-invoice.ts`. Read `xeroSettings` and use `default_revenue_account_code` / `default_tax_type` when item-level values are null.

3. **Fix C2** — Add `xero_tax_type` backfill to the booking check-in approval route, alongside the existing `gl_code` backfill.

4. **Fix C1** — Restrict the `xero_connections` RLS SELECT policy. The simplest approach is a view that excludes token columns, used by the regular client, while the admin client accesses the raw table.

### Short-Term (Next 1–2 Sprints)

5. **Fix H2** — Switch bulk export from `Promise.all` to sequential processing or a concurrency limiter.

6. **Fix H1** — Add `console.error`/`console.warn` logging to all Xero library functions.

7. **Fix H4** — Include `response_payload` in error log entries when the error is a `XeroApiError`.

8. **Fix H3** — Resolve the GL code architecture: remove `chargeables.gl_code` or implement the per-item override chain. Document the decision.

9. **Fix H8** — Populate `connected_by` in the OAuth callback.

10. **Implement M1** — Add `updated_at` triggers to all `xero_*` tables.

11. **Fix M12** — Fix the `tenant_sets` typo in `tables.ts`.

### Medium-Term (Next Quarter)

12. **Implement H5** — Encrypt tokens at rest using Supabase Vault.

13. **Fix H7** — Tighten RLS policies on `xero_accounts`, `xero_contacts`, `xero_invoices`.

14. **Fix H6** — Add stale contact detection and re-sync on export failure.

15. **Implement M2** — Add PKCE to the OAuth flow.

16. **Implement M3** — Add Zod validation for Xero API responses.

17. **Implement M7** — Restrict debug endpoint to development.

18. **Implement M8** — Use Tanstack Query for `GlCodeSelect`.

### Long-Term (Future Phases)

19. **Implement M5** — Build a reconciliation job for drift detection.

20. **Implement M4** — Add daily rate limit tracking.

21. **Implement M6** — Add log retention / archival policy.

22. Add webhook support for real-time Xero event handling.

23. Add payment sync (export `invoice_payments` to Xero as payments).

24. Add credit note sync.

25. Implement auto-export on invoice approval (`auto_export_on_approve` setting).

---

*End of Audit Report*
