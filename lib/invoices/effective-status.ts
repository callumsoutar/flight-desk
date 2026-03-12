import type { Database } from "@/lib/types"

type InvoiceStatus = Database["public"]["Enums"]["invoice_status"]

type InvoiceStatusInput = {
  status: InvoiceStatus
  dueDate: string | null
  balanceDue: number | null
}

/**
 * Derives the effective invoice status without relying on background mutations.
 */
export function getEffectiveInvoiceStatus({
  status,
  dueDate,
  balanceDue,
}: InvoiceStatusInput): InvoiceStatus {
  if (status !== "authorised") return status
  if (typeof balanceDue !== "number" || balanceDue <= 0) return status
  if (!dueDate) return status

  const dueAt = new Date(dueDate).getTime()
  if (!Number.isFinite(dueAt)) return status

  return dueAt < Date.now() ? "overdue" : status
}
