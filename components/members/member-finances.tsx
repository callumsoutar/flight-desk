"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  ArrowDownCircle,
  ArrowUpCircle,
  DollarSign,
  Loader2,
  Mail,
  Printer,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DatePicker } from "@/components/ui/date-picker"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { IconCurrencyDollar } from "@tabler/icons-react"

import { cn } from "@/lib/utils"
import { sendAccountStatementEmail, useAccountStatementQuery } from "@/hooks/use-account-statement-query"
import type { AccountStatementEntry } from "@/lib/types/account-statement"
import { useTimezone } from "@/contexts/timezone-context"
import { formatDate } from "@/lib/utils/date-format"

export type MemberFinancesProps = {
  memberId: string
  canRecordMemberPayment?: boolean
  onReceivePaymentClick?: () => void
}
const EMPTY_STATEMENT: AccountStatementEntry[] = []

function formatMoney(amount: number) {
  return `$${Math.abs(amount).toFixed(2)}`
}

function formatBalance(balance: number) {
  if (balance < 0) return `$${Math.abs(balance).toFixed(2)} CR`
  if (balance > 0) return `$${balance.toFixed(2)}`
  return "$0.00"
}

function getEntryHref(entry: AccountStatementEntry) {
  if (entry.entry_type === "invoice") return `/invoices/${entry.entry_id}`
  if (entry.entry_type === "payment" || entry.entry_type === "credit_note") return `/payments/${entry.entry_id}`
  return null
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

const now = new Date()

export function MemberFinances({
  memberId,
  canRecordMemberPayment = false,
  onReceivePaymentClick,
}: MemberFinancesProps) {
  const { timeZone } = useTimezone()
  const router = useRouter()
  const [startDate, setStartDate] = React.useState(() => getStartOfMonth(now))
  const [endDate, setEndDate] = React.useState(() => getEndOfMonth(now))
  const [isEmailing, setIsEmailing] = React.useState(false)
  const [isOpeningPdf, setIsOpeningPdf] = React.useState(false)
  const { data: statementData, isLoading, error } = useAccountStatementQuery(memberId, startDate, endDate)
  const statement: AccountStatementEntry[] = statementData?.statement ?? EMPTY_STATEMENT
  const closingBalance = statementData?.closing_balance ?? 0

  const balanceHint =
    closingBalance < 0
      ? "Member is in credit for this period."
      : closingBalance > 0
        ? "Debit balance — amount owing for this period."
        : "Settled for this period."

  const handleEmailStatement = async () => {
    if (!memberId || isEmailing) return

    setIsEmailing(true)
    try {
      await sendAccountStatementEmail({
        memberId,
        startDate,
        endDate,
      })
      toast.success("Statement emailed to member")
    } catch (sendError) {
      toast.error(sendError instanceof Error ? sendError.message : "Failed to send statement email")
    } finally {
      setIsEmailing(false)
    }
  }

  const handlePrintPdf = () => {
    if (!memberId || isLoading || isOpeningPdf) return

    setIsOpeningPdf(true)
    try {
      const params = new URLSearchParams({ from_date: startDate, to_date: endDate })
      const nextWindow = window.open(
        `/api/members/${memberId}/account-statement/pdf?${params.toString()}`,
        "_blank",
        "noopener,noreferrer"
      )

      if (!nextWindow) {
        toast.error("The PDF was blocked by your browser. Allow pop-ups and try again.")
      }
    } finally {
      window.setTimeout(() => setIsOpeningPdf(false), 250)
    }
  }

  return (
    <div className="space-y-6">
      <Card className="border border-slate-200 shadow-sm">
        <CardContent className="p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex flex-col gap-1">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                Account balance
              </p>
              {isLoading ? (
                <div className="mt-1 flex items-center gap-2 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading...
                </div>
              ) : (
                <>
                  <p
                    className={cn(
                      "text-3xl font-bold tabular-nums tracking-tight",
                      closingBalance < 0
                        ? "text-green-700"
                        : closingBalance > 0
                          ? "text-red-700"
                          : "text-slate-700"
                    )}
                  >
                    {formatBalance(closingBalance)}
                  </p>
                  <p className="text-sm text-slate-500">{balanceHint}</p>
                </>
              )}
            </div>
            {canRecordMemberPayment && onReceivePaymentClick ? (
              <Button
                type="button"
                className="h-9 shrink-0 gap-1.5 bg-slate-900 px-3 font-semibold text-white shadow-sm hover:bg-slate-800 sm:px-4"
                onClick={onReceivePaymentClick}
              >
                <IconCurrencyDollar className="h-4 w-4" />
                Receive payment
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card className="border border-slate-200 shadow-sm">
        <CardHeader className="min-w-0 space-y-3 pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-900">
            <DollarSign className="h-4 w-4 text-slate-500" />
            Account Statement
          </CardTitle>
          <div className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-50/90 px-3 py-3 shadow-sm sm:px-4">
            <div className="flex min-w-0 w-full flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="grid min-w-0 w-full grid-cols-1 gap-2 sm:w-auto sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:gap-3">
                <DatePicker
                  date={startDate}
                  onChange={(value) => value && setStartDate(value)}
                  className="h-9 w-full min-w-0 border-slate-300 bg-white text-slate-900 shadow-sm sm:w-[10.25rem]"
                  disabled={isLoading}
                />
                <span className="text-center text-sm font-medium text-slate-600 sm:self-center">
                  to
                </span>
                <DatePicker
                  date={endDate}
                  onChange={(value) => value && setEndDate(value)}
                  className="h-9 w-full min-w-0 border-slate-300 bg-white text-slate-900 shadow-sm sm:w-[10.25rem]"
                  disabled={isLoading}
                />
              </div>
              <div className="flex min-w-0 w-full flex-col gap-2 sm:w-auto sm:flex-row lg:justify-end">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void handleEmailStatement()}
                  disabled={!memberId || isLoading || isEmailing}
                  className="h-9 w-full gap-1.5 bg-slate-900 px-3 font-semibold text-white shadow-sm hover:bg-slate-800 sm:w-auto sm:px-4"
                >
                  {isEmailing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                  Email statement
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handlePrintPdf}
                  disabled={!memberId || isLoading || isOpeningPdf}
                  className="h-9 w-full gap-1.5 border-slate-300 bg-white px-3 font-semibold text-slate-900 shadow-sm hover:bg-slate-100 hover:text-slate-900 sm:w-auto sm:px-4"
                >
                  {isOpeningPdf ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Printer className="h-4 w-4" />
                  )}
                  Print PDF
                </Button>
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
              {error instanceof Error ? error.message : "Failed to load account statement"}
            </div>
          ) : statement.length === 0 ? (
            <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
              No transactions found for this member.
            </div>
          ) : (
            <>
              <div className="space-y-3 md:hidden">
                {statement.map((entry, idx) => {
                  const isOpening = entry.entry_type === "opening_balance"
                  const isDebit = entry.amount > 0
                  const href = getEntryHref(entry)
                  const clickable = Boolean(href)

                  return (
                    <div
                      key={`${entry.entry_id}-${idx}`}
                      className={cn(
                        "rounded-xl border bg-white p-4 shadow-sm",
                        isOpening ? "border-blue-200 bg-blue-50/70" : "border-slate-200",
                        clickable ? "cursor-pointer active:bg-slate-50" : undefined
                      )}
                      onClick={() => {
                        if (href) {
                          router.push(href)
                        }
                      }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 space-y-1">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            {formatDate(entry.date, timeZone)}
                          </p>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-slate-900">{entry.reference}</p>
                            {getEntryTypeBadge(entry.entry_type)}
                          </div>
                        </div>
                        <div className="text-right">
                          {isOpening ? (
                            <span className="text-sm text-slate-400">—</span>
                          ) : isDebit ? (
                            <span className="inline-flex items-center gap-1 text-sm font-medium text-red-600">
                              <ArrowUpCircle className="h-4 w-4" />
                              {formatMoney(entry.amount)}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-sm font-medium text-green-600">
                              <ArrowDownCircle className="h-4 w-4" />
                              {formatMoney(entry.amount)}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="space-y-1">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Description
                          </p>
                          <p className="text-sm text-slate-700">{entry.description}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Balance
                          </p>
                          <p
                            className={cn(
                              "text-sm font-semibold",
                              entry.balance < 0
                                ? "text-green-700"
                                : entry.balance > 0
                                  ? "text-red-700"
                                  : "text-slate-700"
                            )}
                          >
                            {formatBalance(entry.balance)}
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                })}

                <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-4 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Closing Balance
                  </p>
                  <p
                    className={cn(
                      "mt-1 text-lg font-semibold",
                      closingBalance < 0
                        ? "text-green-700"
                        : closingBalance > 0
                          ? "text-red-700"
                          : "text-slate-700"
                    )}
                  >
                    {formatBalance(closingBalance)}
                  </p>
                </div>
              </div>

              <div className="hidden overflow-x-auto rounded-md border md:block">
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
                      const href = getEntryHref(entry)
                      const isOpening = entry.entry_type === "opening_balance"
                      const isDebit = entry.amount > 0

                      return (
                        <TableRow
                          key={`${entry.entry_id}-${idx}`}
                          className={cn(
                            isOpening ? "bg-blue-50" : "hover:bg-slate-50",
                            href ? "cursor-pointer" : undefined
                          )}
                          onClick={() => {
                            if (href) {
                              router.push(href)
                            }
                          }}
                        >
                          <TableCell className="whitespace-nowrap">{formatDate(entry.date, timeZone)}</TableCell>
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
                            <span
                              className={cn(
                                entry.balance < 0
                                  ? "text-green-700"
                                  : entry.balance > 0
                                    ? "text-red-700"
                                    : "text-slate-700"
                              )}
                            >
                              {formatBalance(entry.balance)}
                            </span>
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
                        <span
                          className={cn(
                            closingBalance < 0
                              ? "text-green-700"
                              : closingBalance > 0
                                ? "text-red-700"
                                : "text-slate-700"
                          )}
                        >
                          {formatBalance(closingBalance)}
                        </span>
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
