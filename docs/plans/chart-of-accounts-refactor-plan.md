# Chart of Accounts Refactor Plan

## Executive Summary

This document describes the migration from **manual GL code text inputs** to a **hybrid write-through cache architecture** (Option C) that sources Chart of Accounts data live from Xero while maintaining referential integrity via a local `xero_accounts` table.

### Architecture: Hybrid Write-Through Cache

- **UI**: Fetches accounts live from Xero API → renders searchable `<XeroAccountSelect />` dropdown
- **Persistence**: When a user selects an account, it is upserted into `xero_accounts`, and the referencing table stores the GL code string (validated against the cache)
- **Export**: Invoice export reads `gl_code` from `invoice_items` → maps to `AccountCode` in Xero payload
- **Canonical identifier stored**: `gl_code` (Xero account code string) — used everywhere internally and in Xero payloads

---

## Investigation Findings

### 1. Database Schema (Current)

| Table | GL-Related Columns | Notes |
|---|---|---|
| `xero_accounts` | `id`, `xero_account_id`, `code`, `name`, `type`, `status`, `class`, `tenant_id` | Write-through cache; unique on `(tenant_id, xero_account_id)` |
| `chargeable_types` | `gl_code` (text, nullable) | Default GL code for all chargeables of this type |
| `chargeables` | `gl_code` (text, nullable), `xero_tax_type` | Per-chargeable override (currently unused in business logic) |
| `flight_types` | `aircraft_gl_code` (text, nullable), `instructor_gl_code` (text, nullable) | GL codes for synthetic invoice items |
| `invoice_items` | `gl_code` (text, nullable), `xero_tax_type` | Snapshotted at invoice creation; immutable after export |
| `tenant_settings` | `settings.xero.default_revenue_account_code` | Fallback GL code |

### 2. GL Code Resolution Order

**Invoice creation** (`app/invoices/new/actions.ts`):
1. `chargeable.gl_code` → `chargeable_types.gl_code` → `null`

**Booking check-in** (`app/api/bookings/[id]/checkin/approve/route.ts`):
1. Chargeable items: `chargeable.gl_code` → `chargeable_types.gl_code`
2. Synthetic items: `flight_types.aircraft_gl_code` / `flight_types.instructor_gl_code`

**Invoice export** (`lib/xero/export-invoice.ts`):
1. `invoice_items.gl_code` → `default_revenue_account_code` → error
2. Validates all GL codes exist in `xero_accounts` as ACTIVE

### 3. RPC Functions

- `approve_booking_checkin_atomic` / `create_invoice_atomic`: Create invoices and items. **Do not reference GL codes** — GL/tax backfill happens in application code after the RPC returns.
- No RPC functions directly depend on GL code columns.

### 4. Existing Xero Integration

- `lib/xero/client.ts` → `getAccounts()` fetches all accounts from Xero API
- `lib/xero/sync-accounts.ts` → Syncs REVENUE accounts into `xero_accounts`
- `app/api/xero/accounts/route.ts` → Returns cached accounts from DB
- `app/api/xero/sync-accounts/route.ts` → Triggers manual sync
- `components/settings/gl-code-select.tsx` → Dropdown using cached DB accounts (only used in Xero settings form)

### 5. Components Using Manual GL Code Input

| Component | GL Code Fields | Current Input Type |
|---|---|---|
| `chargeable-types-config.tsx` | `gl_code` | Plain `<Input>` |
| `flight-types-config.tsx` | `aircraft_gl_code`, `instructor_gl_code` | Plain `<Input>` |
| `xero-settings-form.tsx` | `default_revenue_account_code` | `<GlCodeSelect>` (cached DB) |

---

## Implementation Plan

### Phase 1: New API Route for Live Xero Accounts

Create `app/api/xero/chart-of-accounts/route.ts`:
- Fetches accounts live from Xero API
- Falls back to cached `xero_accounts` if Xero API fails
- Filters by account type (optional query param)
- Upserts fetched accounts into `xero_accounts` cache

### Phase 2: Xero Utilities

Create `lib/xero/upsert-account.ts`:
- `upsertXeroAccount(tenantId, account)` — upserts a single account into `xero_accounts`

### Phase 3: Shared UI Component

Create `components/settings/xero-account-select.tsx`:
- `<XeroAccountSelect />` — searchable combobox
- Props: `value`, `onChange`, `accountTypes?`, `disabled?`
- Fetches from `/api/xero/chart-of-accounts`
- Displays: `[Code] — [Name]`
- Returns the account `code` as the selected value

### Phase 4: Component Refactors

1. **Chargeable Types** (`chargeable-types-config.tsx`): Replace `<Input>` with `<XeroAccountSelect />`
2. **Flight Types** (`flight-types-config.tsx`): Replace both GL code `<Input>`s with `<XeroAccountSelect />`
3. **Xero Settings** (`xero-settings-form.tsx`): Replace `<GlCodeSelect>` with `<XeroAccountSelect />`

### Phase 5: Settings Page Update

- Keep "Sync Accounts" as a fallback refresh mechanism
- Update button label and description

### Phase 6: Cleanup

- Deprecate old `<GlCodeSelect>` component
- No database schema changes needed (GL codes remain as text strings for backwards compatibility)

---

## Risk Assessment

| Risk | Mitigation |
|---|---|
| Xero API rate limits | Retry with backoff (existing); cache fallback; staleTime on queries |
| Xero API downtime | Fall back to cached `xero_accounts` table |
| Breaking invoice export | GL codes remain as text strings; export logic unchanged |
| Breaking RPC functions | RPCs don't reference GL codes; no changes needed |
| Data migration | No migration needed — existing GL codes are valid strings |

## Rollback Plan

1. Revert component changes to use plain `<Input>` fields
2. Remove new API route and utility
3. Remove `<XeroAccountSelect />` component
4. No database rollback needed — schema is unchanged
