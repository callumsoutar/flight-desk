# Xero Integration — Technical Specification

> **Version:** 1.0  
> **Date:** 2026-03-09  
> **Status:** Implementation-ready  
> **Project:** Aero Safety (flight-service-pro)  
> **Stack:** Next.js 15 (App Router) + Supabase (PostgreSQL 17) + shadcn/ui + TypeScript

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Terminology & Mapping](#2-terminology--mapping)
3. [Database Changes](#3-database-changes)
4. [Xero OAuth Flow](#4-xero-oauth-flow)
5. [New API Routes](#5-new-api-routes)
6. [Modified Existing Code](#6-modified-existing-code)
7. [Contact Sync Logic](#7-contact-sync-logic)
8. [Invoice Export Flow](#8-invoice-export-flow)
9. [Tenant Opt-In Handling](#9-tenant-opt-in-handling)
10. [UI Changes](#10-ui-changes)
11. [Error Handling & Logging](#11-error-handling--logging)
12. [Environment Variables](#12-environment-variables)
13. [Dependencies](#13-dependencies)
14. [Sequenced Implementation Steps](#14-sequenced-implementation-steps)

---

## 1. Executive Summary

This specification describes adding an opt-in Xero accounting integration to the existing flight school SaaS. The integration allows tenants to:

- Connect/disconnect a Xero organisation via OAuth 2.0
- Sync Xero Chart of Accounts so GL codes are always valid
- Export invoices to Xero as DRAFT (never auto-approved)
- Map local users to Xero contacts (with deduplication)
- View export status on invoices, retry failed exports

**Core principles:**

- Integration data lives in dedicated `xero_*` tables — never mixed into business tables
- Entirely opt-in per tenant — zero impact on tenants that do not enable it
- Tokens stored server-side only (encrypted at rest via Supabase column encryption or vault)
- All exports are idempotent and duplicate-safe
- Exported invoice items are treated as immutable

**What already exists (no changes needed):**

| Concept | Existing Table/Entity | Notes |
|---|---|---|
| Organisations | `tenants` | Already multi-tenant with `tenant_id` scoping |
| Products | `chargeables` | Name, rate, is_taxable, chargeable_type_id |
| Users/Contacts | `users` + `user_directory` view | Linked to tenants via `tenant_users` |
| Invoices | `invoices` | Status enum: draft, pending, paid, overdue, cancelled, refunded |
| Invoice items | `invoice_items` | description, quantity, unit_price, amount, tax_amount, tax_rate |
| Payments | `invoice_payments` + `transactions` | Atomic RPC-based payment recording |
| Settings | `tenant_settings` (JSONB) | Namespaced settings per tenant |

---

## 2. Terminology & Mapping

| Reference Architecture Term | Actual Codebase Equivalent | Decision |
|---|---|---|
| `organizations` | `tenants` | Use existing. No rename. |
| `organization_id` | `tenant_id` | Use existing column naming convention. |
| `products` | `chargeables` | Use existing. The `chargeables` table already has `name`, `rate`, `is_taxable`. It does **not** currently have `gl_code` or `tax_type` — these will be added to `chargeables` (see §3). |
| `users` | `users` + `user_directory` | Use existing. Contact mapping goes in `xero_contacts`. |
| `invoices` | `invoices` | Use existing. No structural changes. |
| `invoice_items` | `invoice_items` | Use existing. Already copies description/rate at invoice time. |
| `integration_settings` | `tenant_settings.settings` (JSONB) | Extend existing JSONB with a `xero` namespace. No new table. |

---

## 3. Database Changes

### 3.1 New Enum Type

```sql
-- xero_export_status: used by xero_invoices and xero_export_logs
CREATE TYPE public.xero_export_status AS ENUM ('pending', 'exported', 'failed');
```

### 3.2 New Table: `xero_connections`

Stores the OAuth credentials for each tenant's Xero connection. One connection per tenant.

```sql
CREATE TABLE public.xero_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  xero_tenant_id text NOT NULL,
  xero_tenant_name text,
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  token_expires_at timestamptz NOT NULL,
  scopes text NOT NULL DEFAULT '',
  connected_by uuid REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT xero_connections_tenant_id_unique UNIQUE (tenant_id)
);

CREATE INDEX idx_xero_connections_tenant_id ON public.xero_connections(tenant_id);

COMMENT ON TABLE public.xero_connections IS
  'Stores Xero OAuth2 tokens per tenant. One active connection per tenant. Tokens must never be exposed client-side.';

-- RLS
ALTER TABLE public.xero_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "xero_connections_tenant_select"
  ON public.xero_connections FOR SELECT
  USING (public.user_belongs_to_tenant(tenant_id));

CREATE POLICY "xero_connections_tenant_insert"
  ON public.xero_connections FOR INSERT
  WITH CHECK (public.user_belongs_to_tenant(tenant_id));

CREATE POLICY "xero_connections_tenant_update"
  ON public.xero_connections FOR UPDATE
  USING (public.user_belongs_to_tenant(tenant_id));

CREATE POLICY "xero_connections_tenant_delete"
  ON public.xero_connections FOR DELETE
  USING (public.user_belongs_to_tenant(tenant_id));
```

**Important:** The `access_token` and `refresh_token` columns contain sensitive credentials. The API routes must use the **admin client** (`createSupabaseAdminClient()`) to read/write these columns, and the RLS SELECT policy should be further restricted in a follow-up to only return non-token columns to the regular client. For V1, RLS is tenant-scoped and the API routes handle field filtering.

### 3.3 New Table: `xero_accounts`

Caches the Xero Chart of Accounts for a tenant. Synced periodically.

```sql
CREATE TABLE public.xero_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  xero_account_id text NOT NULL,
  code text,
  name text NOT NULL,
  type text,
  status text DEFAULT 'ACTIVE',
  class text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT xero_accounts_tenant_xero_id_unique UNIQUE (tenant_id, xero_account_id)
);

CREATE INDEX idx_xero_accounts_tenant_id ON public.xero_accounts(tenant_id);
CREATE INDEX idx_xero_accounts_code ON public.xero_accounts(tenant_id, code);

ALTER TABLE public.xero_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "xero_accounts_tenant_select"
  ON public.xero_accounts FOR SELECT
  USING (public.user_belongs_to_tenant(tenant_id));

CREATE POLICY "xero_accounts_tenant_manage"
  ON public.xero_accounts FOR ALL
  USING (public.user_belongs_to_tenant(tenant_id));
```

### 3.4 New Table: `xero_contacts`

Maps local `users` to Xero contacts. One mapping per user per tenant.

```sql
CREATE TABLE public.xero_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  xero_contact_id text NOT NULL,
  xero_contact_name text,
  last_synced_at timestamptz DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT xero_contacts_tenant_user_unique UNIQUE (tenant_id, user_id)
);

CREATE INDEX idx_xero_contacts_tenant_id ON public.xero_contacts(tenant_id);
CREATE INDEX idx_xero_contacts_user_id ON public.xero_contacts(user_id);

ALTER TABLE public.xero_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "xero_contacts_tenant_select"
  ON public.xero_contacts FOR SELECT
  USING (public.user_belongs_to_tenant(tenant_id));

CREATE POLICY "xero_contacts_tenant_manage"
  ON public.xero_contacts FOR ALL
  USING (public.user_belongs_to_tenant(tenant_id));
```

### 3.5 New Table: `xero_invoices`

Maps local invoices to Xero invoices. Prevents duplicate exports.

```sql
CREATE TABLE public.xero_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  xero_invoice_id text,
  export_status public.xero_export_status NOT NULL DEFAULT 'pending',
  exported_at timestamptz,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT xero_invoices_tenant_invoice_unique UNIQUE (tenant_id, invoice_id)
);

CREATE INDEX idx_xero_invoices_tenant_id ON public.xero_invoices(tenant_id);
CREATE INDEX idx_xero_invoices_invoice_id ON public.xero_invoices(invoice_id);
CREATE INDEX idx_xero_invoices_export_status ON public.xero_invoices(tenant_id, export_status);

ALTER TABLE public.xero_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "xero_invoices_tenant_select"
  ON public.xero_invoices FOR SELECT
  USING (public.user_belongs_to_tenant(tenant_id));

CREATE POLICY "xero_invoices_tenant_manage"
  ON public.xero_invoices FOR ALL
  USING (public.user_belongs_to_tenant(tenant_id));
```

### 3.6 New Table: `xero_export_logs`

Audit trail for every export attempt. Essential for debugging.

```sql
CREATE TABLE public.xero_export_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  action text NOT NULL,
  request_payload jsonb,
  response_payload jsonb,
  status text NOT NULL,
  error_message text,
  initiated_by uuid REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_xero_export_logs_tenant_id ON public.xero_export_logs(tenant_id);
CREATE INDEX idx_xero_export_logs_invoice_id ON public.xero_export_logs(invoice_id);
CREATE INDEX idx_xero_export_logs_created_at ON public.xero_export_logs(tenant_id, created_at DESC);

ALTER TABLE public.xero_export_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "xero_export_logs_tenant_select"
  ON public.xero_export_logs FOR SELECT
  USING (public.user_belongs_to_tenant(tenant_id));

CREATE POLICY "xero_export_logs_tenant_insert"
  ON public.xero_export_logs FOR INSERT
  WITH CHECK (public.user_belongs_to_tenant(tenant_id));
```

### 3.7 Column Additions to Existing Tables

#### 3.7.1 `chargeables` — Add `gl_code` and `xero_tax_type`

These allow mapping each chargeable item to a Xero account code and tax type.

```sql
ALTER TABLE public.chargeables
  ADD COLUMN gl_code text,
  ADD COLUMN xero_tax_type text;

COMMENT ON COLUMN public.chargeables.gl_code IS
  'Xero Chart of Accounts code (e.g. "4200"). Validated against xero_accounts at export time.';
COMMENT ON COLUMN public.chargeables.xero_tax_type IS
  'Xero tax type identifier (e.g. "OUTPUT2", "NONE"). Used when building Xero invoice line items.';
```

#### 3.7.2 `invoice_items` — Add `gl_code` and `xero_tax_type`

Copied from `chargeables` at invoice creation time — immutable once set. This ensures accounting records are never retroactively changed.

```sql
ALTER TABLE public.invoice_items
  ADD COLUMN gl_code text,
  ADD COLUMN xero_tax_type text;

COMMENT ON COLUMN public.invoice_items.gl_code IS
  'GL code snapshotted from chargeable at invoice creation. Immutable after export.';
COMMENT ON COLUMN public.invoice_items.xero_tax_type IS
  'Tax type snapshotted from chargeable at invoice creation. Immutable after export.';
```

### 3.8 No Changes Required

The following tables require **no changes**:

- `tenants` — already serves as the organisation table
- `users` / `user_directory` — Xero IDs stored in `xero_contacts`, not here
- `invoices` — Xero IDs stored in `xero_invoices`, not here
- `tenant_users` — no changes
- `tenant_settings` — existing JSONB structure is extended (see §9), no DDL needed
- `transactions` — no changes
- `invoice_payments` — Xero payment sync is deferred to a future phase

### 3.9 Summary of All Database Changes

| Change Type | Object | Action |
|---|---|---|
| New enum | `xero_export_status` | Create |
| New table | `xero_connections` | Create with RLS |
| New table | `xero_accounts` | Create with RLS |
| New table | `xero_contacts` | Create with RLS |
| New table | `xero_invoices` | Create with RLS |
| New table | `xero_export_logs` | Create with RLS |
| Alter table | `chargeables` | Add `gl_code`, `xero_tax_type` columns |
| Alter table | `invoice_items` | Add `gl_code`, `xero_tax_type` columns |

---

## 4. Xero OAuth Flow

### 4.1 Overview

Xero uses OAuth 2.0 with PKCE. The flow is:

1. Admin clicks "Connect to Xero" in tenant settings
2. Server generates auth URL with state parameter (encodes `tenantId`)
3. User is redirected to Xero consent page
4. Xero redirects back to `/api/xero/callback` with authorization code
5. Server exchanges code for tokens, stores in `xero_connections`
6. User is redirected back to settings page

### 4.2 Connect Endpoint

**`GET /api/xero/connect`**

- Auth: owner/admin only
- Generates a cryptographically random `state` value, stores it in an httpOnly cookie
- State payload: `{ tenantId, nonce, timestamp }`
- Redirects to: `https://login.xero.com/identity/connect/authorize`
- Scopes: `openid profile email accounting.invoices accounting.contacts accounting.settings.read offline_access`

### 4.3 Callback Endpoint

**`GET /api/xero/callback`**

- Validates `state` against cookie (CSRF protection)
- Exchanges authorization `code` for tokens via `POST https://identity.xero.com/connect/token`
- Calls `GET https://api.xero.com/connections` to get the Xero tenant ID
- If multiple Xero organisations, uses the first one (or shows selection UI in a future phase)
- Upserts into `xero_connections` using the admin client
- Logs the connection event in `xero_export_logs` (action: `connect`)
- Sets `tenant_settings.settings.xero.enabled = true` and `xero.connected_at = now()`
- Redirects to `/settings` with `?tab=integrations&xero=connected`

### 4.4 Disconnect Endpoint

**`POST /api/xero/disconnect`**

- Auth: owner/admin only
- Revokes the Xero token (best-effort call to Xero revocation endpoint)
- Deletes the row from `xero_connections`
- Sets `tenant_settings.settings.xero.enabled = false`
- Logs the disconnection event in `xero_export_logs` (action: `disconnect`)

### 4.5 Token Refresh

**`lib/xero/get-xero-client.ts`**

A server-side utility that:

1. Reads `xero_connections` for the given `tenantId` using the admin client
2. If `token_expires_at` is within 5 minutes, refreshes the token via `POST https://identity.xero.com/connect/token` with `grant_type=refresh_token`
3. Updates `access_token`, `refresh_token`, `token_expires_at` in the database
4. Returns a configured Xero API client instance (or raw access token + xero tenant ID)
5. If refresh fails (e.g., user revoked access in Xero), marks the connection as broken and throws a typed error

This utility is called at the start of every Xero API interaction.

### 4.6 Token Storage Security

- Tokens are stored in `xero_connections` which has RLS enabled
- All token reads/writes go through the admin client to bypass user-level RLS
- API routes never return tokens to the client
- The GET connection-status endpoint returns only: `connected: boolean`, `xero_tenant_name`, `connected_at`

---

## 5. New API Routes

All new routes follow the existing pattern: `createSupabaseServerClient()` → `getAuthSession()` → role check → tenant-scoped logic.

### 5.1 Xero OAuth Routes

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/xero/connect` | owner/admin | Initiates OAuth flow, redirects to Xero |
| GET | `/api/xero/callback` | (cookie-validated) | Handles OAuth callback, stores tokens |
| POST | `/api/xero/disconnect` | owner/admin | Revokes tokens, deletes connection |
| GET | `/api/xero/status` | staff (owner/admin/instructor) | Returns connection status for current tenant |

#### `GET /api/xero/status`

**Response:**
```json
{
  "connected": true,
  "xero_tenant_name": "My Flight School Ltd",
  "connected_at": "2026-03-09T10:00:00Z",
  "enabled": true
}
```

### 5.2 Xero Account Sync Routes

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/xero/sync-accounts` | owner/admin | Fetches Chart of Accounts from Xero, upserts `xero_accounts` |
| GET | `/api/xero/accounts` | staff | Lists cached `xero_accounts` for dropdown UI |

#### `POST /api/xero/sync-accounts`

**Logic:**
1. Get Xero client (auto-refreshes token)
2. `GET https://api.xero.com/api.xro/2.0/Accounts` with type filter for REVENUE accounts
3. Upsert into `xero_accounts` (match on `tenant_id` + `xero_account_id`)
4. Mark accounts no longer returned by Xero as `status = 'ARCHIVED'`
5. Log sync action in `xero_export_logs`

**Response:**
```json
{ "synced": 12, "archived": 1 }
```

#### `GET /api/xero/accounts`

**Response:**
```json
{
  "accounts": [
    { "id": "uuid", "xero_account_id": "abc", "code": "4000", "name": "Flight Training Revenue", "type": "REVENUE", "status": "ACTIVE" },
    { "id": "uuid", "xero_account_id": "def", "code": "4200", "name": "Trial Flights", "type": "REVENUE", "status": "ACTIVE" }
  ]
}
```

### 5.3 Invoice Export Routes

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/xero/export-invoices` | owner/admin/instructor | Exports selected invoices to Xero |
| POST | `/api/xero/retry-export` | owner/admin/instructor | Retries a failed export |
| GET | `/api/xero/export-status/[invoiceId]` | staff | Gets Xero export status for a single invoice |

#### `POST /api/xero/export-invoices`

**Input:**
```json
{
  "invoiceIds": ["uuid1", "uuid2"]
}
```

**Logic:** (See §8 for full flow)

**Response (success):**
```json
{
  "results": [
    { "invoiceId": "uuid1", "status": "exported", "xeroInvoiceId": "xero-uuid" },
    { "invoiceId": "uuid2", "status": "skipped", "reason": "already_exported" }
  ]
}
```

**Response (partial failure):**
```json
{
  "results": [
    { "invoiceId": "uuid1", "status": "exported", "xeroInvoiceId": "xero-uuid" },
    { "invoiceId": "uuid2", "status": "failed", "error": "GL code 9999 not found in Xero accounts" }
  ]
}
```

#### `POST /api/xero/retry-export`

**Input:**
```json
{ "invoiceId": "uuid" }
```

**Logic:**
1. Validate the invoice exists and has `xero_invoices.export_status = 'failed'`
2. Delete the failed `xero_invoices` row
3. Re-run the export flow for that single invoice
4. Return the result

### 5.4 Contact Sync Route

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/xero/sync-contact` | (internal only, called during export) | Ensures a user exists as a Xero contact |

This is not a standalone user-facing route. It is a shared server-side function (`lib/xero/sync-contact.ts`) called internally during the invoice export flow.

### 5.5 Xero Export Logs Route

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/xero/export-logs` | owner/admin | Returns recent export logs for debugging |

**Query params:** `?limit=50&invoiceId=uuid` (optional filter)

**Response:**
```json
{
  "logs": [
    {
      "id": "uuid",
      "invoice_id": "uuid",
      "action": "export_invoice",
      "status": "success",
      "error_message": null,
      "created_at": "2026-03-09T10:00:00Z"
    }
  ]
}
```

### 5.6 Xero Settings Route

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/settings/xero` | owner/admin | Get Xero integration settings |
| PATCH | `/api/settings/xero` | owner/admin | Update Xero integration settings |

This follows the exact same pattern as `app/api/settings/invoicing/route.ts`.

**PATCH Input:**
```json
{
  "xero": {
    "default_revenue_account_code": "4000",
    "default_tax_type": "OUTPUT2",
    "auto_export_on_approve": false
  }
}
```

---

## 6. Modified Existing Code

### 6.1 Files to Modify

| File | Change | Why |
|---|---|---|
| `lib/types/database.ts` | Regenerate after migration | New tables and columns need TypeScript types |
| `lib/schema/generated.ts` | Regenerate (`npm run schema:generate`) | Zod schemas for new tables |
| `lib/types/tables.ts` | Add row/insert/update type aliases for new tables | Consistency with existing pattern |
| `lib/types/index.ts` | Re-export new table types | Consistency |
| `app/invoices/new/actions.ts` | Copy `gl_code` and `xero_tax_type` from `chargeables` into `invoice_items` during creation | Immutable GL code snapshot |
| `components/invoices/invoices-table.tsx` | Add "Xero Status" column (conditional on integration enabled) | Show export status in list |
| `components/invoices/invoice-detail-client.tsx` | Add Xero export status badge and "Export to Xero" / "Retry" / "View in Xero" buttons | Invoice detail actions |
| `components/invoices/invoice-view-actions.tsx` | Add Xero export action button | Quick actions menu |
| `components/settings/settings-page-client.tsx` | Add "Integrations" tab to settings tabs array | New settings tab |
| `app/settings/page.tsx` | Fetch Xero connection status, pass to settings client | Data for integrations tab |
| `lib/settings/invoicing-settings.ts` | No change — Xero settings are separate | — |
| `lib/invoices/fetch-invoices.ts` | Optionally join `xero_invoices` to return export status per invoice | Show status in table |
| `lib/types/invoices.ts` | Extend `InvoiceWithRelations` to include optional `xero_export_status` | Type safety |
| `components/settings/charges-tab.tsx` | Add GL code and tax type columns/fields to chargeables management | Configure GL codes |
| `app/api/chargeables/route.ts` | Accept `gl_code` and `xero_tax_type` in POST/PATCH | Save GL codes |

### 6.2 Detailed Change: `app/invoices/new/actions.ts`

In the `createInvoiceInternal` function, after resolving chargeables and calculating amounts, add the GL code and tax type to each normalized item:

```typescript
// Current:
const normalizedItems = payload.items.map((item) => {
  const chargeable = chargeableMap.get(item.chargeableId)
  // ... calculate amounts ...
  return {
    chargeable_id: chargeable.id,
    description: chargeable.name,
    // ... existing fields ...
  }
})

// Modified — add these two fields:
return {
  chargeable_id: chargeable.id,
  description: chargeable.name,
  gl_code: chargeable.gl_code ?? null,          // NEW
  xero_tax_type: chargeable.xero_tax_type ?? null, // NEW
  // ... rest unchanged ...
}
```

Also update the `chargeables` select query to include `gl_code, xero_tax_type`:

```typescript
// Current:
.select("id, name, is_taxable")

// Modified:
.select("id, name, is_taxable, gl_code, xero_tax_type")
```

### 6.3 Detailed Change: `lib/invoices/fetch-invoices.ts`

Add an optional left join to `xero_invoices` when the tenant has Xero enabled:

```typescript
// After fetching invoices, if xeroEnabled:
const { data: xeroStatuses } = await supabase
  .from("xero_invoices")
  .select("invoice_id, export_status, xero_invoice_id, exported_at")
  .eq("tenant_id", tenantId)
  .in("invoice_id", invoiceIds)

// Merge into invoice objects
```

### 6.4 Detailed Change: `components/invoices/invoices-table.tsx`

Add a conditional "Xero" column after the "Status" column:

```typescript
// Only shown when xeroEnabled prop is true
{
  id: "xero_status",
  header: "Xero",
  cell: ({ row }) => {
    const xeroStatus = row.original.xero_export_status
    if (!xeroStatus) return <span className="text-muted-foreground">—</span>
    // Badge: exported (green), pending (yellow), failed (red)
  },
}
```

### 6.5 Detailed Change: Settings Page

Add an "Integrations" tab to `components/settings/settings-page-client.tsx`:

```typescript
// Add to tabs array:
{ id: "integrations", label: "Integrations", icon: IconPlugConnected }

// Add tab content:
<Tabs.Content value="integrations">
  <IntegrationsTab
    xeroConnectionStatus={xeroConnectionStatus}
    xeroSettings={xeroSettings}
  />
</Tabs.Content>
```

---

## 7. Contact Sync Logic

### 7.1 Strategy

When exporting an invoice to Xero, the system must ensure the invoice's user (bill-to) exists as a Xero contact.

### 7.2 Flow: `lib/xero/sync-contact.ts`

```
syncXeroContact(adminClient, xeroClient, tenantId, userId, xeroTenantId)
```

1. **Check local mapping:** Query `xero_contacts` for `(tenant_id, user_id)`
2. **If mapping exists:** Return the `xero_contact_id` immediately
3. **If no mapping:**
   a. Fetch user details from `user_directory` (first_name, last_name, email, phone)
   b. Search Xero contacts by email: `GET /api.xro/2.0/Contacts?where=EmailAddress="{email}"`
   c. **If Xero contact found (email match):** Use that contact's ID → create `xero_contacts` mapping
   d. **If no Xero contact found:** Create a new Xero contact:
      ```json
      {
        "Name": "First Last",
        "FirstName": "First",
        "LastName": "Last",
        "EmailAddress": "email@example.com",
        "Phones": [{ "PhoneType": "MOBILE", "PhoneNumber": "+6421..." }]
      }
      ```
   e. Store the Xero contact ID → create `xero_contacts` mapping
4. **Return** `xero_contact_id`

### 7.3 Deduplication Strategy

- **Primary key:** Email address is the deduplication key for Xero contacts
- **Collision handling:** If a Xero contact with the same email already exists, the system uses that contact rather than creating a duplicate
- **Name updates:** If the local user's name differs from the Xero contact's name, the system does NOT update the Xero contact (to avoid overwriting manual changes in Xero). Name sync is one-directional at creation time only.
- **Re-sync:** If a `xero_contacts` mapping exists but the Xero contact was deleted in Xero, the export will fail. The retry logic detects this (404 from Xero) and recreates the contact + mapping.

---

## 8. Invoice Export Flow

### 8.1 Step-by-Step Flow

When the user clicks "Export to Xero" (for one or more invoices):

```
POST /api/xero/export-invoices
{ "invoiceIds": ["uuid1", "uuid2"] }
```

**For each invoice:**

1. **Auth & validation:**
   - Verify user is staff (owner/admin/instructor)
   - Verify tenant has an active Xero connection (`xero_connections` row exists)

2. **Duplicate check:**
   - Query `xero_invoices` for this `(tenant_id, invoice_id)`
   - If `export_status = 'exported'` → **skip** (return `already_exported`)
   - If `export_status = 'pending'` → **skip** (export in progress)
   - If `export_status = 'failed'` → allow re-export (delete the failed row first)

3. **Create pending record:**
   - Insert into `xero_invoices` with `export_status = 'pending'`
   - This acts as a lock to prevent concurrent duplicate exports

4. **Fetch invoice data:**
   - Fetch from `invoices` + `invoice_items` (only non-deleted items)
   - Invoice must be in `pending` or `paid` status to export (not `draft` or `cancelled`)

5. **Validate GL codes:**
   - For each `invoice_item`, check that `gl_code` is not null
   - Validate each `gl_code` exists in `xero_accounts` for this tenant with `status = 'ACTIVE'`
   - If any GL code is invalid → **fail** with descriptive error

6. **Ensure contact exists:**
   - Call `syncXeroContact()` (§7) for the invoice's `user_id`
   - Obtain the `xero_contact_id`

7. **Build Xero payload:**
   ```json
   {
     "Type": "ACCREC",
     "Contact": { "ContactID": "{xero_contact_id}" },
     "Date": "{issue_date}",
     "DueDate": "{due_date}",
     "InvoiceNumber": "{invoice_number}",
     "Reference": "{reference}",
     "Status": "DRAFT",
     "LineItems": [
       {
         "Description": "{description}",
         "Quantity": {quantity},
         "UnitAmount": {unit_price},
         "AccountCode": "{gl_code}",
         "TaxType": "{xero_tax_type}",
         "LineAmount": {amount}
       }
     ]
   }
   ```

8. **Send to Xero:**
   - `PUT https://api.xro/2.0/Invoices` with idempotency header:
     `Idempotency-Key: invoice-{invoice_id}`
   - Always export as `DRAFT` — never auto-approve

9. **Log the request:**
   - Insert into `xero_export_logs`:
     - `action`: `export_invoice`
     - `request_payload`: the Xero payload (with tokens redacted)
     - `response_payload`: Xero's response
     - `status`: `success` or `error`
     - `error_message`: null or error details
     - `initiated_by`: current user ID

10. **Update mapping:**
    - On success: update `xero_invoices` → `export_status = 'exported'`, `xero_invoice_id = response.InvoiceID`, `exported_at = now()`
    - On failure: update `xero_invoices` → `export_status = 'failed'`, `error_message = ...`

11. **Return result** for this invoice

### 8.2 Idempotency

- The `Idempotency-Key: invoice-{invoice_id}` header ensures that if the same export request is retried (e.g., due to network timeout), Xero will not create a duplicate invoice
- The `xero_invoices` table with its `UNIQUE (tenant_id, invoice_id)` constraint provides application-level duplicate prevention
- The `pending` status acts as a lock: a second concurrent request will see `pending` and skip

### 8.3 Invoice Eligibility

An invoice can only be exported to Xero if:

- Invoice `status` is `pending`, `paid`, or `overdue` (NOT `draft`, `cancelled`, or `refunded`)
- The tenant has an active Xero connection
- The invoice has not already been successfully exported
- All invoice items have valid GL codes

### 8.4 Immutability

Once an invoice has been exported to Xero (`export_status = 'exported'`):

- The `invoice_items` `gl_code` and `xero_tax_type` fields must not be changed
- The invoice should not be editable in the UI (already enforced: only drafts are editable)
- If the invoice needs correction, it should be voided in Xero and a new invoice created

---

## 9. Tenant Opt-In Handling

### 9.1 Settings Structure

Xero integration settings are stored in `tenant_settings.settings` JSONB under a `xero` namespace:

```json
{
  "invoice_prefix": "INV",
  "default_invoice_due_days": 7,
  "xero": {
    "enabled": false,
    "connected_at": null,
    "default_revenue_account_code": null,
    "default_tax_type": null,
    "auto_export_on_approve": false
  }
}
```

### 9.2 Settings Type Definition

New file: `lib/settings/xero-settings.ts`

```typescript
export type XeroSettings = {
  enabled: boolean
  connected_at: string | null
  default_revenue_account_code: string | null
  default_tax_type: string | null
  auto_export_on_approve: boolean
}

export const DEFAULT_XERO_SETTINGS: XeroSettings = {
  enabled: false,
  connected_at: null,
  default_revenue_account_code: null,
  default_tax_type: null,
  auto_export_on_approve: false,
}

export function resolveXeroSettings(settings: Json | null | undefined): XeroSettings {
  // Same pattern as resolveInvoicingSettings()
}
```

### 9.3 How Opt-In Works

1. **Not connected (default):** `xero.enabled = false`. All Xero UI elements are hidden. No Xero API calls are made. Zero impact.
2. **Connected:** After OAuth flow completes, `xero.enabled = true`. Xero UI elements appear in invoices and settings.
3. **Disconnected:** Admin disconnects → `xero.enabled = false`. UI elements disappear. Existing `xero_invoices` mappings are preserved for audit (but marked read-only).

### 9.4 How the UI Checks

A new hook or utility:

```typescript
// lib/xero/use-xero-status.ts (or passed as prop from server component)
export function isXeroEnabled(settings: Json | null | undefined): boolean {
  const xero = resolveXeroSettings(settings?.xero)
  return xero.enabled
}
```

Server components fetch `tenant_settings.settings` (already done for invoicing settings) and pass `xeroEnabled: boolean` as a prop. Client components conditionally render Xero-related UI elements.

---

## 10. UI Changes

### 10.1 New Components

| Component | Path | Description |
|---|---|---|
| `IntegrationsTab` | `components/settings/integrations-tab.tsx` | Settings tab: Xero connection card, connect/disconnect buttons, sync accounts, default GL code/tax type |
| `XeroConnectionCard` | `components/settings/xero-connection-card.tsx` | Card showing connection status, "Connect to Xero" or "Disconnect" button |
| `XeroSettingsForm` | `components/settings/xero-settings-form.tsx` | Default revenue account dropdown, default tax type, auto-export toggle |
| `XeroExportButton` | `components/invoices/xero-export-button.tsx` | "Export to Xero" button with loading state, shown on invoice detail |
| `XeroStatusBadge` | `components/invoices/xero-status-badge.tsx` | Badge component: "Exported", "Pending", "Failed", or nothing |
| `XeroBulkExportButton` | `components/invoices/xero-bulk-export-button.tsx` | Button in invoices table toolbar for batch export |
| `GlCodeSelect` | `components/settings/gl-code-select.tsx` | Dropdown to select from cached `xero_accounts` |

### 10.2 Modified Pages/Components

#### Settings Page (`/settings`)

- Add "Integrations" tab (7th tab after Memberships)
- Tab contains:
  - **Xero Connection Card:**
    - Not connected state: "Connect to Xero" button with Xero logo, brief description
    - Connected state: Shows Xero org name, connected date, "Disconnect" button, "Sync Accounts" button
  - **Xero Settings** (only shown when connected):
    - Default Revenue Account: dropdown from `xero_accounts`
    - Default Tax Type: dropdown (OUTPUT2, NONE, etc.)
    - Auto-export on Approve: toggle (future feature, default off)
  - **Sync Status:**
    - Last accounts sync time
    - Number of accounts cached

#### Invoices List Page (`/invoices`)

- When Xero is enabled, add a "Xero" column in the invoices table showing export status badges
- Add "Export to Xero" button in the table toolbar (only visible when invoices are selected — future: add row selection)
- For V1: individual export from invoice detail page

#### Invoice Detail Page (`/invoices/[id]`)

- Add Xero status section below the document view (or in the toolbar):
  - **Not exported:** "Export to Xero" button (only for pending/paid/overdue invoices)
  - **Exported:** Green badge "Exported to Xero" with date, "View in Xero" link (opens `https://go.xero.com/AccountsReceivable/View.aspx?InvoiceID={xero_invoice_id}`)
  - **Failed:** Red badge "Export Failed" with error message, "Retry Export" button
  - **Pending:** Yellow badge "Exporting..." (shown briefly during export)

#### Charges Tab in Settings (`/settings` → Charges)

- Add "GL Code" and "Tax Type" columns to the chargeables table/form
- GL Code: dropdown populated from `xero_accounts` (or free text if Xero not connected)
- Tax Type: dropdown with common Xero tax types

### 10.3 UI Conditional Rendering Pattern

All Xero UI elements must check `xeroEnabled` prop/context:

```tsx
// Pattern used throughout:
{xeroEnabled ? (
  <XeroStatusBadge status={invoice.xero_export_status} />
) : null}
```

Tenants without Xero enabled will see zero changes to their UI.

---

## 11. Error Handling & Logging

### 11.1 Export Log Structure

Every Xero API interaction is logged in `xero_export_logs`:

| Column | Content |
|---|---|
| `action` | `connect`, `disconnect`, `export_invoice`, `retry_export`, `sync_accounts`, `sync_contact`, `refresh_token` |
| `status` | `success`, `error`, `skipped` |
| `request_payload` | JSONB of the request sent to Xero (tokens redacted) |
| `response_payload` | JSONB of Xero's response (truncated to first 10KB) |
| `error_message` | Human-readable error description |
| `initiated_by` | UUID of the user who triggered the action |

### 11.2 Error Categories

| Error | Handling | User Message |
|---|---|---|
| Token expired & refresh fails | Mark connection as broken, show reconnect prompt | "Your Xero connection has expired. Please reconnect." |
| Invalid GL code | Fail export for that invoice, show which GL code is invalid | "GL code '9999' is not a valid Xero account." |
| Xero rate limit (429) | Retry with exponential backoff (up to 3 retries) | "Xero is temporarily unavailable. Export will retry automatically." |
| Xero API error (500) | Log, mark as failed, allow manual retry | "Xero returned an error. Please try again." |
| Contact creation fails | Fail export, log error | "Could not create contact in Xero for {name}." |
| Network error | Retry once, then fail | "Could not connect to Xero. Please check your connection." |
| Duplicate invoice in Xero | Skip (idempotency key handles this) | "Invoice already exists in Xero." |

### 11.3 Retry Logic

- **Automatic retries:** Rate limit (429) and transient network errors get up to 3 automatic retries with exponential backoff (1s, 2s, 4s)
- **Manual retry:** Failed exports can be retried via the "Retry Export" button, which calls `POST /api/xero/retry-export`
- **No auto-retry queue:** V1 does not implement a background job queue. Retries are manual or triggered by the auto-export-on-approve feature (future)

### 11.4 Server-Side Logging

In addition to `xero_export_logs` in the database, use `console.error` / `console.warn` for server-side logs that appear in Supabase Edge Function logs or Vercel function logs:

```typescript
console.error(`[xero] Export failed for invoice ${invoiceId}: ${error.message}`, {
  tenantId,
  invoiceId,
  xeroResponse: error.response,
})
```

---

## 12. Environment Variables

Add to `.env.local` (and document in PR):

```env
# Xero OAuth 2.0 credentials (from Xero Developer Portal)
XERO_CLIENT_ID=your_client_id
XERO_CLIENT_SECRET=your_client_secret
XERO_REDIRECT_URI=http://localhost:3000/api/xero/callback

# Optional: override scopes if your app gets "Invalid scope for client".
# Default (apps created Mar 2026+ use granular scopes):
#   openid profile email accounting.invoices accounting.contacts accounting.settings.read offline_access
# XERO_SCOPES=openid profile email accounting.invoices accounting.contacts accounting.settings.read offline_access
```

These are **server-side only** — no `NEXT_PUBLIC_` prefix.

Add a utility file `lib/xero/env.ts`:

```typescript
export function getXeroEnv() {
  const clientId = process.env.XERO_CLIENT_ID
  const clientSecret = process.env.XERO_CLIENT_SECRET
  const redirectUri = process.env.XERO_REDIRECT_URI

  if (!clientId) throw new Error("Missing XERO_CLIENT_ID")
  if (!clientSecret) throw new Error("Missing XERO_CLIENT_SECRET")
  if (!redirectUri) throw new Error("Missing XERO_REDIRECT_URI")

  return { clientId, clientSecret, redirectUri }
}
```

---

## 13. Dependencies

### 13.1 NPM Packages

| Package | Purpose | Version |
|---|---|---|
| `xero-node` | Official Xero SDK for Node.js | Latest (^6.x) |

Install: `npm install xero-node`

**Alternative (lighter weight):** Instead of the full Xero SDK, use plain `fetch` calls to the Xero REST API. This avoids a large dependency and gives full control over request/response handling. **Recommended approach for V1:** Use raw fetch with typed helpers, since the integration surface is small (invoices, contacts, accounts).

### 13.2 New Internal Modules

| Path | Purpose |
|---|---|
| `lib/xero/env.ts` | Xero environment variables |
| `lib/xero/client.ts` | Xero API client with token management |
| `lib/xero/get-xero-client.ts` | Token refresh and client instantiation |
| `lib/xero/sync-contact.ts` | Contact sync/create logic |
| `lib/xero/export-invoice.ts` | Single invoice export logic |
| `lib/xero/types.ts` | Xero API request/response types |
| `lib/settings/xero-settings.ts` | Xero settings type and resolver |

---

## 14. Sequenced Implementation Steps

Each step is a discrete, testable unit of work. Complete each step fully before moving to the next.

---

### Step 1: Database Migration — New Tables and Columns

**What:** Run the migration to create all new tables, enum, columns, indexes, and RLS policies.

**Files created/modified:**
- `supabase/migrations/YYYYMMDD_xero_integration.sql` — single migration file with all DDL from §3

**Acceptance criteria:**
- [ ] All 5 new tables exist: `xero_connections`, `xero_accounts`, `xero_contacts`, `xero_invoices`, `xero_export_logs`
- [ ] New enum `xero_export_status` exists with values `pending`, `exported`, `failed`
- [ ] `chargeables` has new columns `gl_code` and `xero_tax_type`
- [ ] `invoice_items` has new columns `gl_code` and `xero_tax_type`
- [ ] All tables have RLS enabled with tenant-scoped policies
- [ ] All indexes are created
- [ ] `npm run schema:generate` succeeds (regenerate `lib/schema/generated.ts`)
- [ ] `lib/types/database.ts` is regenerated with new types
- [ ] `lib/types/tables.ts` and `lib/types/index.ts` are updated with new type aliases

---

### Step 2: Xero Environment & Client Utilities

**What:** Create the Xero environment variable loader, API client helpers, and type definitions.

**Files created:**
- `lib/xero/env.ts` — `getXeroEnv()` function
- `lib/xero/types.ts` — TypeScript types for Xero API requests/responses
- `lib/xero/client.ts` — Low-level Xero API fetch wrapper with error handling
- `lib/xero/get-xero-client.ts` — Token refresh logic, reads from `xero_connections`, returns configured client

**Acceptance criteria:**
- [ ] `getXeroEnv()` throws descriptive errors for missing env vars
- [ ] Xero client wrapper handles auth headers, idempotency keys, rate limits
- [ ] Token refresh logic reads/writes `xero_connections` via admin client
- [ ] Token refresh detects expired refresh tokens and throws typed error
- [ ] `npm run lint` passes

---

### Step 3: Xero Settings Type & Resolver

**What:** Create the Xero settings type definition and resolver, following the existing `invoicing-settings.ts` pattern.

**Files created:**
- `lib/settings/xero-settings.ts` — `XeroSettings` type, `DEFAULT_XERO_SETTINGS`, `resolveXeroSettings()`
- `lib/settings/fetch-xero-settings.ts` — Fetches and resolves Xero settings from `tenant_settings`

**Files modified:**
- (None — this is additive)

**Acceptance criteria:**
- [ ] `resolveXeroSettings()` handles null/undefined/malformed input gracefully
- [ ] Default settings have `enabled: false` and all values null/false
- [ ] Type exports are consistent with existing settings types
- [ ] `npm run lint` passes

---

### Step 4: Xero OAuth Flow — Connect & Callback

**What:** Implement the OAuth 2.0 connect and callback routes.

**Files created:**
- `app/api/xero/connect/route.ts` — GET handler, generates auth URL, sets state cookie, redirects
- `app/api/xero/callback/route.ts` — GET handler, validates state, exchanges code, stores tokens, redirects to settings

**Acceptance criteria:**
- [ ] Connect route generates correct Xero auth URL with all required params
- [ ] State cookie is httpOnly, secure, sameSite=lax, max-age=600
- [ ] Callback validates state against cookie (CSRF protection)
- [ ] Callback exchanges code for tokens and stores in `xero_connections`
- [ ] Callback fetches Xero tenant ID from `/connections` endpoint
- [ ] Callback sets `tenant_settings.settings.xero.enabled = true`
- [ ] Callback redirects to `/settings?tab=integrations&xero=connected`
- [ ] Error cases redirect to `/settings?tab=integrations&xero=error&message=...`
- [ ] Only owner/admin can access connect endpoint
- [ ] Logs connection event in `xero_export_logs`
- [ ] `npm run lint` passes

---

### Step 5: Xero Disconnect & Status Routes

**What:** Implement disconnect and status-check routes.

**Files created:**
- `app/api/xero/disconnect/route.ts` — POST handler
- `app/api/xero/status/route.ts` — GET handler

**Acceptance criteria:**
- [ ] Disconnect deletes `xero_connections` row
- [ ] Disconnect sets `tenant_settings.settings.xero.enabled = false`
- [ ] Disconnect revokes Xero token (best-effort, does not fail on error)
- [ ] Status returns `{ connected, xero_tenant_name, connected_at, enabled }`
- [ ] Status never returns tokens
- [ ] Only owner/admin can disconnect
- [ ] Staff can check status
- [ ] `npm run lint` passes

---

### Step 6: Xero Settings API Route

**What:** Create the settings route for Xero-specific configuration (default GL code, tax type, auto-export).

**Files created:**
- `app/api/settings/xero/route.ts` — GET/PATCH handler following `app/api/settings/invoicing/route.ts` pattern

**Acceptance criteria:**
- [ ] GET returns resolved Xero settings
- [ ] PATCH validates input with Zod schema
- [ ] PATCH merges into existing `tenant_settings.settings` under `xero` key
- [ ] Only owner/admin can access
- [ ] `npm run lint` passes

---

### Step 7: Account Sync

**What:** Implement Chart of Accounts sync from Xero.

**Files created:**
- `app/api/xero/sync-accounts/route.ts` — POST handler
- `app/api/xero/accounts/route.ts` — GET handler (returns cached accounts)
- `lib/xero/sync-accounts.ts` — Core sync logic

**Acceptance criteria:**
- [ ] Sync fetches accounts from Xero API
- [ ] Upserts into `xero_accounts` (match on `tenant_id` + `xero_account_id`)
- [ ] Marks removed accounts as `ARCHIVED`
- [ ] GET returns list of active accounts for tenant
- [ ] Logs sync action in `xero_export_logs`
- [ ] Only owner/admin can trigger sync
- [ ] Staff can read accounts
- [ ] `npm run lint` passes

---

### Step 8: Contact Sync Logic

**What:** Implement the contact sync/create utility used during invoice export.

**Files created:**
- `lib/xero/sync-contact.ts` — `syncXeroContact()` function

**Acceptance criteria:**
- [ ] Checks `xero_contacts` for existing mapping first (avoids unnecessary API calls)
- [ ] If no mapping, searches Xero by email for deduplication
- [ ] If no Xero contact found, creates one with user's name, email, phone
- [ ] Stores mapping in `xero_contacts`
- [ ] Handles edge case: Xero contact deleted externally (re-creates)
- [ ] `npm run lint` passes

---

### Step 9: Invoice Export Logic

**What:** Implement the core invoice export flow.

**Files created:**
- `lib/xero/export-invoice.ts` — `exportInvoiceToXero()` function
- `app/api/xero/export-invoices/route.ts` — POST handler
- `app/api/xero/retry-export/route.ts` — POST handler
- `app/api/xero/export-status/[invoiceId]/route.ts` — GET handler

**Acceptance criteria:**
- [ ] Duplicate check prevents re-export of already-exported invoices
- [ ] Pending record created before export (acts as lock)
- [ ] GL codes validated against `xero_accounts`
- [ ] Contact synced before export
- [ ] Xero payload built correctly with `Status: "DRAFT"`
- [ ] Idempotency key set to `invoice-{invoice_id}`
- [ ] Success updates `xero_invoices` with Xero invoice ID
- [ ] Failure updates `xero_invoices` with error message
- [ ] All interactions logged in `xero_export_logs`
- [ ] Retry endpoint clears failed record and re-exports
- [ ] Only staff can export
- [ ] Rate limit (429) handled with up to 3 retries
- [ ] `npm run lint` passes

---

### Step 10: Export Logs Route

**What:** Create the export logs API route for debugging.

**Files created:**
- `app/api/xero/export-logs/route.ts` — GET handler

**Acceptance criteria:**
- [ ] Returns recent logs ordered by `created_at DESC`
- [ ] Supports optional `invoiceId` filter
- [ ] Supports `limit` param (default 50, max 200)
- [ ] Only owner/admin can access
- [ ] `npm run lint` passes

---

### Step 11: Modify Invoice Creation to Snapshot GL Codes

**What:** Update invoice creation to copy `gl_code` and `xero_tax_type` from chargeables to invoice items.

**Files modified:**
- `app/invoices/new/actions.ts` — add `gl_code`, `xero_tax_type` to select query and insert
- `app/api/chargeables/route.ts` — accept `gl_code`, `xero_tax_type` in POST/PATCH
- Also update any other code path that creates invoice items (e.g., `approve_booking_checkin_atomic` RPC — check if this creates items directly in SQL)

**Acceptance criteria:**
- [ ] Chargeables select includes `gl_code, xero_tax_type`
- [ ] `invoice_items` insert includes `gl_code, xero_tax_type` (null if not set)
- [ ] Existing invoice creation still works identically
- [ ] Chargeables API accepts new fields
- [ ] `npm run lint` passes

---

### Step 12: Invoice List — Xero Status Column

**What:** Add Xero export status to the invoices list page.

**Files modified:**
- `lib/invoices/fetch-invoices.ts` — optionally fetch `xero_invoices` export status
- `lib/types/invoices.ts` — extend `InvoiceWithRelations` with optional `xero_export_status`
- `components/invoices/invoices-table.tsx` — add conditional "Xero" column

**Files created:**
- `components/invoices/xero-status-badge.tsx` — reusable badge component

**Acceptance criteria:**
- [ ] When Xero is enabled, invoices list shows "Xero" column
- [ ] Badge shows: "Exported" (green), "Failed" (red), "—" (not exported)
- [ ] When Xero is not enabled, no column is shown (zero UI change)
- [ ] `npm run lint` passes

---

### Step 13: Invoice Detail — Xero Export Actions

**What:** Add Xero export/status/retry UI to the invoice detail page.

**Files modified:**
- `components/invoices/invoice-detail-client.tsx` — add Xero section
- `components/invoices/invoice-view-actions.tsx` — add "Export to Xero" action
- `app/invoices/[id]/page.tsx` — fetch Xero status for the invoice

**Files created:**
- `components/invoices/xero-export-button.tsx` — export button with loading state
- `components/invoices/xero-invoice-status.tsx` — status display with retry/view-in-xero links

**Acceptance criteria:**
- [ ] "Export to Xero" button appears for exportable invoices (pending/paid/overdue, not already exported)
- [ ] Export button shows loading state during export
- [ ] After successful export: green "Exported to Xero" badge with timestamp, "View in Xero" link
- [ ] After failed export: red "Export Failed" badge with error, "Retry" button
- [ ] "View in Xero" opens correct Xero URL in new tab
- [ ] All Xero UI hidden when integration not enabled
- [ ] `npm run lint` passes

---

### Step 14: Settings — Integrations Tab

**What:** Add the Integrations tab to the settings page with Xero connection management.

**Files created:**
- `components/settings/integrations-tab.tsx` — main tab component
- `components/settings/xero-connection-card.tsx` — connection status card
- `components/settings/xero-settings-form.tsx` — GL code defaults, tax type, auto-export toggle
- `components/settings/gl-code-select.tsx` — dropdown populated from `xero_accounts`

**Files modified:**
- `components/settings/settings-page-client.tsx` — add "Integrations" tab to tabs array
- `app/settings/page.tsx` — fetch Xero connection status and settings

**Acceptance criteria:**
- [ ] "Integrations" tab appears in settings (only for owner/admin)
- [ ] Shows "Connect to Xero" card when not connected
- [ ] Shows connected status, org name, disconnect button when connected
- [ ] "Sync Accounts" button triggers sync and shows result
- [ ] GL code dropdown populated from cached accounts
- [ ] Default revenue account and tax type can be configured
- [ ] Settings save/undo follows existing `StickyFormActions` pattern
- [ ] `npm run lint` passes

---

### Step 15: Charges Tab — GL Code Configuration

**What:** Add GL code and tax type fields to the chargeables management UI.

**Files modified:**
- `components/settings/charges-tab.tsx` — add GL code and tax type columns to chargeables table, add fields to add/edit forms

**Acceptance criteria:**
- [ ] GL code column shows in chargeables table (when Xero enabled)
- [ ] GL code field in add/edit chargeable form uses `GlCodeSelect` dropdown
- [ ] Tax type field in add/edit form with common options
- [ ] Saving updates the chargeable record with `gl_code` and `xero_tax_type`
- [ ] Fields hidden when Xero not enabled
- [ ] `npm run lint` passes

---

### Step 16: End-to-End Testing & Polish

**What:** Manual end-to-end testing of the full Xero integration flow.

**Test scenarios:**
1. Connect to Xero from settings
2. Sync accounts
3. Configure GL codes on chargeables
4. Create a new invoice (verify GL codes are snapshotted)
5. Export invoice to Xero
6. Verify invoice appears in Xero as DRAFT
7. Verify duplicate export is prevented
8. Disconnect and verify UI cleans up
9. Verify tenant without Xero sees zero changes

**Acceptance criteria:**
- [ ] Full flow works end-to-end
- [ ] `npm run lint` passes
- [ ] `npm run build` succeeds
- [ ] No console errors in browser
- [ ] No TypeScript errors
- [ ] All Xero UI elements are hidden for non-Xero tenants
- [ ] Export logs show complete audit trail

---

## Appendix A: File Tree of New/Modified Files

```
lib/
  xero/
    env.ts                          (NEW)
    types.ts                        (NEW)
    client.ts                       (NEW)
    get-xero-client.ts              (NEW)
    sync-contact.ts                 (NEW)
    sync-accounts.ts                (NEW)
    export-invoice.ts               (NEW)
  settings/
    xero-settings.ts                (NEW)
    fetch-xero-settings.ts          (NEW)
  types/
    database.ts                     (REGENERATE)
    tables.ts                       (MODIFY)
    index.ts                        (MODIFY)
    invoices.ts                     (MODIFY)
  schema/
    generated.ts                    (REGENERATE)
  invoices/
    fetch-invoices.ts               (MODIFY)

app/
  api/
    xero/
      connect/route.ts              (NEW)
      callback/route.ts             (NEW)
      disconnect/route.ts           (NEW)
      status/route.ts               (NEW)
      accounts/route.ts             (NEW)
      sync-accounts/route.ts        (NEW)
      export-invoices/route.ts      (NEW)
      retry-export/route.ts         (NEW)
      export-status/[invoiceId]/route.ts  (NEW)
      export-logs/route.ts          (NEW)
    settings/
      xero/route.ts                 (NEW)
    chargeables/route.ts            (MODIFY)
  invoices/
    new/actions.ts                  (MODIFY)
    [id]/page.tsx                   (MODIFY)
  settings/
    page.tsx                        (MODIFY)

components/
  invoices/
    invoices-table.tsx              (MODIFY)
    invoice-detail-client.tsx       (MODIFY)
    invoice-view-actions.tsx        (MODIFY)
    xero-status-badge.tsx           (NEW)
    xero-export-button.tsx          (NEW)
    xero-invoice-status.tsx         (NEW)
    xero-bulk-export-button.tsx     (NEW)
  settings/
    settings-page-client.tsx        (MODIFY)
    charges-tab.tsx                 (MODIFY)
    integrations-tab.tsx            (NEW)
    xero-connection-card.tsx        (NEW)
    xero-settings-form.tsx          (NEW)
    gl-code-select.tsx              (NEW)

supabase/
  migrations/
    YYYYMMDD_xero_integration.sql   (NEW)
```

## Appendix B: Xero API Endpoints Used

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `https://login.xero.com/identity/connect/authorize` | OAuth authorization |
| POST | `https://identity.xero.com/connect/token` | Token exchange & refresh |
| POST | `https://identity.xero.com/connect/revocation` | Token revocation |
| GET | `https://api.xero.com/connections` | List connected orgs |
| GET | `https://api.xero.com/api.xro/2.0/Accounts` | Fetch Chart of Accounts |
| GET | `https://api.xero.com/api.xro/2.0/Contacts` | Search contacts by email |
| POST | `https://api.xero.com/api.xro/2.0/Contacts` | Create contact |
| PUT | `https://api.xero.com/api.xro/2.0/Invoices` | Create/update invoice |

## Appendix C: Xero Developer Portal Setup

Before implementation, register the app in the Xero Developer Portal:

1. Go to https://developer.xero.com/app/manage
2. Create a new app (type: "Web App")
3. Set redirect URI to match `XERO_REDIRECT_URI`
4. Note the Client ID and Client Secret
5. Add required scopes (apps created Mar 2026+ use granular): `openid profile email accounting.invoices accounting.contacts accounting.settings.read offline_access`

### Appendix C.1: Local development with HTTPS tunnel (when portal requires HTTPS)

If the Xero Developer Portal rejects `http://localhost` and requires HTTPS, use a tunnel to expose your local app over HTTPS.

**Option A: Expose localhost with your preferred tunnel**

1. **Start a tunnel to port 3000**

   ```bash
   npx ngrok http 3000
   ```

   Use any tunnel provider you prefer. The only requirement is an `https://...` public URL that forwards to your local app.

2. **Copy your tunnel URL**

   Output will look like:

   ```
   Forwarding https://abc-def-123.ngrok-free.app -> http://localhost:3000
   ```

   Copy the `https://...` public URL (no trailing slash).

3. **Add redirect URI in Xero**  
   In your Xero app settings, add:

   ```
   https://YOUR-TUNNEL-URL/api/xero/callback
   ```

   Example: `https://abc-def-123.ngrok-free.app/api/xero/callback`

4. **Update `.env.local`**

   ```env
   XERO_REDIRECT_URI=https://YOUR-TUNNEL-URL/api/xero/callback
   ```

5. **Run the app**

   In another terminal:

   ```bash
   npm run dev
   ```

6. **Use the tunnel URL for Xero flows**

   - Open your app via `https://YOUR-TUNNEL-URL` (not `http://localhost:3000`) when testing Connect to Xero and OAuth flows.
   - You can still use `localhost` for other features.

**Option B: ngrok (reserved subdomains on paid plan)**

If you prefer ngrok:

```bash
npx ngrok http 3000
```

Use the HTTPS URL from the ngrok output. You may need a free ngrok account for longer sessions.

**Notes**

- Free tunnel URLs change each session. Restart the tunnel → update Xero and `.env.local` with the new URL.
- Keep the tunnel running in one terminal and `npm run dev` in another.

## Appendix D: Future Enhancements (Out of Scope for V1)

- **Payment sync:** Export `invoice_payments` to Xero as payments
- **Credit note sync:** Export credit notes to Xero
- **Auto-export on approve:** When `auto_export_on_approve = true`, automatically export when an invoice status changes to `pending`
- **Bulk operations:** Select multiple invoices in the list and export all at once
- **Webhook support:** Listen for Xero webhooks for real-time sync
- **Multi-org selection:** Allow choosing which Xero org to connect when the user has multiple
- **Account sync scheduling:** Cron job to sync accounts daily
- **Two-way sync:** Reflect Xero invoice status changes back in the app
