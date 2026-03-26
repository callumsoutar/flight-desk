"use client"

import * as React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { IconArrowRight, IconCalendarTime, IconFilter } from "@tabler/icons-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type {
  FinancialDailySummaryReport,
  FinancialReportFilters,
  FinancialReportType,
  FinancialTransactionListRow,
} from "@/lib/reports/fetch-financial-report-data"
import { cn } from "@/lib/utils"

const moneyFormatter = new Intl.NumberFormat("en-NZ", {
  style: "currency",
  currency: "NZD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const utcDateTimeFormatter = new Intl.DateTimeFormat("en-NZ", {
  timeZone: "UTC",
  year: "numeric",
  month: "short",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
})

function formatMoney(value: number): string {
  return moneyFormatter.format(value)
}

function formatUtcDateTime(isoValue: string): string {
  const date = new Date(isoValue)
  return utcDateTimeFormatter.format(date)
}

function toDateOnlyFromIsoUtc(isoValue: string): string {
  const date = new Date(isoValue)
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, "0")
  const day = String(date.getUTCDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function toUtcRangeBoundary(dateOnly: string, kind: "start" | "end"): string | null {
  const [yearRaw, monthRaw, dayRaw] = dateOnly.split("-")
  const year = Number(yearRaw)
  const month = Number(monthRaw)
  const day = Number(dayRaw)

  if ([year, month, day].some((part) => Number.isNaN(part))) {
    return null
  }

  if (kind === "start") {
    return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0)).toISOString()
  }

  return new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999)).toISOString()
}

function toPaymentMethodLabel(value: string): string {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

export function FinancialReportBuilder({
  filters,
  reportType,
  transactionListRows,
  dailySummary,
}: {
  filters: FinancialReportFilters
  reportType: FinancialReportType
  transactionListRows: FinancialTransactionListRow[]
  dailySummary: FinancialDailySummaryReport | null
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [startInput, setStartInput] = React.useState(() => toDateOnlyFromIsoUtc(filters.startDateTimeUtc))
  const [endInput, setEndInput] = React.useState(() => toDateOnlyFromIsoUtc(filters.endDateTimeUtc))
  const [inputError, setInputError] = React.useState<string | null>(null)

  React.useEffect(() => {
    setStartInput(toDateOnlyFromIsoUtc(filters.startDateTimeUtc))
    setEndInput(toDateOnlyFromIsoUtc(filters.endDateTimeUtc))
    setInputError(null)
  }, [filters.endDateTimeUtc, filters.startDateTimeUtc])

  function pushQuery(nextType: FinancialReportType, startIso: string, endIso: string) {
    const nextParams = new URLSearchParams(searchParams.toString())
    nextParams.set("type", nextType)
    nextParams.set("start", startIso)
    nextParams.set("end", endIso)
    router.push(`${pathname}?${nextParams.toString()}`)
  }

  function handleApplyRange() {
    const startIso = toUtcRangeBoundary(startInput, "start")
    const endIso = toUtcRangeBoundary(endInput, "end")

    if (!startIso || !endIso) {
      setInputError("Please enter valid dates.")
      return
    }

    if (new Date(startIso).getTime() > new Date(endIso).getTime()) {
      setInputError("Start date must be before end date.")
      return
    }

    setInputError(null)
    pushQuery(reportType, startIso, endIso)
  }

  function handleReportTypeChange(nextType: string) {
    const typed = nextType as FinancialReportType
    pushQuery(typed, filters.startDateTimeUtc, filters.endDateTimeUtc)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Financial Reports</h1>
          <p className="mt-1 text-slate-600">
            Generate invoice and receipt reports for a selected date range.
          </p>
        </div>
      </div>

      <Card className="border border-slate-200 bg-slate-50/30 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <IconFilter className="h-4 w-4 text-slate-500" />
            Report Builder
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 lg:grid-cols-[1fr_1fr_260px_auto] lg:items-end">
            <div className="space-y-1.5">
              <label htmlFor="financial-report-start" className="text-sm font-medium text-slate-700">
                Start Date
              </label>
              <Input
                id="financial-report-start"
                type="date"
                value={startInput}
                onChange={(event) => setStartInput(event.target.value)}
                className="bg-white"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="financial-report-end" className="text-sm font-medium text-slate-700">
                End Date
              </label>
              <Input
                id="financial-report-end"
                type="date"
                value={endInput}
                onChange={(event) => setEndInput(event.target.value)}
                className="bg-white"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="financial-report-type" className="text-sm font-medium text-slate-700">
                Report Type
              </label>
              <Select value={reportType} onValueChange={handleReportTypeChange}>
                <SelectTrigger id="financial-report-type" className="bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="transaction_list">Transaction List</SelectItem>
                  <SelectItem value="daily_summary">Daily Summary</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button className="lg:self-end" onClick={handleApplyRange}>
              <IconCalendarTime className="h-4 w-4" />
              Run Report
            </Button>
          </div>
          {inputError ? (
            <p className="text-sm font-medium text-red-600">{inputError}</p>
          ) : null}
        </CardContent>
      </Card>

      {reportType === "transaction_list" ? (
        <TransactionListReport rows={transactionListRows} />
      ) : (
        <DailySummaryReport summary={dailySummary} />
      )}
    </div>
  )
}

function TransactionListReport({ rows }: { rows: FinancialTransactionListRow[] }) {
  const router = useRouter()

  return (
    <Card className="border border-slate-200 shadow-sm">
      <CardHeader>
        <CardTitle>Transaction List</CardTitle>
        <CardDescription>
          Row-level financial events sorted by newest first. Click invoice-linked rows to open details.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <div className="flex h-36 items-center justify-center text-sm text-muted-foreground">
            No transactions found for this date-time range.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Created (UTC)</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Payment Method</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const canOpenInvoice = Boolean(row.related_invoice_id)
                return (
                  <TableRow
                    key={row.transaction_id}
                    className={cn(canOpenInvoice ? "cursor-pointer" : undefined)}
                    onClick={() => {
                      if (canOpenInvoice) {
                        router.push(`/invoices/${row.related_invoice_id}`)
                      }
                    }}
                  >
                    <TableCell>
                      <Badge
                        className={cn(
                          "border-0",
                          row.transaction_type === "invoice"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-green-100 text-green-700"
                        )}
                      >
                        {row.transaction_type === "invoice" ? "Invoice" : "Receipt"}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatUtcDateTime(row.created_at)}</TableCell>
                    <TableCell className="font-medium">{row.reference}</TableCell>
                    <TableCell className="max-w-[360px] truncate">{row.description}</TableCell>
                    <TableCell>
                      {row.payment_method ? toPaymentMethodLabel(row.payment_method) : "—"}
                    </TableCell>
                    <TableCell className="text-right font-medium">{formatMoney(row.amount)}</TableCell>
                    <TableCell className="text-right">
                      {canOpenInvoice ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-600">
                          Invoice
                          <IconArrowRight className="h-3.5 w-3.5" />
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}

function DailySummaryReport({ summary }: { summary: FinancialDailySummaryReport | null }) {
  if (!summary) {
    return (
      <Card className="border border-slate-200 shadow-sm">
        <CardContent className="flex h-36 items-center justify-center text-sm text-muted-foreground">
          No summary available for this date-time range.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="border border-slate-200 shadow-sm">
        <CardHeader className="pb-2">
          <CardDescription>Total Sales (Invoices Created)</CardDescription>
          <CardTitle className="text-2xl">{formatMoney(summary.total_sales)}</CardTitle>
        </CardHeader>
      </Card>
      <Card className="border border-slate-200 shadow-sm">
        <CardHeader className="pb-2">
          <CardDescription>Total Received (Receipts)</CardDescription>
          <CardTitle className="text-2xl">{formatMoney(summary.total_received)}</CardTitle>
        </CardHeader>
      </Card>
      <Card className="border border-slate-200 shadow-sm">
        <CardHeader className="pb-2">
          <CardDescription>Variance (Sales - Received)</CardDescription>
          <CardTitle className="text-2xl">{formatMoney(summary.difference)}</CardTitle>
        </CardHeader>
      </Card>

      <Card className="border border-slate-200 shadow-sm lg:col-span-3">
        <CardHeader>
          <CardTitle>Payment Method Breakdown</CardTitle>
          <CardDescription>Expected bank reconciliation by method for selected UTC period.</CardDescription>
        </CardHeader>
        <CardContent>
          {summary.payment_breakdown.length === 0 ? (
            <div className="text-sm text-muted-foreground">No payment transactions in this range.</div>
          ) : (
            <div className="space-y-2">
              {summary.payment_breakdown.map((item) => (
                <div
                  key={item.payment_method}
                  className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2"
                >
                  <div className="text-sm font-medium">{toPaymentMethodLabel(item.payment_method)}</div>
                  <div className="text-sm text-slate-600">
                    {item.transaction_count} txns ·{" "}
                    <span className="font-semibold text-slate-900">{formatMoney(item.total_amount)}</span>
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between rounded-md border border-slate-300 bg-slate-50 px-3 py-2">
                <div className="text-sm font-semibold text-slate-800">Final Total Received</div>
                <div className="text-sm font-bold text-slate-900">{formatMoney(summary.total_received)}</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
