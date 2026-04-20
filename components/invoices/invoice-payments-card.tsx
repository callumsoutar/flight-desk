"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { Ban, CheckCircle2, Undo2 } from "lucide-react"
import dynamic from "next/dynamic"

import { useTimezone } from "@/contexts/timezone-context"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { invoiceDetailQueryKey } from "@/hooks/use-invoice-detail-query"
import { invoicesQueryKey } from "@/hooks/use-invoices-query"
import type { InvoicePaymentRow } from "@/lib/invoices/fetch-invoice-payments"
import { formatDate } from "@/lib/utils/date-format"

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
    <Card className="rounded-xl border border-border/50 shadow-md">
      <CardHeader className="border-b border-border/20 px-6 py-4">
        <CardTitle className="text-base sm:text-lg">Payments</CardTitle>
      </CardHeader>
      <CardContent className="px-0 py-0">
        <ul className="divide-y divide-border/40">
          {payments.map((payment) => {
            const isReversed = !!payment.reversed_at
            return (
              <li key={payment.id} className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className={
                      isReversed
                        ? "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600"
                        : "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600"
                    }
                  >
                    {isReversed ? (
                      <Ban className="h-4 w-4" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" />
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="font-semibold tabular-nums text-foreground">
                        {formatMoney(payment.amount)}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {formatMethod(payment.payment_method)}
                      </span>
                      {isReversed ? (
                        <Badge variant="outline" className="border-rose-200 bg-rose-50 text-rose-700">
                          Reversed
                        </Badge>
                      ) : null}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Paid {formatDate(payment.paid_at, timeZone, "long") || payment.paid_at}
                      {payment.created_by_name ? ` - by ${payment.created_by_name}` : null}
                    </div>
                    {payment.payment_reference ? (
                      <div className="text-xs text-muted-foreground">
                        Ref: <span className="font-mono">{payment.payment_reference}</span>
                      </div>
                    ) : null}
                    {isReversed ? (
                      <div className="mt-1 text-xs text-rose-700">
                        Reversed{" "}
                        {payment.reversed_at
                          ? formatDate(payment.reversed_at, timeZone, "long") || payment.reversed_at
                          : ""}
                        {payment.reversal_reason ? ` - ${payment.reversal_reason}` : ""}
                      </div>
                    ) : null}
                  </div>
                </div>

                {canReverse && !isReversed ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="self-start text-rose-700 hover:bg-rose-50 hover:text-rose-800 sm:self-auto"
                    onClick={() => setReverseTarget(payment)}
                  >
                    <Undo2 className="mr-1.5 h-3.5 w-3.5" />
                    Reverse
                  </Button>
                ) : null}
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
