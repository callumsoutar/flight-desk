import type { HoursByFlightTypeRow } from "@/lib/types/reports"

export function getRevenueNonRevenueHoursFromRows(rows: HoursByFlightTypeRow[]): {
  revenueHours: number
  nonRevenueHours: number
  total: number
} {
  let revenue = 0
  let nonRevenue = 0
  for (const r of rows) {
    const h = r.total_hours
    if (!Number.isFinite(h)) continue
    if (r.is_revenue) revenue += h
    else nonRevenue += h
  }
  return { revenueHours: revenue, nonRevenueHours: nonRevenue, total: revenue + nonRevenue }
}
