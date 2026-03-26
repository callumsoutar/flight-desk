# Financial Subsystem Security & Architecture Audit

**Audit Date**: 2026-03-11  
**Auditor**: Automated Security Audit Agent  
**Branch**: `cursor/financial-subsystem-audit-2a8e`  
**Supabase Project**: `fergmobsjyucucxeumvb` (flight-service-pro, ap-southeast-2)  
**Scope**: All tables, functions, triggers, RLS policies, and application code related to invoices, payments, transactions, chargeables, tax rates, and Xero integration.

---

## 1. Executive Summary

This audit examined the financial subsystem of the Aero Safety application across four dimensions: database schema and security, application code, documentation, and cross-cutting concerns. The subsystem manages invoice lifecycle, payment recording, tax calculations, chargeable items, and Xero accounting integration for a multi-tenant flight school SaaS platform.

### Top Findings (Ranked by Severity)

| # | Severity | Finding |
|---|----------|---------|
| 1 | 🔴 Critical | **Orphaned database functions reference non-existent tables** (`payments`, `payment_sequences`, `credit_notes`, `credit_note_items`). At least 4 RPC functions (`process_payment_atomic`, `reverse_payment_atomic`, `reverse_and_replace_payment_atomic`, `process_credit_payment_atomic`) will fail at runtime with `relation "payments" does not exist`. |
| 2 | 🔴 Critical | **No audit triggers on any financial table**. Mutations to `invoices`, `invoice_items`, `invoice_payments`, `transactions`, `chargeables`, and `tax_rates` are not logged to `audit_logs`. |
| 3 | 🔴 Critical | **Invoices RLS permits hard DELETE by any tenant member**. The `invoices_tenant_delete` policy requires only `user_belongs_to_tenant(tenant_id)` — no role check. There is no trigger preventing hard deletion of invoices. |
| 4 | 🟠 High | **Xero OAuth tokens stored in plaintext**. `xero_connections.access_token` and `refresh_token` are stored as `text` with no column-level encryption. |
| 5 | 🟠 High | **Missing role check on booking check-in approval**. Any authenticated tenant member can approve check-ins and create invoices via `/api/bookings/[id]/checkin/approve`. |
| 6 | 🟠 High | **28+ financial database functions have mutable `search_path`**. SECURITY DEFINER functions without `SET search_path` are vulnerable to search path injection attacks. |
| 7 | 🟠 High | **Invoice RLS policies lack role-based write control**. INSERT, UPDATE, and DELETE on `invoices` require only tenant membership — any student or member can create, modify, or delete invoices via direct Supabase API calls. |
| 8 | 🟡 Medium | **Stale JWT role claims used for authorization** on 4+ financial API routes (`invoices/[id]`, `invoice_items`, `account-statement`, `tax-rates` GET). |
| 9 | 🟡 Medium | **Non-atomic tax rate default swap** can leave a tenant with no default tax rate. |
| 10 | 🟡 Medium | **Xero export does not filter soft-deleted invoices** — a deleted invoice could be exported. |

---

## 2. Database Audit

### 2.1 Schema Inspection — Core Financial Tables

#### `invoices` (39 rows, RLS enabled)

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | PK |
| invoice_number | text | YES | — | — |
| user_id | uuid | NO | — | FK → users.id |
| status | invoice_status | NO | 'draft' | enum: draft, pending, paid, overdue, cancelled, refunded |
| issue_date | timestamptz | NO | now() | — |
| due_date | timestamptz | YES | — | — |
| paid_date | timestamptz | YES | — | — |
| subtotal | numeric | YES | 0 | — |
| tax_total | numeric | YES | 0 | — |
| total_amount | numeric | YES | 0 | — |
| total_paid | numeric | YES | 0 | — |
| balance_due | numeric | YES | 0 | — |
| notes | text | YES | — | — |
| booking_id | uuid | YES | — | FK → bookings.id |
| reference | text | YES | — | — |
| payment_method | payment_method | YES | — | enum |
| payment_reference | text | YES | — | — |
| tax_rate | numeric | NO | 0.15 | CHECK ≥ 0 |
| deleted_at | timestamptz | YES | — | Soft delete |
| deleted_by | uuid | YES | — | FK → users.id |
| deletion_reason | text | YES | — | — |
| tenant_id | uuid | NO | get_user_tenant() | FK → tenants.id |

**Indexes**: PK, user_id, tenant_id, booking_id, deleted_at (partial WHERE NULL), deleted_by, unique active booking_id.

**Findings**:
- 🔴 `invoice_number` is nullable and has no UNIQUE constraint — duplicate invoice numbers are possible.
- 🟡 `subtotal`, `tax_total`, `total_amount`, `total_paid`, `balance_due` are all nullable — could be NULL rather than 0 in edge cases.
- ✅ Monetary values use `numeric` type (not float). Correct for financial data.
- ✅ Soft delete mechanism (deleted_at, deleted_by, deletion_reason) is present.

#### `invoice_items` (82 rows, RLS enabled)

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | PK |
| invoice_id | uuid | NO | — | FK → invoices.id |
| chargeable_id | uuid | YES | — | FK → chargeables.id |
| description | text | NO | — | — |
| quantity | numeric | NO | 1 | — |
| unit_price | numeric | NO | — | — |
| line_total | numeric | YES | — | — |
| tax_rate | numeric | YES | 0 | — |
| tax_amount | numeric | YES | — | — |
| amount | numeric | NO | 0 | — |
| rate_inclusive | numeric | YES | — | — |
| deleted_at | timestamptz | YES | — | Soft delete |
| deleted_by | uuid | YES | — | FK → users.id |
| gl_code | text | YES | — | Xero GL code snapshot |
| xero_tax_type | text | YES | — | Xero tax type snapshot |
| tenant_id | uuid | NO | get_user_tenant() | FK → tenants.id |

**Findings**:
- 🟡 No CHECK constraints on `quantity` (could be negative or zero) or `unit_price` (could be negative).
- ✅ `gl_code` and `xero_tax_type` are snapshotted at creation — immutable after export. Good design.

#### `invoice_payments` (17 rows, RLS enabled)

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | PK |
| invoice_id | uuid | NO | — | FK → invoices.id |
| user_id | uuid | NO | — | — |
| amount | numeric | NO | — | CHECK > 0 |
| payment_method | payment_method | NO | — | enum |
| payment_reference | text | YES | — | — |
| notes | text | YES | — | — |
| paid_at | timestamptz | NO | now() | — |
| transaction_id | uuid | NO | — | FK → transactions.id |
| created_by | uuid | NO | — | — |
| tenant_id | uuid | NO | get_user_tenant() | FK → tenants.id |

**Findings**:
- ✅ `amount` has CHECK > 0 — prevents zero or negative payments.
- 🟡 No `deleted_at` column — payments cannot be soft-deleted. Once recorded, they exist permanently. This is acceptable for financial audit trail but means corrections must use reversal transactions.
- 🟡 `user_id` and `created_by` have no FK constraints declared to `users` table.

#### `transactions` (57 rows, RLS enabled)

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | PK |
| user_id | uuid | NO | — | FK → users.id |
| type | transaction_type | NO | — | enum: credit, debit, refund, adjustment |
| status | transaction_status | NO | 'pending' | enum: pending, completed, failed, cancelled, refunded |
| amount | numeric | NO | — | CHECK ≠ 0 |
| description | text | NO | — | — |
| metadata | jsonb | YES | — | — |
| reference_number | text | YES | — | — |
| completed_at | timestamptz | YES | — | — |
| tenant_id | uuid | NO | get_user_tenant() | FK → tenants.id |

**Findings**:
- ✅ `amount` has CHECK ≠ 0 — prevents zero-amount transactions.
- 🟡 No `deleted_at` column — transactions are immutable (correct for a ledger).
- 🟡 No index on `metadata` JSONB — queries filtering by `metadata->>'invoice_id'` will be slow as data grows.

#### `chargeables` (32 rows, RLS enabled)

**Findings**:
- ✅ `rate` has CHECK ≥ 0.
- ✅ Soft delete via `voided_at` and active flag via `is_active`.
- ✅ `is_taxable` flag available per chargeable.
- 🟡 No CHECK constraint on `rate` upper bound.

#### `chargeable_types` (9 rows, RLS enabled)

**Findings**:
- ✅ Hybrid global/tenant model with proper unique indexes per scope.
- ✅ `is_system` flag prevents modification of system types.

#### `tax_rates` (1 row, RLS enabled)

**Findings**:
- ✅ Uses `numeric` for rate. Has `effective_from` for temporal validity.
- 🟡 No compound unique constraint on `(tenant_id, country_code, effective_from)` — could allow duplicate rates for the same period.
- 🟡 Only 1 row exists globally — very minimal data.

#### `invoice_sequences` (8 rows, RLS enabled)

- PK is `year_month` (text), not UUID. Uses UPSERT with `ON CONFLICT` for atomic sequence generation.
- 🟡 `year_month` PK is not scoped by tenant — **all tenants share the same sequence counter**. Invoice numbers will have gaps within a tenant and could leak information about total system volume.

### 2.2 Schema Inspection — Xero Tables

#### `xero_connections` (1 row, RLS enabled)

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| access_token | text | NO | 🔴 Plaintext OAuth token |
| refresh_token | text | NO | 🔴 Plaintext OAuth token |
| token_expires_at | timestamptz | NO | — |
| xero_tenant_id | text | NO | — |
| connected_by | uuid | YES | 🟡 FK to users but nullable — audit gap |
| tenant_id | uuid | NO | UNIQUE constraint — one connection per tenant |

**Findings**:
- 🔴 **Tokens stored in plaintext**. Should use `pgsodium` column encryption or Supabase Vault.
- ✅ UNIQUE constraint on `tenant_id` — enforces one connection per tenant.

#### `xero_accounts` (7 rows), `xero_contacts` (1 row), `xero_invoices` (6 rows), `xero_export_logs` (22 rows)

- All have RLS enabled with appropriate tenant scoping.
- ✅ `xero_invoices` has unique constraint on `(tenant_id, invoice_id)` — prevents duplicate exports.
- ✅ `xero_export_logs` stores request/response payloads for audit trail.
- 🟡 `xero_export_logs.request_payload` may contain PII (email addresses from contact sync).

### 2.3 Row-Level Security Audit

#### RLS Policy Summary — Financial Tables

| Table | RLS | SELECT | INSERT | UPDATE | DELETE | Role Required |
|-------|-----|--------|--------|--------|--------|---------------|
| invoices | ✅ | tenant member | tenant member | tenant member | **tenant member** | 🔴 **None for write** |
| invoice_items | ✅ | tenant member (soft-deleted hidden from non-staff) | staff (owner/admin/instructor) | staff | staff | ✅ Staff for write |
| invoice_payments | ✅ | own invoices OR staff | staff | staff | staff | ✅ Staff for write |
| transactions | ✅ | own OR staff | staff | staff | staff | ✅ Staff for write |
| chargeables | ✅ | tenant member | admin/owner | admin/owner | admin/owner | ✅ Admin for write |
| chargeable_types | ✅ | tenant member (incl. globals) | admin/owner | admin/owner | owner only | ✅ Admin for write |
| tax_rates | ✅ | tenant member | admin/owner | admin/owner | admin/owner | ✅ Admin for write |
| invoice_sequences | ✅ | admin/owner | admin/owner | admin/owner | admin/owner | ✅ Admin for write |

**Critical RLS Findings**:

1. 🔴 **`invoices` — All write policies lack role checks**:
   - `invoices_tenant_insert`: WITH CHECK is only `user_belongs_to_tenant(tenant_id)`. Any student can INSERT an invoice.
   - `invoices_tenant_update`: USING is only `user_belongs_to_tenant(tenant_id)`. Any student can UPDATE any invoice in their tenant.
   - `invoices_tenant_delete`: USING is only `user_belongs_to_tenant(tenant_id)`. Any member can hard-DELETE invoices.
   - **Impact**: A student user could create fraudulent invoices, modify existing invoices, or permanently delete financial records by making direct Supabase API calls (bypassing the application UI).

2. 🟡 **`xero_connections` — SELECT restricted to admins**: The `is_tenant_admin(tenant_id)` check correctly limits token access. This was flagged as critical in a prior audit; the security hardening migration appears to have fixed it.

3. 🟡 **`xero_export_logs` — INSERT open to any tenant member**: The `xero_export_logs_tenant_insert` policy requires only `user_belongs_to_tenant`. A malicious user could insert fake export log entries.

#### RLS Policy Gaps

| Gap | Table | Severity |
|-----|-------|----------|
| No role check on INSERT | invoices | 🔴 Critical |
| No role check on UPDATE | invoices | 🔴 Critical |
| No role check on DELETE (hard delete) | invoices | 🔴 Critical |
| No role check on INSERT | xero_export_logs | 🟡 Medium |
| No UPDATE/DELETE policies | xero_export_logs | 🟡 Medium |

### 2.4 Database Functions & RPC

#### Financial Functions Inventory

| Function | SECURITY DEFINER | search_path set | Auth Check | Calls Non-Existent Table |
|----------|-----------------|-----------------|------------|--------------------------|
| create_invoice_atomic | ✅ Yes | ✅ Yes (public) | ✅ auth.uid() + role | No |
| create_invoice_with_transaction | ❌ No | ❌ No | ❌ None | No |
| update_invoice_totals_atomic | ✅ Yes | ❌ No | ❌ None | No |
| update_invoice_status_atomic | ❌ No | ❌ No | ❌ None | No |
| record_invoice_payment_atomic | ✅ Yes | ✅ Yes (public) | ✅ auth.uid() + role | No |
| soft_delete_invoice | ✅ Yes | ❌ No | ❌ None (trusts caller) | No |
| generate_invoice_number | ❌ No | ❌ No | ❌ None | No |
| generate_invoice_number_app | ❌ No | ❌ No | ❌ None | No |
| generate_invoice_number_with_prefix | ❌ No | ❌ No | ❌ None | No |
| generate_payment_number | ✅ Yes | ✅ Yes (public) | ❌ None | 🔴 **payment_sequences** |
| process_payment | ❌ No | ❌ No | ❌ None | 🔴 **payments** |
| process_payment_atomic | ❌ No | ❌ No | ❌ None | 🔴 **payments** |
| process_credit_payment_atomic | ✅ Yes | ✅ Yes (public) | ❌ None | 🔴 **payments** |
| reverse_payment_atomic | ✅ Yes | ❌ No | ❌ None | 🔴 **payments** |
| reverse_and_replace_payment_atomic | ✅ Yes | ❌ No | ❌ None | 🔴 **payments** |
| apply_credit_note_atomic | ✅ Yes | ❌ No | ❌ None | 🔴 **credit_notes** |
| soft_delete_credit_note | ✅ Yes | ❌ No | ❌ None | 🔴 **credit_notes, credit_note_items** |
| generate_credit_note_number | ❌ No | ❌ No | ❌ None | 🔴 **credit_notes** |
| prevent_applied_credit_note_modification | ❌ No | ❌ No | N/A (trigger) | 🔴 **credit_notes** |
| prevent_applied_credit_note_item_modification | ❌ No | ❌ No | N/A (trigger) | 🔴 **credit_notes** |
| finalize_booking_checkin_with_invoice_atomic | ✅ Yes | ❌ No | ✅ auth.uid() + role | No |
| upsert_invoice_items_batch | ❌ No | ❌ No | ❌ None | No |

**Critical Function Findings**:

1. 🔴 **7 functions reference the non-existent `payments` table**: `process_payment`, `process_payment_atomic`, `process_credit_payment_atomic`, `reverse_payment_atomic`, `reverse_and_replace_payment_atomic`. These will throw runtime errors if called.

2. 🔴 **5 functions reference non-existent `credit_notes`/`credit_note_items` tables**: `apply_credit_note_atomic`, `soft_delete_credit_note`, `generate_credit_note_number`, and two trigger functions. These are dead code.

3. 🔴 **`generate_payment_number` references non-existent `payment_sequences` table**. Will fail at runtime.

4. 🟠 **`update_invoice_totals_atomic` and `update_invoice_status_atomic` have no auth checks**. They are SECURITY DEFINER (totals) or INVOKER (status) but neither validates `auth.uid()`. They rely entirely on the caller to enforce authorization. Since they are called from both RPCs and application code, any user with Supabase API access could call them directly.

5. 🟠 **`soft_delete_invoice` accepts `p_user_id` as a parameter but does not verify it matches `auth.uid()`**. A caller could pass any user ID as the deleter.

6. 🟠 **28 financial functions have mutable `search_path`** (confirmed by Supabase security advisor). SECURITY DEFINER functions without `SET search_path` can be exploited via search path injection: a malicious user could create a function in the `public` schema that shadows a built-in function, causing the SECURITY DEFINER function to call the malicious version with elevated privileges.

### 2.5 Triggers

#### Trigger Coverage on Financial Tables

| Table | Trigger | Event | Function | Purpose |
|-------|---------|-------|----------|---------|
| invoices | prevent_invoice_modification | BEFORE UPDATE | prevent_approved_invoice_modification() | Immutability guard |
| invoice_items | prevent_item_insert | BEFORE INSERT | prevent_approved_invoice_item_modification() | Immutability guard |
| invoice_items | prevent_item_update | BEFORE UPDATE | prevent_approved_invoice_item_modification() | Immutability guard |
| invoice_items | prevent_item_delete | BEFORE DELETE | prevent_approved_invoice_item_modification() | Immutability guard |
| transactions | transaction_status_update | BEFORE UPDATE | update_transaction_status() | Auto-set completed_at |
| xero_accounts | set_xero_accounts_updated_at | BEFORE UPDATE | set_updated_at() | Timestamp |
| xero_connections | set_xero_connections_updated_at | BEFORE UPDATE | set_updated_at() | Timestamp |
| xero_contacts | set_xero_contacts_updated_at | BEFORE UPDATE | set_updated_at() | Timestamp |
| xero_invoices | set_xero_invoices_updated_at | BEFORE UPDATE | set_updated_at() | Timestamp |

**Trigger Findings**:

1. 🔴 **No audit triggers on ANY financial table**. Changes to invoices, invoice_items, invoice_payments, transactions, chargeables, and tax_rates are not logged. The `audit_logs` table exists and has triggers on `bookings`, `users`, `exam_results`, and `student_syllabus_enrollment` — but all financial tables are excluded.

2. 🟡 **Invoice immutability trigger allows admin bypass**. The `prevent_approved_invoice_modification` function checks `check_user_role_simple` and allows admins/owners to bypass all immutability checks. While this is intentional, there is no audit log of admin overrides.

3. 🟡 **No trigger prevents hard deletion of invoices**. The `prevent_approved_invoice_item_modification` trigger blocks item deletion on approved invoices, but there is no equivalent trigger on the `invoices` table itself. Combined with the permissive DELETE RLS policy, this means any tenant member can hard-delete any invoice (including approved ones) via a direct DELETE query.

4. ✅ Invoice item immutability triggers correctly cover INSERT, UPDATE, and DELETE events.

### 2.6 The `payments` Table — Specific Investigation

#### Definitive Verdict: The `payments` table DOES NOT EXIST.

**Evidence**:

1. `SELECT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'payments')` → `false`
2. `SELECT * FROM information_schema.columns WHERE table_name = 'payments'` → empty result
3. The table does not appear in `list_tables` output
4. No RLS policies exist for `payments`
5. No indexes exist for `payments`
6. No FK constraints reference `payments`

**However, the following database functions still reference `payments`**:

| Function | Operation on `payments` |
|----------|------------------------|
| process_payment() | INSERT INTO payments |
| process_payment_atomic() | SELECT FROM payments, INSERT INTO payments |
| process_credit_payment_atomic() | INSERT INTO payments |
| reverse_payment_atomic() | SELECT FROM payments, INSERT INTO payments, UPDATE payments |
| reverse_and_replace_payment_atomic() | SELECT FROM payments, INSERT INTO payments, UPDATE payments |

**Impact**: Calling any of these RPCs will result in a runtime error: `ERROR: relation "payments" does not exist`. If any application code path currently calls these functions, it will fail silently (the functions return error JSON rather than throwing).

**The `payment_sequences` table also DOES NOT EXIST**, but `generate_payment_number()` references it. This function is called by `process_credit_payment_atomic`.

**The `credit_notes` and `credit_note_items` tables also DO NOT EXIST**, but are referenced by `apply_credit_note_atomic`, `soft_delete_credit_note`, `generate_credit_note_number`, and two trigger functions.

**Application Code Analysis**: The application's active payment path uses `record_invoice_payment_atomic` (which writes to `invoice_payments` + `transactions`) — this function works correctly. The orphaned `payments`-referencing functions appear to be from a prior design iteration that was partially migrated to `invoice_payments`.

**Deprecation Recommendation**:

1. **Phase 1 — Verify no active callers**: Search all application code, Edge Functions, and external integrations for calls to `process_payment`, `process_payment_atomic`, `process_credit_payment_atomic`, `reverse_payment_atomic`, `reverse_and_replace_payment_atomic`, `generate_payment_number`, `apply_credit_note_atomic`, `soft_delete_credit_note`, `generate_credit_note_number`.
2. **Phase 2 — Drop functions**: After confirming no active callers, drop all 9 orphaned functions in a single migration.
3. **Phase 3 — Remove TypeScript types**: Remove the corresponding RPC type definitions from `lib/types/database.ts` and regenerate `lib/schema/generated.ts`.
4. **Risk**: Low. These functions are already non-functional. Dropping them reduces confusion and attack surface.

---

## 3. Application Code Audit

### 3.1 Xero Integration Layer

#### Token Storage
- **Where**: `xero_connections` table, `access_token` and `refresh_token` columns.
- **How**: Plaintext `text` columns. No column-level encryption.
- **At rest encryption**: Supabase provides transparent disk encryption, but tokens are readable in plaintext to any query with sufficient permissions.
- 🔴 **Finding**: Tokens should be encrypted using `pgsodium` or Supabase Vault.

#### Token Refresh Logic
- **Mechanism**: `get-xero-client.ts` checks `token_expires_at` against a 5-minute buffer. If expiring soon, calls Xero token endpoint and updates the DB.
- **Failure mode**: On refresh failure, throws `XeroAuthError` with user-friendly message. Logs failure to `xero_export_logs`.
- 🟡 **Concern**: No mutex/lock on refresh. Concurrent requests could both attempt refresh, causing the second to fail (rotated refresh token already consumed).

#### Webhook Handling
- ⚪ **N/A**: No Xero webhook handlers exist. Xero integration is push-only (export from app to Xero). No inbound webhooks.

#### OAuth Security
- ✅ State parameter with HTTP-only cookie, nonce, and 10-minute TTL.
- ✅ Token exchange uses server-side `Basic` auth header.
- 🟠 **Missing admin check in callback**: The `/api/xero/callback` route checks `requireUser: true` but does NOT re-verify admin role. The connect route checks admin, but the callback does not.
- 🟡 `?debug=1` endpoint in connect route exposes `clientId`, `redirect_uri`, `scopes` in development mode. Low risk but should be disabled.
- 🟡 PKCE not implemented despite being specified in the integration doc.

#### Hardcoded Credentials
- ✅ **None found**. All credentials sourced from environment variables. No `.env.example` file exists in the repo (env vars are documented in `docs/xero-integration.md`).

### 3.2 Invoice Lifecycle

#### Creation
- **Who can create**: Application enforces staff-only (admin/owner/instructor) via `create_invoice_atomic` RPC (which checks `auth.uid()` + role). However, **RLS permits any tenant member to INSERT directly** — bypassing the RPC.
- **Server-side validation**: Comprehensive Zod schema in `app/invoices/new/actions.ts`: user UUID, items array (min 1), quantity (positive, max 9999), unit_price (non-negative), reference (max 200), notes (max 2000).
- **Member validation**: Verifies the invoice's `user_id` is an active tenant member.
- **Chargeable validation**: Each chargeable must exist, be active, not voided, and belong to the tenant.
- 🟠 **Non-atomic creation path**: The server action creates the invoice header, then inserts items in a separate call. If the item insert fails, a compensating `soft_delete_invoice` RPC is called. A crash between these operations would leave an orphaned empty invoice.

#### State Transitions
- **Enforced in DB**: The `prevent_approved_invoice_modification` trigger blocks changes to approved invoices (pending/paid/overdue) for non-admin users.
- **Application enforcement**: `approveInvoiceAction` only transitions `draft` → `pending`. Payment recording only on `pending`/`overdue` invoices.
- 🟡 **Status transitions are not validated at the DB level** (no CHECK constraint or trigger that enforces valid transitions). The `invoice_status` enum allows any value, and the trigger only protects approved invoices.

#### Sync to Xero
- **On conflict**: If a contact is stale (deleted/merged in Xero), the export function hard-deletes the local `xero_contacts` mapping and re-syncs. If the invoice export itself fails, the `xero_invoices` row is updated to `failed` status.
- ✅ Idempotency key prevents duplicate Xero invoices on retry.
- 🟡 No automatic retry mechanism — failed exports require manual retry via `/api/xero/retry-export`.

#### Voiding / Deletion
- **Soft delete**: `soft_delete_invoice` RPC sets `deleted_at`, `deleted_by`, `deletion_reason` and cascades to invoice items. Only draft invoices can be soft-deleted via this RPC.
- 🔴 **Hard delete possible**: The `invoices_tenant_delete` RLS policy permits `DELETE` by any tenant member with no role check and no trigger guard.
- 🟡 No mechanism to void an approved invoice directly — the only option is to cancel or create a credit note (but credit note tables don't exist yet).

### 3.3 Payment Processing

#### Where Payments Are Recorded
- **Active path**: `invoice_payments` table, via `record_invoice_payment_atomic` RPC.
- **Orphaned path**: The `payments` table does not exist; functions referencing it are dead code.
- ✅ Confirmed: the application's payment modal calls `recordInvoicePaymentAction`, which calls the `record_invoice_payment_atomic` RPC.

#### Atomicity
- ✅ `record_invoice_payment_atomic` is SECURITY DEFINER, uses `FOR UPDATE` row locking on the invoice, and performs all writes (transaction, payment, invoice update) within a single PL/pgSQL function with exception handling.
- ✅ Validates: auth, role, amount > 0, invoice exists, invoice not cancelled/refunded, balance > 0, no overpayment.

#### Double-Payment Risk
- ✅ `FOR UPDATE` lock on the invoice row prevents concurrent payments from both passing the balance check.
- 🟡 No unique constraint on `invoice_payments` to prevent exact-duplicate entries (same amount, method, reference in quick succession). The row lock mitigates this at the DB level, but a unique constraint on `(invoice_id, transaction_id)` would be belt-and-suspenders.

#### Reconciliation
- 🟡 No automated reconciliation between internal records and Xero. Payments are recorded internally only; Xero integration is invoice-export-only (no payment sync).

### 3.4 Tax Handling

#### Tax Rate Application
- Tax rates are stored in the `tax_rates` table (per tenant).
- At invoice creation, the default tax rate is fetched from the DB. Each chargeable can override via `is_taxable`.
- ✅ Tax rate is validated to be in `[0, 1]` range.

#### Calculation Logic
- **Server-side**: `invoice-calculations.ts` implements a 4-step calculation: rate_inclusive → line_total → amount (back-calculated) → tax_amount (difference). Uses `roundToTwoDecimals`.
- **DB-side**: `create_invoice_atomic` independently implements the same calculation in SQL.
- 🟡 **Dual implementation risk**: Having the same calculation in both TypeScript and PL/pgSQL creates a risk of drift. If one is updated without the other, amounts will diverge.

#### Rounding Logic
- TypeScript: `Math.round((value + Number.EPSILON) * 100) / 100` — standard banker-style rounding.
- PL/pgSQL: `round(x, 2)` — PostgreSQL's `round` uses HALF_UP by default for numeric types.
- 🟡 **Subtle rounding difference**: The TypeScript approach adds `Number.EPSILON` before rounding (to handle floating-point edge cases), while PL/pgSQL uses exact numeric arithmetic. In rare edge cases, these could produce different results by 1 cent.

#### Multi-jurisdiction / Multi-currency
- `tax_rates` has `country_code` and `region_code` columns — supports multi-jurisdiction in theory.
- `tenants.currency` defaults to `'NZD'` — currency is tenant-level, not invoice-level.
- 🟡 No currency column on `invoices` or `invoice_items` — all amounts are implicitly in the tenant's currency. Multi-currency invoicing is not supported.

### 3.5 Access Control (Application Layer)

#### Role Hierarchy
- Roles: owner > admin > instructor > member > student.
- Financial operations:
  - Invoice CRUD: staff (owner/admin/instructor) in application code.
  - Payment recording: staff in application code.
  - Tax rate management: admin/owner.
  - Chargeable management: admin/owner.
  - Xero connection: admin/owner.
  - Xero export: staff.

#### Server-side Enforcement

| Route | Auth Pattern | authoritativeRole | Sufficient? |
|-------|-------------|-------------------|-------------|
| POST invoice (action) | requireUser + authoritativeRole | ✅ | ✅ |
| GET invoice | getAuthSession (claims) | ❌ | 🟡 Stale role |
| GET invoice_items | getAuthSession (claims) | ❌ | 🟡 Stale role |
| Approve invoice (action) | requireUser + authoritativeRole | ✅ | ✅ |
| Record payment (action) | requireUser + authoritativeRole | ✅ | ✅ |
| Booking check-in approve | requireUser + authoritativeRole | ✅ | 🔴 **No role check** |
| GET account-statement | getAuthSession (claims) | ❌ | 🟡 Stale role |
| GET tax-rates | getAuthSession (claims) | ❌ | 🟡 Stale role |
| PATCH tax-rates | requireUser + authoritativeRole | ✅ | ✅ |
| Xero connect | requireUser + authoritativeRole | ✅ | ✅ |
| Xero callback | requireUser only | ❌ | 🟠 **No admin check** |
| Xero export | requireUser + authoritativeRole | ✅ | ✅ |

#### Direct API Bypass Risk
- 🔴 **Yes, a lower-privileged user CAN manipulate financial records via direct Supabase API calls**. The RLS policies on `invoices` only require `user_belongs_to_tenant()` for INSERT, UPDATE, and DELETE. A student or member with a valid JWT and the Supabase URL + anon key (which are public, embedded in the frontend) can:
  - INSERT a fraudulent invoice
  - UPDATE any invoice's amounts, status, or user_id
  - Hard-DELETE any invoice
  - This is partially mitigated by the `prevent_approved_invoice_modification` trigger (which blocks some changes on approved invoices), but draft invoices and the DELETE operation are completely unprotected.

### 3.6 Chargeables & Chargeable Types

#### Pricing at Invoice Generation
- Chargeables have a `rate` field. At invoice creation, the `unit_price` is passed by the client.
- 🟠 **Price manipulation risk**: The server action does NOT verify that the submitted `unit_price` matches the chargeable's configured `rate`. A modified client could submit any price. The chargeable validation only checks existence, active status, and tenant ownership — not price.
- **Recommendation**: Either enforce that `unit_price` matches `chargeable.rate` on the server, or document that custom pricing is intentional.

---

## 4. Documentation Audit

### Documents Reviewed

| Document | Status |
|----------|--------|
| `docs/xero-integration.md` | Partially outdated |
| `TAX_INVOICE_AUDIT.md` | Current (root cause analysis) |
| `xero-tax-audit-fixes.md` | Current (audit findings) |
| `AGENTS.md` | Current |

### Findings

1. 🟡 **`docs/xero-integration.md` states PKCE is used** (§4.1: "OAuth 2.0 with PKCE"), but PKCE is not implemented. The connect route does not generate a `code_verifier` or send a `code_challenge`.

2. 🟡 **`docs/xero-integration.md` describes `unit_price` and `amount` in Xero payloads** (§8.1), but `TAX_INVOICE_AUDIT.md` documents that `rate_inclusive` and `line_total` must be used for GST-inclusive invoices. The spec is outdated.

3. 🟡 **`docs/xero-integration.md` specifies token encryption** ("Tokens must be stored server-side only and encrypted at rest via Supabase Vault/column encryption"), but this is not implemented.

4. 🟡 **`xero-tax-audit-fixes.md` references branch `cursor/financial-systems-xero-audit-9454`** — different from the current branch.

5. 🔵 **No documentation exists for**: the invoice lifecycle state machine, the payment recording flow, the relationship between `invoice_payments` and `transactions`, the `create_invoice_atomic` RPC contract, or the audit trail strategy (or lack thereof).

6. 🔵 **No `.env.example` file** in the repository. Required environment variables are documented in `docs/xero-integration.md` and `AGENTS.md` but could be missed by new developers.

---

## 5. Risk Register

| # | Area | Finding | Severity | Rationale | Recommendation |
|---|------|---------|----------|-----------|----------------|
| R1 | Database | Orphaned functions reference non-existent `payments`, `payment_sequences`, `credit_notes`, `credit_note_items` tables | 🔴 Critical | 9 functions will throw runtime errors if called. Dead code obscures the true architecture. | Drop all orphaned functions after verifying no active callers. |
| R2 | Database | No audit triggers on financial tables (invoices, invoice_items, invoice_payments, transactions, chargeables, tax_rates) | 🔴 Critical | Financial mutations are untracked. No record of who changed what, when. Violates financial audit requirements. | Add `log_table_audit` triggers to all financial tables. |
| R3 | RLS | Invoices INSERT/UPDATE/DELETE policies lack role checks | 🔴 Critical | Any authenticated tenant member (including students) can create, modify, or hard-delete invoices via direct API calls. | Add `tenant_user_has_role()` checks requiring staff (owner/admin/instructor) for INSERT and UPDATE, admin/owner for DELETE. Remove the hard DELETE policy entirely. |
| R4 | RLS | Invoices hard DELETE permitted with no trigger guard | 🔴 Critical | Financial records can be permanently destroyed. No audit trail of deletion. | Remove the DELETE RLS policy. If deletion is needed, enforce soft-delete only via a trigger. |
| R5 | Security | Xero OAuth tokens stored in plaintext | 🟠 High | A database breach or unauthorized admin query would expose tokens that grant access to the tenant's Xero accounting data. | Implement column-level encryption via `pgsodium` or Supabase Vault. |
| R6 | Application | Missing role check on booking check-in approval | 🟠 High | Any authenticated tenant member can approve check-ins and create invoices. Students could approve their own flights. | Add role check requiring staff role. |
| R7 | Database | 28+ SECURITY DEFINER functions with mutable search_path | 🟠 High | Vulnerable to search path injection. An attacker could create a malicious function that is called instead of the intended one with elevated privileges. | Add `SET search_path TO 'public'` to all affected functions. |
| R8 | RLS | Invoice number not unique | 🟠 High | Duplicate invoice numbers can exist. Creates confusion for accounting, Xero sync, and legal compliance. | Add a UNIQUE constraint on `(tenant_id, invoice_number)` where `deleted_at IS NULL`. |
| R9 | Application | Xero callback does not re-verify admin role | 🟠 High | A non-admin who obtains the OAuth state cookie could complete the connection flow. | Add admin role verification in the callback route. |
| R10 | Application | Price manipulation at invoice creation | 🟠 High | Client-submitted `unit_price` is not verified against the chargeable's configured rate. A modified client could submit any price. | Validate `unit_price` matches `chargeable.rate` server-side, or document custom pricing as intentional. |
| R11 | Application | Stale JWT role claims on financial GET endpoints | 🟡 Medium | 4+ routes use claims-based role resolution. A recently-demoted admin retains access until JWT expires (default 1 hour). | Use `authoritativeRole: true` on all financial endpoints. |
| R12 | Database | Non-atomic tax rate default swap | 🟡 Medium | Two separate UPDATE calls can leave a tenant with no default tax rate if the process fails between them. | Replace with a single RPC using a transaction. |
| R13 | Application | Xero export does not filter soft-deleted invoices | 🟡 Medium | A soft-deleted invoice with status pending/paid/overdue could be exported to Xero. | Add `deleted_at IS NULL` filter to the export query. |
| R14 | Application | Dual tax calculation implementation (TS + SQL) | 🟡 Medium | Two independent implementations of the same financial math. Drift between them could cause discrepancies. | Consolidate to a single implementation (preferably the DB function), or add integration tests that verify parity. |
| R15 | Database | Invoice sequences shared across tenants | 🟡 Medium | All tenants share the same invoice number counter. Invoice numbers leak system-wide volume and have inter-tenant gaps. | Add `tenant_id` to the `invoice_sequences` primary key. |
| R16 | Application | No upper bound on Xero export batch size | 🟡 Medium | Unbounded `invoiceIds` array could cause sustained load on Xero API and application. | Add a max length (e.g., 50-100) to the Zod validation. |
| R17 | Application | Concurrent token refresh race condition | 🟡 Medium | Two concurrent requests could both attempt Xero token refresh; the second will fail with an invalid refresh token. | Implement a mutex or optimistic locking on token refresh. |
| R18 | Database | No CHECK constraints on invoice_items quantity/unit_price | 🟡 Medium | Negative quantities or prices are not prevented at the DB level. | Add `CHECK (quantity > 0)` and `CHECK (unit_price >= 0)`. |
| R19 | Application | Error message leakage from RPC calls to client | 🔵 Low | PostgreSQL error details may be returned to the browser via `rpcError.message`. | Map RPC errors to safe user-facing messages. |
| R20 | Application | PII in Xero export logs | 🔵 Low | Email addresses stored in `xero_export_logs.request_payload` during contact sync. | Redact PII from log payloads or restrict log access. |
| R21 | Application | Error message in OAuth callback redirect URL | 🔵 Low | Raw `error.message` passed as URL query param — visible in browser history. | Map errors to safe error codes. |
| R22 | Application | Chargeable_types PATCH missing tenant_id scope | 🔵 Low | The UPDATE query uses `.eq("id", id)` without `.eq("tenant_id", tenantId)`. The existence check does verify tenant, but the update itself could theoretically affect a different tenant's row. | Add `tenant_id` filter to the UPDATE query. |
| R23 | Application | No idempotency on payment recording | 🔵 Low | The `record_invoice_payment_atomic` RPC prevents double-payment via row locking but has no explicit idempotency key. A network retry could trigger a second payment attempt. | Consider adding an idempotency key parameter. |
| R24 | Documentation | Missing documentation for financial flows | 🔵 Low | No docs for invoice lifecycle state machine, payment flow, or audit strategy. | Create financial subsystem documentation. |
| R25 | Database | Leaked password protection disabled | ⚪ Info | Supabase security advisor flagged that HaveIBeenPwned password checking is disabled. | Enable in Supabase Auth settings. |
| R26 | Database | PostgreSQL version has security patches available | ⚪ Info | Current version `17.4.1.054` has outstanding security patches. | Upgrade via Supabase dashboard. |
| R27 | Database | `pg_net` extension installed in public schema | ⚪ Info | Should be in a separate schema per Supabase best practices. | Move to a dedicated schema. |

---

## 6. Appendix

### A. Tables Confirmed Non-Existent

| Table Name | Referenced By | Status |
|------------|---------------|--------|
| payments | 5 functions | ❌ Does not exist |
| payment_sequences | generate_payment_number() | ❌ Does not exist |
| credit_notes | 4 functions | ❌ Does not exist |
| credit_note_items | 2 functions | ❌ Does not exist |

### B. Supabase Security Advisor — Financial Function Alerts

The following financial functions were flagged for mutable `search_path`:

- `process_payment`, `process_payment_atomic`, `process_credit_payment_atomic`
- `reverse_payment_atomic`, `reverse_and_replace_payment_atomic`
- `generate_invoice_number`, `generate_invoice_number_app`, `generate_invoice_number_with_prefix`
- `update_invoice_status_atomic`, `update_invoice_totals_atomic`
- `create_invoice_with_transaction`, `upsert_invoice_items_batch`
- `soft_delete_invoice`, `soft_delete_credit_note`
- `apply_credit_note_atomic`, `generate_credit_note_number`
- `prevent_approved_invoice_modification`, `prevent_approved_invoice_item_modification`
- `prevent_applied_credit_note_modification`, `prevent_applied_credit_note_item_modification`
- `update_transaction_status`, `log_table_audit`
- `begin_transaction`, `commit_transaction`, `rollback_transaction`
- `finalize_booking_checkin_with_invoice_atomic`

### C. Complete RLS Policy Listing (Financial Tables)

```
invoices:
  invoices_tenant_select     | SELECT | USING: user_belongs_to_tenant(tenant_id)
  invoices_tenant_insert     | INSERT | WITH CHECK: user_belongs_to_tenant(tenant_id)
  invoices_tenant_update     | UPDATE | USING: user_belongs_to_tenant(tenant_id)
  invoices_tenant_delete     | DELETE | USING: user_belongs_to_tenant(tenant_id)

invoice_items:
  invoice_items_tenant_select | SELECT | USING: belongs_to_tenant AND (not deleted OR staff)
  invoice_items_tenant_manage | ALL    | USING+CHECK: belongs_to_tenant AND staff

invoice_payments:
  invoice_payments_tenant_select | SELECT | USING: belongs_to_tenant AND (own invoice OR staff)
  invoice_payments_tenant_manage | ALL    | USING+CHECK: belongs_to_tenant AND staff

transactions:
  transactions_tenant_select | SELECT | USING: belongs_to_tenant AND (own OR staff)
  transactions_tenant_manage | ALL    | USING+CHECK: belongs_to_tenant AND staff

chargeables:
  chargeables_tenant_select  | SELECT | USING: belongs_to_tenant
  chargeables_tenant_manage  | ALL    | USING+CHECK: belongs_to_tenant AND admin/owner

chargeable_types:
  chargeable_types_hybrid_select | SELECT | USING: global OR belongs_to_tenant
  chargeable_types_hybrid_insert | INSERT | CHECK: (non-global AND admin) OR (global AND owner)
  chargeable_types_hybrid_update | UPDATE | USING: (non-global AND admin) OR (global AND owner)
  chargeable_types_hybrid_delete | DELETE | USING: owner only

tax_rates:
  tax_rates_tenant_select    | SELECT | USING: belongs_to_tenant
  tax_rates_tenant_manage    | ALL    | USING+CHECK: belongs_to_tenant AND admin/owner

xero_connections:
  xero_connections_tenant_select | SELECT | USING: is_tenant_admin
  xero_connections_tenant_insert | INSERT | CHECK: is_tenant_admin
  xero_connections_tenant_update | UPDATE | USING+CHECK: is_tenant_admin
  xero_connections_tenant_delete | DELETE | USING: is_tenant_admin

xero_accounts:
  xero_accounts_tenant_select | SELECT | USING: belongs_to_tenant
  xero_accounts_tenant_insert | INSERT | CHECK: is_tenant_admin
  xero_accounts_tenant_update | UPDATE | USING+CHECK: is_tenant_admin
  xero_accounts_tenant_delete | DELETE | USING: is_tenant_admin

xero_contacts:
  xero_contacts_tenant_select | SELECT | USING: belongs_to_tenant
  xero_contacts_tenant_insert | INSERT | CHECK: is_tenant_admin
  xero_contacts_tenant_update | UPDATE | USING+CHECK: is_tenant_admin
  xero_contacts_tenant_delete | DELETE | USING: is_tenant_admin

xero_invoices:
  xero_invoices_tenant_select | SELECT | USING: belongs_to_tenant
  xero_invoices_tenant_insert | INSERT | CHECK: is_tenant_admin
  xero_invoices_tenant_update | UPDATE | USING+CHECK: is_tenant_admin
  xero_invoices_tenant_delete | DELETE | USING: is_tenant_admin

xero_export_logs:
  xero_export_logs_tenant_select | SELECT | USING: belongs_to_tenant
  xero_export_logs_tenant_insert | INSERT | CHECK: belongs_to_tenant
```

### D. Financial Table Index Summary

| Table | Indexes |
|-------|---------|
| invoices | PK, user_id, tenant_id, booking_id, deleted_at (partial), deleted_by, unique active booking_id |
| invoice_items | PK, invoice_id, chargeable_id, deleted_at (partial), deleted_by |
| invoice_payments | PK, invoice_id, user_id, paid_at DESC |
| transactions | PK, user_id |
| chargeables | PK, chargeable_type_id |
| chargeable_types | PK, code (unique), code per global (unique), code per tenant (unique) |
| tax_rates | PK, effective_from, is_default, compound lookup (country+region+active+effective) |
| xero_connections | PK, tenant_id (unique), tenant_id |
| xero_accounts | PK, tenant_id, (tenant_id+code), (tenant_id+xero_account_id unique) |
| xero_contacts | PK, tenant_id, user_id, (tenant_id+user_id unique) |
| xero_invoices | PK, tenant_id, invoice_id, (tenant_id+export_status), (tenant_id+invoice_id unique) |
| xero_export_logs | PK, tenant_id, invoice_id, (tenant_id+created_at DESC) |

**Missing indexes**:
- 🟡 `transactions.metadata` — no GIN index for JSONB queries (e.g., `metadata->>'invoice_id'`)
- 🟡 `invoices.status` — no index for status-based filtering (common in listing queries)
- 🟡 `invoices.invoice_number` — no index for invoice number lookups

---

*End of Audit Document. This document is the input to a separate remediation phase. No code changes have been made.*
