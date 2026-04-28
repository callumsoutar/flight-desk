/** PostgREST / Postgres when `receipt_number` column is missing (migration not applied or stale schema cache). */
export function isReceiptColumnMissingError(error: {
  message?: string
  code?: string
  details?: string
} | null): boolean {
  if (!error?.message && !error?.code && !error?.details) return false
  const msg = `${error.message ?? ""} ${error.details ?? ""}`.toLowerCase()
  const code = error.code ?? ""
  if (code === "PGRST204" && msg.includes("receipt_number")) return true
  if (code === "42703" && msg.includes("receipt_number")) return true
  if (!msg.includes("receipt_number")) return false
  return (
    msg.includes("does not exist") ||
    msg.includes("could not find") ||
    (msg.includes("column") && msg.includes("unknown"))
  )
}

export function parseReceiptNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null
  const n =
    typeof value === "string" && /^\d+$/.test(value.trim())
      ? Number(value.trim())
      : Number(value)
  return Number.isFinite(n) ? n : null
}
