# Xero Tax Mapping — UX Design

## Problem

The current implementation requires users to type Xero tax type codes (e.g. `OUTPUT2`) into a free-text field. This is poor UX because:

- Users don't know what `OUTPUT2` means
- Tax type codes are Xero-internal identifiers, not user-facing labels
- Most Xero-linked apps use a **mapping** model: "Your tax rate → Xero tax rate" with human-readable names

## Xero's Guidance

From Xero's Tax documentation:

> **Best practice:** Allow customers to map Xero tax rates to your tax rates; or to give the user the option to create them if necessary.

> Use the **TaxType** element to specify tax rates – you can't use the Name field.

> A **GET of TaxRates** will show what account types the rate can be used with.

The Xero TaxRates API returns objects with:

- **TaxType** – API identifier (e.g. `OUTPUT2`, `NONE`) — required when creating line items
- **Name** – Human-readable label (e.g. "GST 15%", "No GST")
- **CanApplyToRevenue** – Whether the rate can be used on revenue/invoice line items
- **EffectiveRate**, **DisplayTaxRate** – For display and matching

## Recommended Approach: Map App Tax Rates to Xero Tax Rates

### Architecture

```
┌─────────────────────────┐         ┌─────────────────────────┐
│ Your app: tax_rates     │         │ Xero API: GET TaxRates  │
│                         │         │                         │
│ • GST 15% (id: abc)     │  map    │ • OUTPUT2 "GST 15%"     │
│ • Exempt 0% (id: def)   │  ────▶  │ • NONE "No GST"         │
│                         │         │ • ZERORATED "Zero rated"│
└─────────────────────────┘         └─────────────────────────┘
```

**Storage:** Keep existing schema. Store Xero `TaxType` (e.g. `OUTPUT2`). Change only *how* the user selects it — from a dropdown of Xero tax rates instead of free text.

### Option A: Dropdown of Xero Tax Rates (Minimal Change)

Replace the current "Default tax type" free-text input with a **Select** populated from the Xero TaxRates API.

| Current UX | New UX |
|------------|--------|
| Input, placeholder "e.g. OUTPUT2" | Select: "GST 15%", "No GST", "Zero rated", etc. |
| User must know codes | User picks by name |

**Implementation:**

1. **GET /api/xero/tax-rates** – Call `client.getTaxRates()`, filter to `CanApplyToRevenue === true` and `Status === "ACTIVE"`, return `{ taxRates: [{ taxType, name, displayRate }] }`.
2. **Xero settings form** – Replace the default tax type `Input` with a `Select`:
   - Options: `name` (e.g. "GST 15%") for display
   - Value: `taxType` (e.g. "OUTPUT2")
   - Include "No tax" (`NONE`) for non-taxable fallback
3. **Chargeables config** – Same pattern for `xero_tax_type` when Xero is enabled.

**Pros:** Small change, no schema or flow changes, much better UX.  
**Cons:** Still a single "default" mapping; no per–tax-rate mapping.

---

### Option B: Full Tax Rate Mapping (Xero-Certification Friendly)

Map **each** of your tax rates to a Xero tax rate.

**Data model:**

```ts
// tenant_settings.settings.xero
{
  tax_rate_mappings: {
    [tax_rates_id: string]: string  // Xero TaxType
  }
}
```

Example: `{ "abc-123": "OUTPUT2", "def-456": "NONE" }` — your GST 15% → Xero OUTPUT2, your Exempt → None.

**UI:** "Map your tax rates to Xero"

| Your tax rate | Xero tax rate |
|---------------|---------------|
| GST 15% (default) | [Dropdown: GST 15% ▼] |
| Exempt 0% | [Dropdown: No GST ▼] |

**Export logic:** For each line item, resolve:

1. `tax_rate` (e.g. 0.15)
2. Look up tenant default tax rate (or match by rate) → get `tax_rates.id`
3. `tax_rate_mappings[tax_rates.id]` → Xero `TaxType`
4. If no mapping → fall back to `default_tax_type` (from Option A) or fail with a clear message

**Pros:** Aligns with Xero best practice, supports multiple tax rates, suitable for certification.  
**Cons:** More UI and logic than Option A.

---

## Recommendation

**Phase 1 (quick win):** Implement **Option A** — dropdown of Xero tax rates for "Default tax type" and chargeable tax type. No schema changes, uses existing `default_tax_type` and chargeable `xero_tax_type`.

**Phase 2 (optional):** Add **Option B** if you need multi-tax or certification: `tax_rate_mappings` and mapping UI per tax rate.

---

## Implementation Notes

### API: GET /api/xero/tax-rates

- Reuse pattern from `/api/xero/chart-of-accounts` (live fetch, optional cache)
- Use `getXeroClient(tenantId)` and `client.getTaxRates()`
- Filter: `Status === "ACTIVE"`, `CanApplyToRevenue === true`
- Response shape:

```ts
{
  tax_rates: Array<{
    tax_type: string      // "OUTPUT2"
    name: string          // "GST 15%"
    display_rate?: string // "15%"
  }>
}
```

- Always include `NONE` for non-taxable items, even if not returned by Xero

### Component: XeroTaxTypeSelect

Create a reusable component used in:

1. **Xero settings form** – "Default tax type for taxable items"
2. **Chargeables config** – per chargeable Xero tax type (when Xero enabled)

Props: `value`, `onChange`, `placeholder`, `disabled`, `includeNone?: boolean` (default true for settings, configurable for chargeables).

### Backwards Compatibility

- Stored values stay as TaxType strings (`OUTPUT2`, `NONE`, etc.)
- Existing `default_tax_type` and chargeable `xero_tax_type` values remain valid
- The only change is input method (dropdown vs text)

---

## Summary

| What | Change |
|------|--------|
| **Settings → Integrations** | "Default tax type" → dropdown of Xero tax rates (Name) |
| **Settings → Charges (chargeables)** | "Xero tax type" → same dropdown |
| **Stored value** | Unchanged (TaxType string) |
| **Export logic** | Unchanged |
| **Schema** | No change |

Users choose by visible names (e.g. "GST 15%") instead of internal codes like `OUTPUT2`, matching how most Xero-connected apps handle tax mapping.
