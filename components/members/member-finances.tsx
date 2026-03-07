"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  ArrowDownCircle,
  ArrowUpCircle,
  DollarSign,
  Loader2,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DatePicker } from "@/components/ui/date-picker"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"
import type { AccountStatementEntry, AccountStatementResponse } from "@/lib/types/account-statement"

export type MemberFinancesProps = {
  memberId: string
}
const EMPTY_STATEMENT: AccountStatementEntry[] = []

function formatDate(dateString: string) {
  const date = new Date(dateString)
  return date.toLocaleDateString("en-NZ", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

function formatMoney(amount: number) {
  return `$${Math.abs(amount).toFixed(2)}`
}

function getEntryTypeBadge(type: AccountStatementEntry["entry_type"]) {
  switch (type) {
    case "invoice":
      return <Badge className="border-0 bg-blue-100 text-blue-700">Invoice</Badge>
    case "payment":
      return <Badge className="border-0 bg-green-100 text-green-700">Payment</Badge>
    case "credit_note":
      return <Badge className="border-0 bg-purple-100 text-purple-700">Credit Note</Badge>
    case "opening_balance":
      return <Badge className="border-0 bg-gray-100 text-gray-700">Opening</Badge>
    default:
      return null
  }
}

function getStartOfMonth(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  return `${y}-${m}-01`
}

function getEndOfMonth(date: Date): string {
  const d = new Date(date.getFullYear(), date.getMonth() + 1, 0)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

async function fetchAccountStatement(
  memberId: string,
  startDate: string,
  endDate: string
): Promise<AccountStatementResponse> {
  const params = new URLSearchParams({ user_id: memberId, start_date: startDate, end_date: endDate })
  const response = await fetch(`/api/account-statement?${params.toString()}`, {
    method: "GET",
    cache: "no-store",
  })
  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(payload?.error || "Failed to load account statement")
  }

  return payload as AccountStatementResponse
}

const now = new Date()

export function MemberFinances({ memberId }: MemberFinancesProps) {
  const router = useRouter()
  const [startDate, setStartDate] = React.useState(() => getStartOfMonth(now))
  const [endDate, setEndDate] = React.useState(() => getEndOfMonth(now))
  const [statement, setStatement] = React.useState<AccountStatementEntry[]>(EMPTY_STATEMENT)
  const [closingBalance, setClosingBalance] = React.useState(0)
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false

    async function loadStatement() {
      if (!memberId) {
        setStatement(EMPTY_STATEMENT)
        setClosingBalance(0)
        setError(null)
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      setError(null)
      try {
        const data = await fetchAccountStatement(memberId, startDate, endDate)
        if (cancelled) return
        setStatement(data.statement ?? EMPTY_STATEMENT)
        setClosingBalance(data.closing_balance ?? 0)
      } catch (err) {
        if (cancelled) return
        const message =
          err instanceof Error ? err.message : "Failed to load account statement"
        setError(message)
        setStatement(EMPTY_STATEMENT)
        setClosingBalance(0)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void loadStatement()
    return () => {
      cancelled = true
    }
  }, [memberId, startDate, endDate])

  const outstandingBalance = Math.max(closingBalance, 0)

  return (
    <div className="space-y-6">
      <Card className="border border-slate-200 shadow-sm">
        <CardContent className="p-5 sm:p-6">
          <div className="flex flex-col gap-1">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
              Outstanding Balance
            </p>
            {isLoading ? (
              <div className="mt-1 flex items-center gap-2 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading...
              </div>
            ) : (
              <>
                <p className="text-3xl font-bold text-red-700">${outstandingBalance.toFixed(2)}</p>
                {closingBalance <= 0 ? (
                  <p className="text-sm text-slate-500">No amount currently owing.</p>
                ) : null}
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border border-slate-200 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-900">
              <DollarSign className="h-4 w-4 text-slate-500" />
              Account Statement
            </CardTitle>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-600">From</span>
                <DatePicker
                  date={startDate}
                  onChange={(value) => value && setStartDate(value)}
                  className="w-[140px]"
                  disabled={isLoading}
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-600">To</span>
                <DatePicker
                  date={endDate}
                  onChange={(value) => value && setEndDate(value)}
                  className="w-[140px]"
                  disabled={isLoading}
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Loading transactions...
            </div>
          ) : error ? (
            <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          ) : statement.length === 0 ? (
            <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
              No transactions found for this member.
            </div>
          ) : (
            <>
              <div className="overflow-x-auto rounded-md border">
                <Table className="min-w-full">
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead>Date</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {statement.map((entry, idx) => {
                      const isInvoice = entry.entry_type === "invoice"
                      const isOpening = entry.entry_type === "opening_balance"
                      const isDebit = entry.amount > 0

                      return (
                        <TableRow
                          key={`${entry.entry_id}-${idx}`}
                          className={cn(
                            isOpening ? "bg-blue-50" : "hover:bg-slate-50",
                            isInvoice ? "cursor-pointer" : undefined
                          )}
                          onClick={() => {
                            if (isInvoice) {
                              router.push(`/invoices/${entry.entry_id}`)
                            }
                          }}
                        >
                          <TableCell className="whitespace-nowrap">{formatDate(entry.date)}</TableCell>
                          <TableCell className="whitespace-nowrap font-medium">
                            <div className="flex items-center gap-2">
                              <span>{entry.reference}</span>
                              {getEntryTypeBadge(entry.entry_type)}
                            </div>
                          </TableCell>
                          <TableCell>{entry.description}</TableCell>
                          <TableCell className="text-right">
                            {isOpening ? (
                              <span className="text-slate-400">—</span>
                            ) : isDebit ? (
                              <span className="inline-flex items-center gap-1 font-medium text-red-600">
                                <ArrowUpCircle className="h-4 w-4" />
                                {formatMoney(entry.amount)}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 font-medium text-green-600">
                                <ArrowDownCircle className="h-4 w-4" />
                                {formatMoney(entry.amount)}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {entry.balance < 0 ? (
                              <span className="text-green-700">${Math.abs(entry.balance).toFixed(2)} CR</span>
                            ) : entry.balance > 0 ? (
                              <span className="text-red-700">${entry.balance.toFixed(2)}</span>
                            ) : (
                              <span className="text-slate-700">$0.00</span>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}

                    <TableRow className="border-t bg-blue-50 font-semibold">
                      <TableCell colSpan={3} className="text-right uppercase tracking-wide text-slate-700">
                        Closing Balance
                      </TableCell>
                      <TableCell className="text-right text-slate-500">—</TableCell>
                      <TableCell className="text-right text-base">
                        {closingBalance < 0 ? (
                          <span className="text-green-700">${Math.abs(closingBalance).toFixed(2)} CR</span>
                        ) : closingBalance > 0 ? (
                          <span className="text-red-700">${closingBalance.toFixed(2)}</span>
                        ) : (
                          <span className="text-slate-700">$0.00</span>
                        )}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
