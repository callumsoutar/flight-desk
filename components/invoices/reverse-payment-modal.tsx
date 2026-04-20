"use client"

import * as React from "react"
import { AlertTriangle, Loader2, X } from "lucide-react"
import { toast } from "sonner"

import { reverseInvoicePaymentAction } from "@/app/invoices/[id]/actions"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"

interface ReversePaymentModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  paymentId: string
  amount: number
  paymentMethod: string
  paidAt: string
  onSuccess?: () => void | Promise<void>
}

export function ReversePaymentModal({
  open,
  onOpenChange,
  paymentId,
  amount,
  paymentMethod,
  paidAt,
  onSuccess,
}: ReversePaymentModalProps) {
  const [reason, setReason] = React.useState("")
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    if (!open) setReason("")
  }, [open])

  const trimmed = reason.trim()
  const reasonValid = trimmed.length >= 3 && trimmed.length <= 500

  const handleReverse = async () => {
    if (!reasonValid) {
      toast.error("Please provide a reason (3-500 characters)")
      return
    }

    setLoading(true)
    try {
      const result = await reverseInvoicePaymentAction({ paymentId, reason: trimmed })
      if (!result.ok) {
        toast.error(result.error)
        return
      }

      toast.success("Payment reversed")
      onOpenChange(false)
      await onSuccess?.()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Network error - please try again")
    } finally {
      setLoading(false)
    }
  }

  const formattedDate = (() => {
    const d = new Date(paidAt)
    return Number.isNaN(d.getTime())
      ? paidAt
      : d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
  })()

  return (
    <Dialog open={open} onOpenChange={(next) => !loading && onOpenChange(next)}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          "p-0 border-none shadow-2xl rounded-[24px] overflow-hidden",
          "w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] sm:w-full sm:max-w-[560px]",
          "top-[calc(env(safe-area-inset-top)+1rem)] sm:top-[50%] translate-y-0 sm:translate-y-[-50%]",
          "h-auto sm:max-h-[calc(100dvh-4rem)]"
        )}
      >
        <div className="flex h-full min-h-0 flex-col bg-white">
          <DialogHeader className="px-6 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-4 text-left sm:pt-6">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-50 text-amber-600">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-bold tracking-tight text-slate-900">
                    Reverse Payment
                  </DialogTitle>
                  <DialogDescription className="mt-0.5 text-sm text-slate-500">
                    This will reverse the payment and add the amount back to the invoice balance. 
                    The original payment record will be kept for audit purposes.
                  </DialogDescription>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                disabled={loading}
                className="-mr-1 -mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-6 pb-6">
            <div className="space-y-6">
              <section>
                <div className="mb-3 flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                  <span className="text-xs font-semibold tracking-tight text-slate-900">
                    Payment Details
                  </span>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                  <div className="flex items-center justify-between gap-4 py-2.5 border-b border-slate-200/70">
                    <span className="text-sm text-slate-500">Amount</span>
                    <span className="text-sm font-semibold tabular-nums text-slate-900">${amount.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4 py-2.5 border-b border-slate-200/70">
                    <span className="text-sm text-slate-500">Method</span>
                    <span className="text-sm font-semibold capitalize text-slate-900">{paymentMethod.replace(/_/g, " ")}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4 py-2.5">
                    <span className="text-sm text-slate-500">Paid</span>
                    <span className="text-sm font-semibold text-slate-900">{formattedDate}</span>
                  </div>
                </div>
              </section>

              <section>
                <div className="mb-3 flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                  <span className="text-xs font-semibold tracking-tight text-slate-900">
                    Reversal Details
                  </span>
                </div>
                <div className="space-y-5">
                  <div>
                    <label
                      htmlFor="reverse-payment-reason"
                      className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-500"
                    >
                      Reason for reversal <span className="text-destructive">*</span>
                    </label>
                    <Textarea
                      id="reverse-payment-reason"
                      placeholder="e.g. Wrong amount entered, duplicate payment, refund issued..."
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                      disabled={loading}
                      className="min-h-[88px] w-full rounded-xl border-slate-200 bg-white text-sm placeholder:text-slate-400 focus:ring-slate-900"
                      maxLength={500}
                    />
                    <div className="mt-1.5 flex items-center justify-between">
                      <span />
                      <p className="text-[11px] text-slate-400">
                        Recorded in the audit log. {trimmed.length}/500
                      </p>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </div>

          <div className="border-t border-slate-100 bg-white px-6 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-[0_-4px_12px_rgba(0,0,0,0.05)] sm:pb-4 shrink-0">
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                disabled={loading}
                className="h-11 rounded-xl px-5 text-sm font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              >
                Cancel
              </Button>
              <div className="flex flex-1 items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleReverse}
                  disabled={loading || !reasonValid}
                  className="h-11 rounded-xl px-6 text-sm font-semibold shadow-lg shadow-amber-900/10 bg-amber-600 hover:bg-amber-700 text-white"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Reversing...
                    </>
                  ) : (
                    "Reverse Payment"
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
