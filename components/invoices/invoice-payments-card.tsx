"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { Ban, CheckCircle2, Undo2 } from "lucide-react"
import dynamic from "next/dynamic"

import { useTimezone } from "@/contexts/timezone-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { invoiceDetailQueryKey } from "@/hooks/use-invoice-detail-query"
import { invoicesQueryKey } from "@/hooks/use-invoices-query"
import type { InvoicePaymentRow } from "@/lib/invoices/fetch-invoice-payments"
import { formatDate } from "@/lib/utils/date-format"
import { cn } from "@/lib/utils"

const ReversePaymentModal = dynamic(
  () =>
    import("@/components/invoices/reverse-payment-modal").then((mod) => mod.ReversePaymentModal),
  { ssr: false },
)

function formatMethod(method: string): string {
  return method.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

function formatMoney(amount: number): string {
  return `$${amount.toFixed(2)}`
}

interface InvoicePaymentsCardProps {
  invoiceId: string
  payments: InvoicePaymentRow[]
  canReverse: boolean
  xeroEnabled?: boolean
}

export function InvoicePaymentsCard({
  invoiceId,
  payments,
  canReverse,
  xeroEnabled = false,
}: InvoicePaymentsCardProps) {
  const queryClient = useQueryClient()
  const router = useRouter()
  const { timeZone } = useTimezone()
  const [reverseTarget, setReverseTarget] = React.useState<InvoicePaymentRow | null>(null)

  if (payments.length === 0) return null

  const handleSuccess = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: invoiceDetailQueryKey(invoiceId) }),
      queryClient.invalidateQueries({ queryKey: invoicesQueryKey(xeroEnabled) }),
    ])
    router.refresh()
  }

  return (
    <Card className="overflow-hidden rounded-xl border border-border/50 shadow-sm gap-0 py-0">
      <CardHeader className="border-b border-border/10 bg-muted/10 px-4 py-3 sm:px-6 !pb-3">
        <CardTitle className="text-base font-semibold sm:text-lg">Payment History</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ul className="divide-y divide-border/40">
          {payments.map((payment) => {
            const isReversed = !!payment.reversed_at
            return (
              <li
                key={payment.id}
                className={cn(
                  "flex gap-3 px-4 py-3 text-sm transition-colors sm:px-6",
                  isReversed ? "bg-muted/5" : "hover:bg-muted/5"
                )}
              >
                <div
                  className={cn(
                    "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center",
                    isReversed ? "text-rose-600" : "text-emerald-600"
                  )}
                >
                  {isReversed ? (
                    <Ban className="h-4 w-4" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                </div>

                <div className="flex flex-1 flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-baseline gap-1.5">
                      <span className="font-medium text-foreground">
                        {formatMoney(payment.amount)}
                      </span>
                      <span className="text-muted-foreground">
                        {formatMethod(payment.payment_method)}
                      </span>
                      {isReversed ? (
                        <span className="rounded-md border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-[10px] font-medium text-rose-700">
                          Reversed
                        </span>
                      ) : null}
                    </div>
                    
                    {payment.payment_reference ? (
                      <div className="text-xs text-muted-foreground">
                        Ref: <span className="font-mono">{payment.payment_reference}</span>
                      </div>
                    ) : null}

                    {isReversed ? (
                      <div className="text-xs text-rose-700">
                        Reversed {payment.reversed_at ? formatDate(payment.reversed_at, timeZone, "long") || payment.reversed_at : ""}
                        {payment.reversal_reason ? ` — ${payment.reversal_reason}` : ""}
                      </div>
                    ) : null}
                  </div>

                  <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end sm:pt-0.5">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <time dateTime={payment.paid_at ?? undefined}>
                        {formatDate(payment.paid_at, timeZone, "long") || payment.paid_at}
                      </time>
                      {payment.created_by_name ? (
                        <>
                          <span className="text-border">•</span>
                          <span>{payment.created_by_name}</span>
                        </>
                      ) : null}
                    </div>
                    
                    {canReverse && !isReversed ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                        onClick={() => setReverseTarget(payment)}
                      >
                        <Undo2 className="mr-1.5 h-3 w-3" />
                        Reverse
                      </Button>
                    ) : null}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      </CardContent>

      {reverseTarget ? (
        <ReversePaymentModal
          open={!!reverseTarget}
          onOpenChange={(next) => {
            if (!next) setReverseTarget(null)
          }}
          paymentId={reverseTarget.id}
          amount={reverseTarget.amount}
          paymentMethod={reverseTarget.payment_method}
          paidAt={reverseTarget.paid_at}
          onSuccess={handleSuccess}
        />
      ) : null}
    </Card>
  )
}
