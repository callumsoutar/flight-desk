# Invoice Post-Deployment Verification Audit Report

**Invoice Reference**: INV-2026-03-0009  
**Supabase Invoice ID**: `c23b59f7-4b72-4663-911a-c4259bdd4f4e`  
**Xero Invoice ID**: `dc2e65ff-9a93-4898-b634-75bab53170fe`  
**Audit Date**: 2026-03-11  
**Tenant**: Kapiti Aero Club (`8468798c-e37b-4b02-8477-05e62d9b7fe3`)  
**Auditor**: Automated Post-Deployment Verification Agent

---

## 1. Audit Summary

**Overall Verdict: 🟢 PASS with Warnings**

Invoice INV-2026-03-0009 was created on 2026-03-11 05:15:24 UTC, exported to Xero at 05:15:36 UTC, and paid locally at 05:20:50 UTC. The core tax handling fix has been verified as working correctly: Xero received the invoice with `LineAmountTypes: "Inclusive"` and responded with `TaxType: "OUTPUT2"`, `TaxAmount: 1.30`, `SubTotal: 8.70`, and `Total: 10.00` — all mathematically correct for NZ GST at 15%. Supabase financial fields (subtotal, tax_total, total_amount) are fully consistent with the Xero response. Audit logging is comprehensive with 4 lifecycle events captured for the invoice and 1 for the line item. All RLS policies are in place with role-based write controls. Two warnings are raised: (1) the `xero_tax_type` field on the invoice item is `null` — meaning the TaxType was applied by Xero's account defaults rather than being explicitly sent in the request payload; and (2) the `connected_by` field on the Xero connection record is `null`, leaving no audit trail of who authorised the Xero integration.

---

## 2. Xero ↔ Supabase Reconciliation Table

| Field | Xero Response | Supabase Value | Source Table | Status |
|-------|---------------|----------------|-------------|--------|
| InvoiceNumber | `INV-2026-03-0009` | `INV-2026-03-0009` | invoices.invoice_number | ✅ Match |
| Reference | `Flight Plan` | `Flight Plan` | invoices.reference | ✅ Match |
| SubTotal | `8.70` | `8.70` | invoices.subtotal | ✅ Match |
| TotalTax | `1.30` | `1.30` | invoices.tax_total | ✅ Match |
| Total | `10.00` | `10.00` | invoices.total_amount | ✅ Match |
| AmountDue | `10.00` | `0.00` | invoices.balance_due | ⚠️ Expected divergence (paid locally, Xero still DRAFT) |
| AmountPaid | `0.00` | `10.00` | invoices.total_paid | ⚠️ Expected divergence (payment not synced to Xero) |
| Status | `DRAFT` | `paid` | invoices.status | ⚠️ Expected divergence (local payment after export) |
| CurrencyCode | `NZD` | `NZD` | tenants.currency | ✅ Match |
| LineAmountTypes | `Inclusive` | — | Not stored locally | ⚠️ Not persisted in Supabase (see §8) |
| Contact.Name | `Peter Baker` | `Peter Baker` | xero_contacts.xero_contact_name | ✅ Match |
| Contact.ContactID | `2edf01c0-...` | `2edf01c0-...` | xero_contacts.xero_contact_id | ✅ Match |
| Contact.EmailAddress | `callumlebro@gmail.com` | `callumlebro@gmail.com` | users.email | ✅ Match |
| LineItem.Description | `VFR Flight Plan` | `VFR Flight Plan` | invoice_items.description | ✅ Match |
| LineItem.Quantity | `1` | `1` | invoice_items.quantity | ✅ Match |
| LineItem.UnitAmount | `10.00` | `10.00` | invoice_items.rate_inclusive | ✅ Match |
| LineItem.AccountCode | `204` | `204` | invoice_items.gl_code | ✅ Match |
| LineItem.TaxType | `OUTPUT2` | `null` | invoice_items.xero_tax_type | 🟡 Not snapshotted (see Finding W1) |
| LineItem.TaxAmount | `1.30` | `1.30` | invoice_items.tax_amount | ✅ Match |
| LineItem.LineAmount | `10.00` | `10.00` | invoice_items.line_total | ✅ Match |
| Xero InvoiceID | `dc2e65ff-...` | `dc2e65ff-...` | xero_invoices.xero_invoice_id | ✅ Match |

**Reconciliation Result**: 14 of 20 fields are exact matches. 3 are expected divergences due to local payment after Xero export (no payment sync exists). 2 are architectural gaps (LineAmountTypes not stored locally, TaxType not snapshotted). 1 field has a warning for missing data.

---

## 3. Invoice Record

**Source**: `public.invoices` WHERE `id = 'c23b59f7-4b72-4663-911a-c4259bdd4f4e'`

| Field | Value | Assessment |
|-------|-------|------------|
| id | `c23b59f7-4b72-4663-911a-c4259bdd4f4e` | ✅ Valid UUID |
| invoice_number | `INV-2026-03-0009` | ✅ Follows `INV-YYYY-MM-NNNN` convention |
| user_id | `0f3a9d9d-71c4-4b1e-b733-0fbd3e6b79c9` | ✅ Links to Peter Baker |
| status | `paid` | ✅ Correct for fully-paid invoice |
| issue_date | `2026-03-11 00:00:00+00` | ✅ Same day as creation |
| due_date | `2026-03-18 00:00:00+00` | ✅ 7 days from issue (matches tenant default_invoice_due_days: 7) |
| paid_date | `2026-03-11 05:20:50.995792+00` | ✅ Set when payment recorded |
| subtotal | `8.70` | ✅ Ex-GST amount |
| tax_total | `1.30` | ✅ GST component |
| total_amount | `10.00` | ✅ Inclusive total |
| total_paid | `10.00` | ✅ Fully paid |
| balance_due | `0.00` | ✅ Zero balance |
| tax_rate | `0.15` | ✅ 15% NZ GST |
| reference | `Flight Plan` | ✅ Matches Xero |
| payment_method | `credit_card` | ✅ Valid enum value |
| booking_id | `null` | ✅ Standalone invoice (not from check-in) |
| deleted_at | `null` | ✅ Not soft-deleted |
| tenant_id | `8468798c-e37b-4b02-8477-05e62d9b7fe3` | ✅ Kapiti Aero Club |

**Commentary**: The invoice record is complete and internally consistent. All financial fields balance correctly: `subtotal (8.70) + tax_total (1.30) = total_amount (10.00)`, and `total_paid (10.00) = total_amount (10.00)`, producing `balance_due = 0.00`. The `due_date` is exactly 7 days after `issue_date`, matching the tenant's `default_invoice_due_days` setting of 7.

---

## 4. Line Items Review

**Source**: `public.invoice_items` WHERE `invoice_id = 'c23b59f7-...'`

| Field | Value | Xero Value | Status |
|-------|-------|------------|--------|
| description | `VFR Flight Plan` | `VFR Flight Plan` | ✅ |
| quantity | `1` | `1` | ✅ |
| unit_price | `8.695652173913045` | — (ex-tax, not sent to Xero) | ✅ Correct ex-tax unit rate |
| rate_inclusive | `10.00` | `UnitAmount: 10.00` | ✅ |
| amount | `8.70` | — (Xero uses SubTotal at invoice level) | ✅ |
| tax_rate | `0.15` | — (implied by OUTPUT2) | ✅ |
| tax_amount | `1.30` | `TaxAmount: 1.30` | ✅ |
| line_total | `10.00` | `LineAmount: 10.00` | ✅ |
| gl_code | `204` | `AccountCode: 204` | ✅ |
| xero_tax_type | `null` | `TaxType: OUTPUT2` | 🟡 See Finding W1 |
| chargeable_id | `d6d96800-...` | — | ✅ Links to "VFR Flight Plan" chargeable |

### Tax Verification Arithmetic

```
Given: rate_inclusive = $10.00, tax_rate = 15%

Step 1: Ex-tax unit price = 10.00 / 1.15 = 8.695652173913...
Step 2: rate_inclusive = round(8.695652... × 1.15, 2) = round(10.00, 2) = $10.00 ✅
Step 3: line_total = quantity × rate_inclusive = 1 × 10.00 = $10.00 ✅
Step 4: amount (ex-tax) = round(line_total / 1.15, 2) = round(8.695652..., 2) = $8.70 ✅
Step 5: tax_amount = line_total - amount = 10.00 - 8.70 = $1.30 ✅
Step 6: Verify: amount + tax_amount = 8.70 + 1.30 = $10.00 = line_total ✅
```

**GL Code Provenance**: The chargeable record (`d6d96800-...`) has `gl_code: null`. The GL code "204" was inherited from the parent chargeable_type "Airways Fee" (`4b7a90da-...`, `gl_code: "204"`). The cascading fallback (chargeable → chargeable_type) worked correctly and the resolved value was snapshotted to `invoice_items.gl_code`.

---

## 5. Tax Integrity Check

| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| Tenant default tax rate | 15% (0.15) | `tax_rates.rate = 0.1500` (NZ, GST, is_default=true) | ✅ |
| Invoice tax_rate | 0.15 | `invoices.tax_rate = 0.15` | ✅ |
| Line item tax_rate | 0.15 | `invoice_items.tax_rate = 0.15` | ✅ |
| Chargeable is_taxable | true | `chargeables.is_taxable = true` | ✅ |
| GST: 10.00 / 1.15 | 8.695652... | `invoice_items.unit_price = 8.695652173913045` | ✅ |
| Rounded ex-tax | 8.70 | `invoice_items.amount = 8.70` | ✅ |
| Tax component | 1.30 | `invoice_items.tax_amount = 1.30` | ✅ |
| Xero LineAmountTypes | "Inclusive" | Confirmed in `xero_export_logs.request_payload` | ✅ |
| Xero TaxType applied | "OUTPUT2" | Confirmed in `xero_export_logs.response_payload` | ✅ |
| TaxType explicitly sent | "OUTPUT2" in request | **Not present** in `request_payload.LineItems[0]` | 🟡 W1 |

**Detailed TaxType Analysis**: The `xero_export_logs.request_payload` shows the LineItems sent to Xero contained: `Quantity, LineAmount, UnitAmount, AccountCode, Description` — but **no TaxType field**. Xero's API automatically applied `OUTPUT2` based on the account's default tax configuration and the `LineAmountTypes: "Inclusive"` header. While the result is correct (OUTPUT2 is the correct NZ GST type), the application is relying on Xero's server-side defaults rather than explicitly specifying the tax type. This creates a fragile dependency — if the Xero account's default tax settings were changed, the tax type would silently change.

---

## 6. Associated Records Review

### 6.1 Transactions

**Source**: `public.transactions` WHERE `metadata->>'invoice_id' = 'c23b59f7-...'`

| # | Type | Amount | Status | Description | Timestamp | Assessment |
|---|------|--------|--------|-------------|-----------|------------|
| 1 | `debit` | `10.00` | `completed` | Invoice: INV-2026-03-0009 | 2026-03-11 05:15:24 | ✅ Invoice issuance debit |
| 2 | `adjustment` | `10.00` | `completed` | Invoice payment received: INV-2026-03-0009 | 2026-03-11 05:20:50 | ✅ Payment credit |

**Commentary**: The debit transaction was created when the invoice was approved (draft → pending), recording the receivable of $10.00. The adjustment transaction was created when payment was recorded, offsetting the debit. Both transactions are `completed` status and carry correct metadata linking back to the invoice.

The payment transaction (type `adjustment` rather than `credit`) uses the `record_invoice_payment_atomic` RPC's convention. The metadata correctly records `created_by: b47156ce-...` (the admin user), `payment_method: credit_card`, and `transaction_type: invoice_payment`.

### 6.2 Invoice Payments

**Source**: `public.invoice_payments` WHERE `invoice_id = 'c23b59f7-...'`

| Field | Value | Assessment |
|-------|-------|------------|
| amount | `10.00` | ✅ Matches invoice total |
| payment_method | `credit_card` | ✅ Valid method |
| paid_at | `2026-03-11 05:20:50.995792+00` | ✅ Matches invoice.paid_date |
| transaction_id | `ba085852-...` | ✅ Links to adjustment transaction |
| created_by | `b47156ce-...` | ✅ Staff user who recorded payment |
| user_id | `0f3a9d9d-...` | ✅ Invoice recipient (Peter Baker) |

**Commentary**: One payment record exists, fully paying the invoice. The `transaction_id` correctly links to the adjustment transaction, creating a verifiable chain: `invoice_payments` → `transactions` → `invoices` (via metadata). The `paid_at` timestamp is identical to `invoices.paid_date` and `transactions[1].completed_at`, confirming atomicity.

### 6.3 Contact/Customer Record

**Source**: `public.xero_contacts` JOIN `public.users`

| Field | Supabase | Xero Response | Status |
|-------|----------|---------------|--------|
| Name | `Peter Baker` | `Peter Baker` | ✅ |
| Email | `callumlebro@gmail.com` | `callumlebro@gmail.com` | ✅ |
| Xero ContactID | `2edf01c0-f535-4905-9dba-316875d7f573` | `2edf01c0-f535-4905-9dba-316875d7f573` | ✅ |
| last_synced_at | `2026-03-11 05:15:35.781+00` | — | ✅ Synced during export |

**Commentary**: The contact was synced to Xero immediately before the invoice export (05:15:35, one second before the export at 05:15:36). The local `xero_contacts` record correctly stores the Xero ContactID, enabling future lookups without re-syncing.

---

## 7. Audit Log Review

**Source**: `public.audit_logs` WHERE `record_id = 'c23b59f7-...'` (invoice) and `record_id = '4a1fda60-...'` (line item)

### Invoice Audit Trail (4 events)

| # | Action | Timestamp | User | Key Changes | Status |
|---|--------|-----------|------|-------------|--------|
| 1 | `INSERT` | 05:15:24.505 | `b47156ce-...` | Initial creation as `draft`, subtotal=8.70, tax_total=1.30, total=10.00 | ✅ |
| 2 | `UPDATE` | 05:15:24.704 | `b47156ce-...` | `updated_at` changed (totals recalculation) | ✅ |
| 3 | `UPDATE` | 05:15:24.779 | `b47156ce-...` | `status: draft → pending` | ✅ |
| 4 | `UPDATE` | 05:20:50.995 | `b47156ce-...` | `status: pending → paid`, `total_paid: 0 → 10`, `balance_due: 10 → 0`, `paid_date` set, `payment_method: credit_card` | ✅ |

### Line Item Audit Trail (1 event)

| # | Action | Timestamp | User | Status |
|---|--------|-----------|------|--------|
| 1 | `INSERT` | 05:15:24.621 | `b47156ce-...` | ✅ Full snapshot captured: amount=8.70, tax_amount=1.30, gl_code="204" |

**Commentary**: The audit trail is comprehensive. Every state transition is captured with full before/after snapshots in `old_data`/`new_data` and granular `column_changes` for UPDATE operations. The lifecycle is clearly traceable: `draft` → totals recalculated → `pending` (approved) → `paid`. All events are attributed to user `b47156ce-...` (the acting staff member). The `tenant_id` is correctly populated on all audit log entries, enabling tenant-scoped audit queries.

The time span from creation to approval was ~275ms (05:15:24.505 → 05:15:24.779), indicating the atomic RPC chain executed correctly. Payment was recorded ~5 minutes later at 05:20:50.

---

## 8. Xero Sync/Export Records

### xero_invoices

**Source**: `public.xero_invoices` WHERE `invoice_id = 'c23b59f7-...'`

| Field | Value | Assessment |
|-------|-------|------------|
| xero_invoice_id | `dc2e65ff-9a93-4898-b634-75bab53170fe` | ✅ Matches Xero response |
| export_status | `exported` | ✅ |
| exported_at | `2026-03-11 05:15:36.311+00` | ✅ ~12 seconds after creation |
| error_message | `null` | ✅ No errors |
| tenant_id | `8468798c-...` | ✅ Correct tenant |

### xero_export_logs

**Source**: `public.xero_export_logs` WHERE `invoice_id = 'c23b59f7-...'`

| Field | Value | Assessment |
|-------|-------|------------|
| action | `export_invoice` | ✅ |
| status | `success` | ✅ |
| initiated_by | `b47156ce-...` | ✅ Acting user |
| request_payload.LineAmountTypes | `"Inclusive"` | ✅ GST-inclusive pricing |
| request_payload.Status | `"DRAFT"` | ✅ Exported as draft to Xero |
| response_payload.Invoices[0].TaxType | `"OUTPUT2"` | ✅ Correct NZ GST type |
| response_payload.Invoices[0].BrandingThemeID | `cb9dbba4-44d7-469f-b892-b85fd0a0b386` | ✅ Xero branding theme present |
| response_payload.ProviderName | `"Flight Desk"` | ✅ App identified |

**Commentary**: The export log contains full request and response payloads, providing a complete audit trail of exactly what was sent to and received from Xero. The response confirms Xero accepted the invoice without errors (`HasErrors: false`, `HasValidationErrors: false` on contact). The BrandingThemeID is present in the response, confirming Xero applied a branding theme to the invoice.

---

## 9. Organisation/Tenant Record

**Source**: `public.tenants` + `public.tenant_settings` + `public.tax_rates` + `public.xero_connections`

| Check | Value | Status |
|-------|-------|--------|
| Tenant name | `Kapiti Aero Club` | ✅ |
| GST number | `12-345-678` | ✅ Registered for GST |
| Currency | `NZD` | ✅ NZ Dollars |
| Timezone | `Pacific/Auckland` | ✅ |
| Default tax rate | `0.1500` (GST, NZ, is_default=true) | ✅ |
| Tax rate effective_from | `2025-07-23` | ✅ Effective before invoice date |
| Xero connected | `settings.xero.enabled = true` | ✅ |
| Xero connected_at | `2026-03-10T02:34:22.948Z` | ✅ Connected day before |
| Xero connection connected_by | `null` | 🟡 W2: No audit trail of who connected |
| Xero scopes | `accounting.contacts accounting.settings.read accounting.invoices offline_access` | ✅ Appropriate scopes |
| Invoice prefix setting | `INV` | ✅ Matches invoice number format |
| Default due days | `7` | ✅ Matches invoice due_date (issue + 7 days) |

---

## 10. Security & Compliance Assessment

### RLS Coverage

| Table | RLS Enabled | Write Policy | Status |
|-------|-------------|-------------|--------|
| invoices | ✅ | INSERT/UPDATE require staff role (`owner`/`admin`/`instructor`). No DELETE policy (hard delete blocked by trigger). | ✅ |
| invoice_items | ✅ | ALL requires staff role. SELECT allows tenant members (hides soft-deleted from non-staff). | ✅ |
| invoice_payments | ✅ | ALL requires staff role. SELECT allows own-invoice or staff. | ✅ |
| transactions | ✅ | ALL requires staff role. SELECT allows own or staff. | ✅ |
| xero_invoices | ✅ | INSERT/UPDATE/DELETE require `is_tenant_admin`. SELECT allows tenant members. | ✅ |
| xero_export_logs | ✅ | INSERT requires staff role. SELECT allows tenant members. | ✅ |
| xero_contacts | ✅ | INSERT/UPDATE/DELETE require `is_tenant_admin`. SELECT allows tenant members. | ✅ |
| xero_connections | ✅ | All operations require `is_tenant_admin`. | ✅ |
| chargeables | ✅ | Write requires admin/owner. | ✅ |
| tax_rates | ✅ | Write requires admin/owner. | ✅ |
| audit_logs | ✅ | — | ✅ |
| tenants | ✅ | — | ✅ |
| tenant_users | ✅ | — | ✅ |
| users | ✅ | — | ✅ |

**Assessment**: All 14 tables touched by this invoice have RLS enabled. Invoice write operations (INSERT, UPDATE) require staff role membership. Hard deletion of invoices is blocked by both the absence of a DELETE RLS policy and a `BEFORE DELETE` trigger (`prevent_invoice_hard_delete`). This is a significant improvement from the prior audit where all invoice write policies only required tenant membership.

### Data Integrity Constraints

| Constraint | Status |
|------------|--------|
| invoice_items.quantity > 0 CHECK | ✅ Enforced (added in recent migration) |
| invoice_items.unit_price >= 0 CHECK | ✅ Enforced (added in recent migration) |
| invoices.tax_rate >= 0 CHECK | ✅ Enforced |
| invoice_payments.amount > 0 CHECK | ✅ Enforced |
| transactions.amount != 0 CHECK | ✅ Enforced |
| Unique invoice_number per tenant (WHERE deleted_at IS NULL) | ✅ Enforced (added in recent migration) |
| Soft delete only on invoices (trigger guard) | ✅ Enforced |
| Invoice immutability trigger (approved invoices) | ✅ In place |
| Invoice item immutability trigger (INSERT/UPDATE/DELETE on approved) | ✅ In place |

---

## 11. Finance Best Practice Assessment

### Double-Entry Accounting Compliance

The transaction model uses a single-entry ledger with `debit`/`credit`/`adjustment` types rather than true double-entry. For this invoice:

- **Debit**: $10.00 (invoice issued — receivable created)
- **Adjustment**: $10.00 (payment received — receivable cleared)

While not true double-entry (there are no contra-accounts, no journal entries to a general ledger), this is adequate for an accounts-receivable tracking system where Xero serves as the book of record. The local system functions as a sub-ledger feeding into Xero.

### NZ GST Compliance

| Requirement | Status |
|-------------|--------|
| 15% GST rate applied | ✅ |
| GST-inclusive pricing (LineAmountTypes: Inclusive) | ✅ |
| OUTPUT2 tax type (standard GST on sales) | ✅ Applied by Xero |
| GST number on organisation | ✅ `12-345-678` |
| Tax amounts mathematically correct | ✅ 10.00 / 1.15 = 8.70 + 1.30 |
| Monetary values stored as numeric (not float) | ✅ All use `numeric` type |
| Rounding to 2 decimal places | ✅ |

### Audit Trail Completeness

| Requirement | Status |
|-------------|--------|
| All mutations logged with who, what, when | ✅ 5 audit log entries (4 invoice + 1 line item) |
| Full before/after state captured | ✅ old_data/new_data on all UPDATEs |
| Column-level change tracking | ✅ column_changes populated |
| Acting user recorded | ✅ user_id on all entries |
| Tenant isolation on audit logs | ✅ tenant_id populated |
| Xero export request/response logged | ✅ Full payloads in xero_export_logs |
| Payment event linked to transaction | ✅ invoice_payments.transaction_id |

---

## 12. Overall Verdict

### 🟢 PASS — with 2 Warnings

The invoice has been created, exported to Xero, and paid with full data integrity across all Supabase tables. The tax handling fix is confirmed working: `LineAmountTypes: "Inclusive"` was sent to Xero, and the correct GST calculations (SubTotal: 8.70, TotalTax: 1.30, Total: 10.00) are reflected in both systems.

### Findings

| # | Severity | Area | Finding |
|---|----------|------|---------|
| W1 | 🟡 Warning | Tax Type Snapshot | The `invoice_items.xero_tax_type` field is `null` for this line item. The Xero API applied `TaxType: "OUTPUT2"` based on the account's default tax settings, not because the application explicitly sent it. The `request_payload` in `xero_export_logs` confirms no `TaxType` field was included in the LineItems array sent to Xero. **Risk**: If the Xero account's default tax settings are changed, future invoices could silently receive a different tax type. **Recommendation**: The export function should explicitly include `TaxType` in the request when the chargeable is taxable, and snapshot the resolved value to `invoice_items.xero_tax_type` at creation time. |
| W2 | 🟡 Warning | Audit Trail | The `xero_connections.connected_by` field is `null`. There is no record of which user authorised the Xero integration connection for this tenant. **Recommendation**: Ensure the OAuth callback sets `connected_by` to the authenticated user's ID. |
| P1 | 🟢 Pass | Financial Integrity | All financial amounts balance: subtotal + tax_total = total_amount, total_paid = total_amount, balance_due = 0. Transaction amounts match invoice totals. |
| P2 | 🟢 Pass | Tax Arithmetic | GST calculation is mathematically correct: $10.00 / 1.15 = $8.6956... → rounded to $8.70 ex-tax, $1.30 tax. |
| P3 | 🟢 Pass | Xero Sync | Invoice exported successfully with correct InvoiceID stored. Export log captures full request/response payloads. |
| P4 | 🟢 Pass | Audit Logging | 5 audit log entries capture the complete invoice lifecycle from creation through payment. |
| P5 | 🟢 Pass | RLS Security | All 14 tables have RLS enabled with role-based write controls on financial tables. Hard deletion of invoices is blocked at both the policy and trigger level. |
| P6 | 🟢 Pass | Contact Linkage | Xero contact correctly linked with matching ContactID, name, and email. |
| P7 | 🟢 Pass | Payment Integrity | Payment record links to transaction, amounts match, timestamps are consistent across all three tables (invoices, invoice_payments, transactions). |

---

*End of Audit Report*
