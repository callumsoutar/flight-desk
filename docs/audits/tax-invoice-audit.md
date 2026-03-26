# Tax Invoice Audit — Xero Export Missing Tax

> **Date:** 2026-03-11
> **Scope:** Root-cause investigation into Xero invoices being created with TaxType: "NONE", TaxAmount: 0.00, and LineAmountTypes: "Exclusive" despite the organisation having GST (15%) configured
> **Affected Xero Invoice:** `c272b76b-00b1-4dda-90c3-19413b89e47a`
> **Affected Supabase Invoice:** `0736221a-3cc7-4560-81ba-0592dfbebb32`
> **Status:** Root cause identified, fix provided

---

## 1. Executive Summary

All invoices exported to Xero from this application are created with zero tax applied — `TaxType: "NONE"`, `TaxAmount: 0.00`, and `LineAmountTypes: "Exclusive"` — despite the tenant having a 15% NZ GST rate correctly configured and tax working throughout the internal application. The root cause is a compound failure across three layers: (1) the Xero invoice payload omits `LineAmountTypes: "Inclusive"`, causing Xero to default to "Exclusive" treatment; (2) the `xero_tax_type` field is `null` on every chargeable and invoice item in the tenant, and the `default_tax_type` in tenant settings is also not configured, causing the export code to fall through to a hardcoded `"NONE"` fallback; (3) the payload sends ex-GST amounts (`unit_price` and `amount`) as `UnitAmount` and `LineAmount` instead of the GST-inclusive values (`rate_inclusive` and `line_total`), meaning even if tax were applied, the base amounts would be wrong for a tax-inclusive model. The combined effect is that the Xero invoice total is $8.70 (ex-GST) with no tax, instead of the correct $10.00 inclusive of $1.30 GST.

---

## 2. System Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│                      Invoice Creation                        │
│                                                              │
│  ┌─────────────┐    ┌──────────────────┐    ┌────────────┐  │
│  │ UI Form or  │───▶│ actions.ts       │───▶│ Supabase   │  │
│  │ Booking     │    │ (server action)  │    │ invoices + │  │
│  │ Check-in    │    │                  │    │ invoice_   │  │
│  │             │    │ • resolves       │    │ items      │  │
│  │             │    │   chargeables    │    │            │  │
│  │             │    │ • gets tax_rate  │    │ tax_rate,  │  │
│  │             │    │   from tax_rates │    │ amount,    │  │
│  │             │    │ • calculates     │    │ tax_amount │  │
│  │             │    │   amounts        │    │ gl_code,   │  │
│  │             │    │ • snapshots      │    │ xero_tax_  │  │
│  │             │    │   gl_code &      │    │ type       │  │
│  │             │    │   xero_tax_type  │    │            │  │
│  └─────────────┘    └──────────────────┘    └─────┬──────┘  │
│                                                    │         │
│  ┌─────────────┐    ┌──────────────────┐    ┌─────▼──────┐  │
│  │ Xero API    │◀───│ export-invoice   │◀───│ Reads      │  │
│  │ PUT /Invoice│    │ .ts              │    │ invoice +  │  │
│  │             │    │                  │    │ items +    │  │
│  │ Creates     │    │ • builds payload │    │ xero       │  │
│  │ DRAFT       │    │ • resolves GL    │    │ settings   │  │
│  │ invoice     │    │ • resolves tax   │    │            │  │
│  │             │    │ • syncs contact  │    │            │  │
│  └─────────────┘    └──────────────────┘    └────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

**Key data flow for tax:**

1. **Tax rate source:** `tax_rates` table → tenant's default rate (0.15 = 15% GST)
2. **Chargeable tax flag:** `chargeables.is_taxable` determines if tax applies
3. **Invoice creation:** `calculateItemAmounts()` computes ex-GST `amount`, `tax_amount`, and GST-inclusive `rate_inclusive`, `line_total`
4. **Xero tax type source:** `chargeables.xero_tax_type` → snapshotted to `invoice_items.xero_tax_type` → used at export
5. **Xero export:** `export-invoice.ts` reads items, resolves GL codes and tax types, builds Xero API payload

---

## 3. Tax Configuration Audit

### 3.1 Tax Rate (Supabase)

```sql
-- Query:
SELECT id, rate, is_default, is_active, tax_name, effective_from
FROM tax_rates WHERE tenant_id = '8468798c-e37b-4b02-8477-05e62d9b7fe3'
```

| Field | Value |
|---|---|
| `rate` | 0.1500 |
| `is_default` | true |
| `is_active` | true |
| `tax_name` | GST |
| `effective_from` | 2025-07-23 |

**Finding:** Tax rate is correctly configured as 15% NZ GST. ✅

### 3.2 Tenant Settings — Xero Namespace

```sql
-- Query:
SELECT settings->'xero' FROM tenant_settings
WHERE tenant_id = '8468798c-e37b-4b02-8477-05e62d9b7fe3'
```

```json
{
  "enabled": true,
  "connected_at": "2026-03-10T02:34:22.948Z"
}
```

**Finding:** The Xero settings are missing both `default_tax_type` and `default_revenue_account_code`. These fields have never been set. The `resolveXeroSettings()` function returns `null` for both. ❌

### 3.3 Chargeables — xero_tax_type

```sql
-- Query:
SELECT name, is_taxable, gl_code, xero_tax_type
FROM chargeables
WHERE tenant_id = '8468798c-e37b-4b02-8477-05e62d9b7fe3' AND is_active = true
```

**Finding:** Every single chargeable (20 items) has `xero_tax_type = null` and `gl_code = null`. All are `is_taxable = true`. The GL codes are inherited from `chargeable_types` at invoice creation time. ❌

### 3.4 Chargeable Type for This Invoice

```sql
-- Query:
SELECT id, code, gl_code, name FROM chargeable_types
WHERE id = '4b7a90da-4255-4969-802f-5b9fb810c486'
```

| Field | Value |
|---|---|
| `name` | Airways Fee |
| `code` | airways_fee |
| `gl_code` | 204 |

**Finding:** The chargeable type has `gl_code = "204"` which is correctly resolved and used. ✅

### 3.5 Invoice Record

```sql
-- Query:
SELECT * FROM invoices WHERE id = '0736221a-3cc7-4560-81ba-0592dfbebb32'
```

| Field | Value |
|---|---|
| `invoice_number` | INV-2026-03-0007 |
| `status` | paid |
| `tax_rate` | 0.15 |
| `subtotal` | 8.70 |
| `tax_total` | 1.30 |
| `total_amount` | 10.00 |
| `total_paid` | 10.00 |
| `balance_due` | 0.00 |

**Finding:** Invoice correctly stores 15% GST. SubTotal ($8.70) + Tax ($1.30) = Total ($10.00). ✅

### 3.6 Invoice Line Items

```sql
-- Query:
SELECT * FROM invoice_items
WHERE invoice_id = '0736221a-3cc7-4560-81ba-0592dfbebb32'
```

| Field | Value |
|---|---|
| `description` | VFR Flight Plan |
| `quantity` | 1 |
| `unit_price` | 8.695652173913045 (ex-GST base) |
| `amount` | 8.70 (ex-GST line total) |
| `tax_rate` | 0.15 |
| `tax_amount` | 1.30 |
| `rate_inclusive` | 10.00 (GST-inclusive unit rate) |
| `line_total` | 10.00 (GST-inclusive line total) |
| `gl_code` | 204 |
| **`xero_tax_type`** | **null** ❌ |

**Finding:** Tax is computed correctly in the database. The GST-inclusive total of $10.00 is correct. However, `xero_tax_type` is `null`, which is the proximate cause of the Xero export bug.

### 3.7 What Was Actually Sent to Xero

From `xero_export_logs`:

```json
{
  "Type": "ACCREC",
  "Contact": { "ContactID": "4d9eb289-ca72-4948-85b2-83c6e0b41c9d" },
  "Date": "2026-03-11",
  "DueDate": "2026-03-18",
  "InvoiceNumber": "INV-2026-03-0007",
  "Reference": "VFR Flight Plan",
  "Status": "DRAFT",
  "LineItems": [
    {
      "Description": "VFR Flight Plan",
      "Quantity": 1,
      "UnitAmount": 8.695652173913045,
      "AccountCode": "204",
      "TaxType": "NONE",
      "LineAmount": 8.7
    }
  ]
}
```

**Critical failures in this payload:**

| Issue | Expected | Actual | Impact |
|---|---|---|---|
| `LineAmountTypes` | `"Inclusive"` | **missing** (Xero defaults to `"Exclusive"`) | Xero interprets amounts as ex-tax |
| `TaxType` | `"OUTPUT2"` or omitted | `"NONE"` | Xero applies zero tax |
| `UnitAmount` | 10.00 (GST-inclusive) | 8.695652... (ex-GST) | Wrong unit price for inclusive model |
| `LineAmount` | 10.00 (GST-inclusive) | 8.70 (ex-GST) | Wrong line total for inclusive model |

### 3.8 What Xero Created

```json
{
  "Total": 8.70,
  "SubTotal": 8.70,
  "TotalTax": 0,
  "LineAmountTypes": "Exclusive",
  "LineItems": [{
    "TaxType": "NONE",
    "TaxAmount": 0,
    "LineAmount": 8.70,
    "UnitAmount": 8.70
  }]
}
```

**Result:** An invoice for $8.70 with no tax, instead of $10.00 inclusive of $1.30 GST.

---

## 4. Code Investigation

### 4.1 File: `lib/xero/export-invoice.ts` — Payload Construction

**Issue 1: Missing `LineAmountTypes`**

```typescript
// Lines 146-162 — buildPayload function
const buildPayload = (xeroContactId: string) => ({
  Type: "ACCREC" as const,
  Contact: { ContactID: xeroContactId },
  Date: invoice.issue_date.slice(0, 10),
  DueDate: invoice.due_date ? invoice.due_date.slice(0, 10) : null,
  InvoiceNumber: invoice.invoice_number ?? invoice.id,
  Reference: invoice.reference ?? null,
  Status: "DRAFT" as const,
  // ❌ NO LineAmountTypes — Xero defaults to "Exclusive"
  LineItems: resolvedItems.map((item) => ({
    Description: item.description,
    Quantity: item.quantity,
    UnitAmount: item.unit_price,      // ❌ ex-GST unit price
    AccountCode: item.gl_code!,
    TaxType: item.xero_tax_type!,     // ❌ "NONE" due to fallback
    LineAmount: item.amount,          // ❌ ex-GST line amount
  })),
})
```

**Issue 2: Wrong amount fields selected**

```typescript
// Lines 77-81 — invoice items query
admin
  .from("invoice_items")
  .select("description, quantity, unit_price, amount, tax_rate, gl_code, xero_tax_type")
  // ❌ MISSING: rate_inclusive, line_total (the GST-inclusive values)
```

**Issue 3: TaxType fallback chain resolves to "NONE"**

```typescript
// Lines 94-101 — default resolution
const defaultGlCode = xeroSettings.default_revenue_account_code  // null
const defaultTaxType = xeroSettings.default_tax_type              // null

const resolvedItems = items.map((item) => ({
  ...item,
  gl_code: item.gl_code ?? defaultGlCode,            // "204" (ok)
  xero_tax_type: item.xero_tax_type ?? defaultTaxType ?? null,  // null ?? null ?? null = null
}))
```

```typescript
// Lines 136-144 — TaxType enforcement
for (const item of resolvedItems) {
  const isTaxable = (item.tax_rate ?? 0) > 0          // true (0.15 > 0)
  if (!isTaxable) {
    item.xero_tax_type = "NONE"
    continue
  }
  item.xero_tax_type = item.xero_tax_type ?? defaultTaxType ?? "NONE"
  // null ?? null ?? "NONE" = "NONE" ❌
}
```

### 4.2 File: `lib/xero/types.ts` — Missing LineAmountTypes

```typescript
// Lines 79-88 — payload type has no LineAmountTypes field
export type XeroCreateInvoicePayload = {
  Type: "ACCREC"
  Contact: { ContactID: string }
  Date: string
  DueDate: string | null
  InvoiceNumber: string
  Reference: string | null
  Status: "DRAFT"
  LineItems: XeroInvoiceLineItem[]
  // ❌ NO LineAmountTypes field
}
```

```typescript
// Lines 70-77 — TaxType is required, should be optional
export type XeroInvoiceLineItem = {
  Description: string
  Quantity: number
  UnitAmount: number
  AccountCode: string
  TaxType: string       // ❌ Required — should be optional for "let Xero decide" cases
  LineAmount: number
}
```

### 4.3 File: `app/invoices/new/actions.ts` — Invoice Creation

```typescript
// Line 159 — xero_tax_type snapshot at creation
xero_tax_type: taxRate > 0 ? chargeable.xero_tax_type ?? defaultXeroTaxType : null,
// For this invoice:
// taxRate = 0.15 (> 0)
// chargeable.xero_tax_type = null
// defaultXeroTaxType = null (settings not configured)
// Result: null → stored on invoice_item as null
```

**Finding:** The invoice creation code correctly attempts to resolve `xero_tax_type` from chargeable → settings default → null. The problem is upstream: neither the chargeable nor the settings have this value configured.

### 4.4 File: `lib/invoices/invoice-calculations.ts` — Amount Calculations

```typescript
// Lines 45-48 — amount calculation model
const rateInclusive = roundToTwoDecimals(unitPrice * (1 + taxRate))  // 8.6957 * 1.15 = 10.00
const lineTotal = roundToTwoDecimals(quantity * rateInclusive)       // 1 * 10.00 = 10.00
const amount = roundToTwoDecimals(lineTotal / (1 + taxRate))         // 10.00 / 1.15 = 8.70
const taxAmount = roundToTwoDecimals(lineTotal - amount)             // 10.00 - 8.70 = 1.30
```

**Finding:** The calculation model treats `unitPrice` as the ex-tax base price. It computes both tax-inclusive (`rate_inclusive`, `line_total`) and tax-exclusive (`amount`, `tax_amount`) values. The export code incorrectly uses the ex-tax values for a system that should export tax-inclusive amounts.

### 4.5 File: `app/api/bookings/[id]/checkin/approve/route.ts` — Booking Check-in Path

The booking check-in approval route has separate GL code and xero_tax_type backfill logic (lines 161-241). It does set `xero_tax_type` for items with chargeables but only if `(item.tax_rate ?? 0) > 0` and the chargeable has `xero_tax_type` set. Since no chargeables have `xero_tax_type` set, the backfill produces `null` for all items created via this path as well.

### 4.6 File: `lib/settings/xero-settings.ts` — Default Settings

```typescript
export const DEFAULT_XERO_SETTINGS: XeroSettings = {
  enabled: false,
  connected_at: null,
  default_revenue_account_code: null,  // ← used as GL code fallback
  default_tax_type: null,              // ← used as TaxType fallback
  auto_export_on_approve: false,
}
```

**Finding:** The defaults are `null`, which is correct. The real problem is the export code using `"NONE"` as a final fallback instead of omitting TaxType to let Xero decide.

---

## 5. Root Cause

The bug is a compound failure across three distinct points:

### Root Cause 1: Missing `LineAmountTypes: "Inclusive"`

The `buildPayload()` function in `export-invoice.ts` does not include `LineAmountTypes` in the Xero payload. The Xero API defaults to `"Exclusive"` when this field is omitted. Since all invoices in this application are tax-inclusive (amounts include GST), the payload MUST specify `"Inclusive"` so that Xero correctly back-calculates the tax component from the inclusive amounts.

### Root Cause 2: `TaxType` Defaults to `"NONE"` Instead of Being Omitted

The tax type resolution chain (`invoice_items.xero_tax_type` → `xeroSettings.default_tax_type` → `"NONE"`) uses a hardcoded `"NONE"` as the final fallback. According to Xero's own best practice documentation:

> *"Leave the TaxType and TaxAmount empty. Xero will automatically use the Tax Rate set up in Xero for the AccountCode you specified."*

When `xero_tax_type` is null and no default is configured, the export should **omit** the `TaxType` field entirely, allowing Xero to apply the tax rate associated with the AccountCode. Instead, it explicitly sets `"NONE"`, which instructs Xero to apply zero tax.

### Root Cause 3: Wrong Amount Fields — ex-GST Values Sent Instead of GST-Inclusive

The export sends `item.unit_price` (ex-GST base price) as `UnitAmount` and `item.amount` (ex-GST line total) as `LineAmount`. For a tax-inclusive model with `LineAmountTypes: "Inclusive"`, these should be `item.rate_inclusive` (GST-inclusive unit rate) and `item.line_total` (GST-inclusive line total). The export query doesn't even select `rate_inclusive` or `line_total` from the database.

### Why It Didn't Fail Loudly

Xero accepted the payload without error because `TaxType: "NONE"` is a valid Xero tax type. The export was logged as `status: "success"`. The invoice was created in Xero — just with the wrong amounts and no tax. There was no validation step comparing the Xero-side totals against the Supabase-side totals.

### Chargeables and Chargeable Types

The `xero_tax_type` column on the `chargeables` table is `null` for all 20 active chargeables in this tenant. This column was added during the Xero integration migration but was never populated as part of the setup flow. The GL code resolution (via `chargeable_types.gl_code`) works correctly because the chargeable types DO have GL codes configured. But there is no equivalent `xero_tax_type` on `chargeable_types` — it only exists on `chargeables` directly.

---

## 6. Xero API Requirements — Correct Tax-Inclusive Payload

### What Xero Requires

Per Xero's invoice creation documentation:

- **`LineAmountTypes: "Inclusive"`** — MUST be set when line amounts include tax
- **`TaxType`** — either set to the correct Xero tax type code (e.g. `"OUTPUT2"` for NZ GST on revenue) or **omitted** to let Xero apply the account's default tax rate
- **`UnitAmount`** — when Inclusive, this is the tax-inclusive unit price
- **`LineAmount`** — when Inclusive, this is the tax-inclusive line total
- **Do NOT send `TaxAmount`** — Xero calculates this automatically and sending it can cause rounding discrepancies

### Correct Payload for Invoice INV-2026-03-0007

```json
{
  "Type": "ACCREC",
  "Contact": {
    "ContactID": "4d9eb289-ca72-4948-85b2-83c6e0b41c9d"
  },
  "Date": "2026-03-11",
  "DueDate": "2026-03-18",
  "InvoiceNumber": "INV-2026-03-0007",
  "Reference": "VFR Flight Plan",
  "Status": "DRAFT",
  "LineAmountTypes": "Inclusive",
  "LineItems": [
    {
      "Description": "VFR Flight Plan",
      "Quantity": 1,
      "UnitAmount": 10.00,
      "AccountCode": "204",
      "TaxType": "OUTPUT2",
      "LineAmount": 10.00
    }
  ]
}
```

### Expected Xero Result

| Field | Value |
|---|---|
| `LineAmountTypes` | Inclusive |
| `SubTotal` | 8.70 (ex-GST, calculated by Xero) |
| `TotalTax` | 1.30 (GST component, calculated by Xero) |
| `Total` | 10.00 (GST-inclusive) |
| `TaxType` | OUTPUT2 |
| `TaxAmount` (per line) | 1.30 (calculated by Xero) |

### Alternative: Omit TaxType (Xero Best Practice)

If the Xero account code 204 has GST (OUTPUT2) configured as its default tax rate in Xero, the TaxType can be omitted entirely:

```json
{
  "LineAmountTypes": "Inclusive",
  "LineItems": [
    {
      "Description": "VFR Flight Plan",
      "Quantity": 1,
      "UnitAmount": 10.00,
      "AccountCode": "204",
      "LineAmount": 10.00
    }
  ]
}
```

Xero will apply the account's default tax rate automatically. This is Xero's recommended best practice.

---

## 7. The Fix

### 7.1 Changes Required

| File | Change |
|---|---|
| `lib/xero/types.ts` | Add `LineAmountTypes` to payload type, make `TaxType` optional |
| `lib/xero/export-invoice.ts` | Add `LineAmountTypes: "Inclusive"`, use inclusive amounts, fix TaxType resolution |

### 7.2 File: `lib/xero/types.ts` — Updated Types

```typescript
export type XeroInvoiceLineItem = {
  Description: string
  Quantity: number
  UnitAmount: number
  AccountCode: string
  TaxType?: string
  LineAmount: number
}

export type XeroCreateInvoicePayload = {
  Type: "ACCREC"
  Contact: { ContactID: string }
  Date: string
  DueDate: string | null
  InvoiceNumber: string
  Reference: string | null
  Status: "DRAFT"
  LineAmountTypes: "Inclusive" | "Exclusive" | "NoTax"
  LineItems: XeroInvoiceLineItem[]
}
```

### 7.3 File: `lib/xero/export-invoice.ts` — Updated Export Logic

**Change 1: Select inclusive amount fields**

```typescript
// Before:
.select("description, quantity, unit_price, amount, tax_rate, gl_code, xero_tax_type")

// After:
.select("description, quantity, unit_price, amount, tax_rate, tax_amount, gl_code, xero_tax_type, rate_inclusive, line_total")
```

**Change 2: Fix TaxType resolution — follow Xero best practice**

```typescript
// Before:
for (const item of resolvedItems) {
  const isTaxable = (item.tax_rate ?? 0) > 0
  if (!isTaxable) {
    item.xero_tax_type = "NONE"
    continue
  }
  item.xero_tax_type = item.xero_tax_type ?? defaultTaxType ?? "NONE"
}

// After:
for (const item of resolvedItems) {
  const isTaxable = (item.tax_rate ?? 0) > 0
  if (!isTaxable) {
    item.xero_tax_type = "NONE"
    continue
  }
  // If an explicit Xero tax type is configured, use it.
  // Otherwise, omit TaxType entirely — Xero will apply
  // the default tax rate for the AccountCode.
  if (!item.xero_tax_type) {
    item.xero_tax_type = null
  }
}
```

**Change 3: Add `LineAmountTypes: "Inclusive"` and use inclusive amounts**

```typescript
const buildPayload = (xeroContactId: string) => ({
  Type: "ACCREC" as const,
  Contact: { ContactID: xeroContactId },
  Date: invoice.issue_date.slice(0, 10),
  DueDate: invoice.due_date ? invoice.due_date.slice(0, 10) : null,
  InvoiceNumber: invoice.invoice_number ?? invoice.id,
  Reference: invoice.reference ?? null,
  Status: "DRAFT" as const,
  LineAmountTypes: "Inclusive" as const,
  LineItems: resolvedItems.map((item) => {
    const taxRate = item.tax_rate ?? 0
    const unitAmountInclusive = item.rate_inclusive
      ?? roundToTwoDecimals(item.unit_price * (1 + taxRate))
    const lineAmountInclusive = item.line_total
      ?? roundToTwoDecimals(item.quantity * unitAmountInclusive)

    const lineItem: Record<string, unknown> = {
      Description: item.description,
      Quantity: item.quantity,
      UnitAmount: unitAmountInclusive,
      AccountCode: item.gl_code!,
      LineAmount: lineAmountInclusive,
    }
    if (item.xero_tax_type) {
      lineItem.TaxType = item.xero_tax_type
    }
    return lineItem
  }),
})
```

---

## 8. Testing & Verification Plan

### 8.1 Pre-deployment Verification

1. **Lint check:** `npm run lint` must pass with zero errors
2. **Build check:** `npm run build` must succeed
3. **Type check:** TypeScript compilation with no errors

### 8.2 Functional Testing

1. **Create a test invoice** with a taxable chargeable (e.g. VFR Flight Plan, $10 inclusive of GST)
2. **Export to Xero** and verify the export log payload contains:
   - `LineAmountTypes: "Inclusive"`
   - `UnitAmount` = GST-inclusive rate (e.g. 10.00)
   - `LineAmount` = GST-inclusive total (e.g. 10.00)
   - `TaxType` = either omitted (for items without explicit xero_tax_type) or the correct type
3. **Verify in Xero** that the created invoice shows:
   - SubTotal = 8.70 (ex-GST)
   - TotalTax = 1.30
   - Total = 10.00 (GST-inclusive)
   - LineAmountTypes = Inclusive
4. **Test with explicitly configured xero_tax_type:** Set `xero_tax_type = "OUTPUT2"` on a chargeable, create and export an invoice, verify TaxType appears in the payload
5. **Test non-taxable items:** Create an invoice with a non-taxable chargeable, verify TaxType = "NONE" and amounts are correct (should be the same since tax_rate = 0 means inclusive = exclusive)
6. **Test mixed invoice:** Create an invoice with both taxable and non-taxable items, verify correct tax treatment for each line

### 8.3 Regression Testing

1. Verify existing invoices (not yet exported) still export correctly
2. Verify the booking check-in path creates items with correct values
3. Verify the export duplicate-prevention logic still works
4. Verify failed export retry still works

### 8.4 Data Reconciliation

For any invoice exported after the fix, verify:

| Supabase Field | Xero Field | Expected Relationship |
|---|---|---|
| `invoices.total_amount` | `Total` | Equal (GST-inclusive) |
| `invoices.subtotal` | `SubTotal` | Equal (ex-GST) |
| `invoices.tax_total` | `TotalTax` | Equal (GST component) |
| `invoice_items.line_total` | `LineItems[].LineAmount` | Equal (GST-inclusive per line) |
| `invoice_items.rate_inclusive` | `LineItems[].UnitAmount` | Equal (GST-inclusive unit rate) |

---

## 9. Best Practice Notes

### 9.1 Xero API Best Practices

1. **Let Xero calculate tax when possible.** Per Xero's documentation, the recommended approach is to omit `TaxType` and `TaxAmount` and let Xero apply the default tax rate for the AccountCode. Only send `TaxType` when you need to override the account's default.

2. **Never send `TaxAmount`.** Xero explicitly warns against this: *"We don't recommend sending the tax amount to Xero, as this can have implications on reports and data integrity."* The current code correctly does not send TaxAmount. This must be maintained.

3. **Always specify `LineAmountTypes`.** Never rely on Xero's default (Exclusive). Always be explicit about whether amounts are inclusive or exclusive of tax.

4. **Validate totals after export.** Compare the Xero response totals against internal records. Log warnings if they diverge. This would have caught this bug immediately.

### 9.2 NZ GST Accounting Standards

1. All consumer-facing prices in New Zealand are GST-inclusive by convention
2. GST rate is 15% (tax code OUTPUT2 in Xero for revenue, INPUT2 for expenses)
3. GST-exclusive amount = inclusive amount / 1.15
4. GST component = inclusive amount - exclusive amount
5. Invoices should always show the GST-inclusive total as the amount due

### 9.3 Code Quality Recommendations

1. **Add post-export validation:** After receiving Xero's response, compare `response.Total` against `invoices.total_amount`. Log a warning if they differ. This serves as a safety net against future regressions.

2. **Consider adding a `xero_tax_type` column to `chargeable_types`:** Currently, `xero_tax_type` only exists on `chargeables` (per-item). Adding it to `chargeable_types` (per-type) would allow a resolution chain similar to GL codes: `chargeables.xero_tax_type` → `chargeable_types.xero_tax_type` → `default_tax_type` → omit.

3. **Auto-detect Xero tax type from internal tax rate:** For NZ organisations, 15% tax rate maps to OUTPUT2. Consider auto-mapping known tax rates to Xero tax types, reducing the need for manual configuration.

4. **Validate the export log `request_payload` totals match Supabase:** A scheduled check that compares logged request payloads against actual invoice totals would catch mismatches early.

---

*End of Audit*
