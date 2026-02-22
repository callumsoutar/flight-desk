import type { InvoiceItemsRow } from "@/lib/types"

/**
 * Round to 2 decimal places for currency-safe display/storage.
 */
export function roundToTwoDecimals(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export interface CalculateItemAmountsParams {
  quantity: number
  unitPrice: number
  taxRate: number
}

export interface CalculateItemAmountsResult {
  amount: number
  taxAmount: number
  rateInclusive: number
  lineTotal: number
}

/**
 * Item math follows invoice UX expectations:
 * 1) derive tax-inclusive rate (2dp),
 * 2) multiply by qty for line total (2dp),
 * 3) back-calculate tax-exclusive amount (2dp),
 * 4) tax is line - amount (2dp).
 */
export function calculateItemAmounts({
  quantity,
  unitPrice,
  taxRate,
}: CalculateItemAmountsParams): CalculateItemAmountsResult {
  if (quantity <= 0) {
    throw new Error("Quantity must be positive")
  }
  if (unitPrice < 0) {
    throw new Error("Unit price cannot be negative")
  }
  if (taxRate < 0 || taxRate > 1) {
    throw new Error("Tax rate must be between 0 and 1")
  }

  const rateInclusive = roundToTwoDecimals(unitPrice * (1 + taxRate))
  const lineTotal = roundToTwoDecimals(quantity * rateInclusive)
  const amount = roundToTwoDecimals(lineTotal / (1 + taxRate))
  const taxAmount = roundToTwoDecimals(lineTotal - amount)

  return {
    amount,
    taxAmount,
    rateInclusive,
    lineTotal,
  }
}

type InvoiceItemLike = Pick<
  InvoiceItemsRow,
  "quantity" | "unit_price" | "tax_rate" | "amount" | "tax_amount" | "deleted_at"
>

export interface CalculateInvoiceTotalsResult {
  subtotal: number
  taxTotal: number
  totalAmount: number
}

export function calculateInvoiceTotals(items: InvoiceItemLike[]): CalculateInvoiceTotalsResult {
  const activeItems = items.filter((item) => !item.deleted_at)

  let subtotal = 0
  let taxTotal = 0

  for (const item of activeItems) {
    const amount = item.amount ?? roundToTwoDecimals(item.quantity * item.unit_price)
    const taxAmount = item.tax_amount ?? roundToTwoDecimals(amount * (item.tax_rate ?? 0))
    subtotal = roundToTwoDecimals(subtotal + amount)
    taxTotal = roundToTwoDecimals(taxTotal + taxAmount)
  }

  return {
    subtotal,
    taxTotal,
    totalAmount: roundToTwoDecimals(subtotal + taxTotal),
  }
}

export const InvoiceCalculations = {
  roundToTwoDecimals,
  calculateItemAmounts,
  calculateInvoiceTotals,
}

