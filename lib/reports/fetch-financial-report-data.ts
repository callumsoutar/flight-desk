import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/types"

export type FinancialReportType = "transaction_list" | "daily_summary"

export type FinancialReportFilters = {
  startDateTimeUtc: string
  endDateTimeUtc: string
}

export type FinancialTransactionListRow = {
  transaction_id: string
  transaction_type: "invoice" | "payment"
  transaction_subtype: "invoice_debit" | "invoice_payment" | "member_credit_topup" | "unknown"
  related_invoice_id: string | null
  amount: number
  payment_method: string | null
  created_at: string
  reference: string
  description: string
}

export type PaymentBreakdownItem = {
  payment_method: string
  total_amount: number
  transaction_count: number
}

export type FinancialDailySummaryReport = {
  period_start: string
  period_end: string
  total_sales: number
  total_received: number
  difference: number
  payment_breakdown: PaymentBreakdownItem[]
}

function parseIsoUtc(value: string): Date {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Invalid datetime value")
  }
  return parsed
}

export function getDefaultFinancialReportFilters(): FinancialReportFilters {
  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  return {
    startDateTimeUtc: sevenDaysAgo.toISOString(),
    endDateTimeUtc: now.toISOString(),
  }
}

export function normalizeFinancialReportFilters(
  startDateTimeUtc: string,
  endDateTimeUtc: string
): FinancialReportFilters {
  const start = parseIsoUtc(startDateTimeUtc)
  const end = parseIsoUtc(endDateTimeUtc)

  if (start.getTime() > end.getTime()) {
    throw new Error("Start datetime must be before or equal to end datetime")
  }

  return {
    startDateTimeUtc: start.toISOString(),
    endDateTimeUtc: end.toISOString(),
  }
}

export async function fetchFinancialTransactionListReport(
  supabase: SupabaseClient<Database>,
  filters: FinancialReportFilters
): Promise<FinancialTransactionListRow[]> {
  const { data, error } = await supabase.rpc("get_financial_transaction_list_report", {
    p_start: filters.startDateTimeUtc,
    p_end: filters.endDateTimeUtc,
    p_limit: 500,
    p_offset: 0,
  })

  if (error) {
    throw new Error(error.message)
  }

  return ((data ?? []) as FinancialTransactionListRow[]).map((row) => ({
    ...row,
    amount: Number(row.amount ?? 0),
    transaction_subtype: row.transaction_subtype ?? "unknown",
  }))
}

export async function fetchFinancialDailySummaryReport(
  supabase: SupabaseClient<Database>,
  filters: FinancialReportFilters
): Promise<FinancialDailySummaryReport> {
  const { data, error } = await supabase.rpc("get_financial_daily_summary_report", {
    p_start: filters.startDateTimeUtc,
    p_end: filters.endDateTimeUtc,
  })

  if (error) {
    throw new Error(error.message)
  }

  const firstRow = (data?.[0] ?? null) as
    | (Omit<FinancialDailySummaryReport, "payment_breakdown"> & {
        payment_breakdown: unknown
      })
    | null

  if (!firstRow) {
    return {
      period_start: filters.startDateTimeUtc,
      period_end: filters.endDateTimeUtc,
      total_sales: 0,
      total_received: 0,
      difference: 0,
      payment_breakdown: [],
    }
  }

  const paymentBreakdown = Array.isArray(firstRow.payment_breakdown)
    ? (firstRow.payment_breakdown as PaymentBreakdownItem[])
    : []

  return {
    period_start: firstRow.period_start,
    period_end: firstRow.period_end,
    total_sales: Number(firstRow.total_sales ?? 0),
    total_received: Number(firstRow.total_received ?? 0),
    difference: Number(firstRow.difference ?? 0),
    payment_breakdown: paymentBreakdown.map((item) => ({
      payment_method: item.payment_method,
      total_amount: Number(item.total_amount ?? 0),
      transaction_count: Number(item.transaction_count ?? 0),
    })),
  }
}
