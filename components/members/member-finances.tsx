"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  ArrowDownCircle,
  ArrowUpCircle,
  DollarSign,
  Loader2,
  Mail,
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
  const { data: statementData, isLoading, error } = useAccountStatementQuery(memberId, startDate, endDate)
  const statement: AccountStatementEntry[] = statementData?.statement ?? EMPTY_STATEMENT
  const closingBalance = statementData?.closing_balance ?? 0

  const outstandingBalance = Math.max(closingBalance, 0)

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

  return (
    <div className="space-y-6">
      <Card className="border border-slate-200 shadow-sm">
        <CardContent className="p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
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
            {canRecordMemberPayment && onReceivePaymentClick ? (
              <Button
                type="button"
                className="h-10 shrink-0 bg-green-600 text-white hover:bg-green-700"
                onClick={onReceivePaymentClick}
              >
                <IconCurrencyDollar className="mr-2 h-4 w-4" />
                Receive payment
              </Button>
            ) : null}
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
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void handleEmailStatement()}
                disabled={!memberId || isLoading || isEmailing}
                className="h-9 gap-1.5"
              >
                {isEmailing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                Email statement
              </Button>
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
              {error instanceof Error ? error.message : "Failed to load account statement"}
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
