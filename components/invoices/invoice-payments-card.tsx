"use client"

import Link from "next/link"
import { Ban, CheckCircle2, ChevronRight } from "lucide-react"

import { useTimezone } from "@/contexts/timezone-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { InvoicePaymentRow } from "@/lib/invoices/fetch-invoice-payments"
import { stableReceiptStyleNumberFromUuid } from "@/lib/payments/stable-receipt-style-number"
import { formatDate } from "@/lib/utils/date-format"
import { cn } from "@/lib/utils"

function formatMethod(method: string): string {
  return method.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

function formatMoney(amount: number): string {
  return `$${amount.toFixed(2)}`
}

interface InvoicePaymentsCardProps {
  payments: InvoicePaymentRow[]
}

export function InvoicePaymentsCard({ payments }: InvoicePaymentsCardProps) {
  const { timeZone } = useTimezone()

  if (payments.length === 0) return null

  return (
    <Card className="gap-0 overflow-hidden rounded-xl border border-border/50 py-0 shadow-sm">
      <CardHeader className="border-b border-border/10 bg-muted/10 px-4 py-3 sm:px-6">
        <CardTitle className="text-base font-semibold sm:text-lg">Payment history</CardTitle>
        <p className="text-xs text-muted-foreground sm:text-sm">
          Select a payment to open the receipt and details.
        </p>
      </CardHeader>
      <CardContent className="p-0">
        <ul className="divide-y divide-border/40">
          {payments.map((payment) => {
            const isReversed = !!payment.reversed_at
            const receiptDisplay =
              payment.receipt_number != null && Number.isFinite(Number(payment.receipt_number))
                ? Number(payment.receipt_number)
                : stableReceiptStyleNumberFromUuid(payment.id)

            return (
              <li key={payment.id} className={cn(isReversed && "bg-muted/5")}>
                <Link
                  href={`/payments/${payment.id}`}
                  className={cn(
                    "group flex gap-3 px-4 py-3.5 text-sm transition-colors sm:px-6",
                    "hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  )}
                >
                  <div
                    className={cn(
                      "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center",
                      isReversed ? "text-rose-600" : "text-emerald-600"
                    )}
                    aria-hidden
                  >
                    {isReversed ? <Ban className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                  </div>

                  <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="font-semibold text-foreground tabular-nums">
                          {formatMoney(payment.amount)}
                        </span>
                        <span className="rounded-md border border-slate-200 bg-slate-50/90 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-slate-700">
                          Receipt #{receiptDisplay}
                        </span>
                        <span className="text-muted-foreground">{formatMethod(payment.payment_method)}</span>
                        {isReversed ? (
                          <span className="rounded-md border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-[10px] font-medium text-rose-700">
                            Reversed
                          </span>
                        ) : null}
                      </div>

                      {payment.payment_reference ? (
                        <p className="truncate text-xs text-muted-foreground">
                          Ref: <span className="font-mono">{payment.payment_reference}</span>
                        </p>
                      ) : null}

                      {isReversed ? (
                        <p className="text-xs text-rose-700">
                          Reversed{" "}
                          {payment.reversed_at
                            ? formatDate(payment.reversed_at, timeZone, "long") || payment.reversed_at
                            : ""}
                          {payment.reversal_reason ? ` — ${payment.reversal_reason}` : ""}
                        </p>
                      ) : null}
                    </div>

                    <div className="flex shrink-0 items-center gap-2 sm:flex-col sm:items-end sm:pt-0.5">
                      <div className="text-xs text-muted-foreground sm:text-right">
                        <time dateTime={payment.paid_at ?? undefined}>
                          {formatDate(payment.paid_at, timeZone, "long") || payment.paid_at}
                        </time>
                        {payment.created_by_name ? (
                          <>
                            <span className="mx-1 text-border sm:hidden">•</span>
                            <span className="block sm:mt-0.5">{payment.created_by_name}</span>
                          </>
                        ) : null}
                      </div>
                      <ChevronRight
                        className="h-4 w-4 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground sm:mt-1"
                        aria-hidden
                      />
                    </div>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}
