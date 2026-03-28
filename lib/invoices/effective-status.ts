import type { Database } from "@/lib/types"
import { getZonedYyyyMmDdAndHHmm, zonedTodayYyyyMmDd } from "@/lib/utils/timezone"

type InvoiceStatus = Database["public"]["Enums"]["invoice_status"]

type InvoiceStatusInput = {
  status: InvoiceStatus
  dueDate: string | null
  balanceDue: number | null
  timeZone: string
}

/**
 * Derives the effective invoice status without relying on background mutations.
 */
export function getEffectiveInvoiceStatus({
  status,
  dueDate,
  balanceDue,
  timeZone,
}: InvoiceStatusInput): InvoiceStatus {
  if (status !== "authorised") return status
  if (typeof balanceDue !== "number" || balanceDue <= 0) return status
  if (!dueDate) return status

  const dueAt = new Date(dueDate)
  if (Number.isNaN(dueAt.getTime())) return status

  const dueDateKey = getZonedYyyyMmDdAndHHmm(dueAt, timeZone).yyyyMmDd
  const todayDateKey = zonedTodayYyyyMmDd(timeZone)

  return dueDateKey < todayDateKey ? "overdue" : status
}
