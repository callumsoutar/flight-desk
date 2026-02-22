"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  CalendarIcon,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CreditCard,
  DollarSign,
  Landmark,
  Receipt,
  Wallet,
} from "lucide-react"

import { recordInvoicePaymentAction } from "@/app/invoices/[id]/actions"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { roundToTwoDecimals } from "@/lib/invoices/invoice-calculations"

type PaymentMethod =
  | "cash"
  | "credit_card"
  | "debit_card"
  | "bank_transfer"
  | "check"
  | "online_payment"
  | "other"

const paymentMethods: Array<{ value: PaymentMethod; label: string; icon: React.ElementType }> = [
  { value: "cash", label: "Cash", icon: DollarSign },
  { value: "credit_card", label: "Credit Card", icon: CreditCard },
  { value: "debit_card", label: "Debit Card", icon: CreditCard },
  { value: "bank_transfer", label: "Bank Transfer", icon: Landmark },
  { value: "check", label: "Check", icon: Receipt },
  { value: "online_payment", label: "Online Payment", icon: Wallet },
  { value: "other", label: "Other", icon: Wallet },
]

function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return "—"
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount)
}

function normalizePaidAt(dateOnly: string): string | null {
  if (!dateOnly) return null
  const asDate = new Date(`${dateOnly}T00:00:00.000Z`)
  if (Number.isNaN(asDate.getTime())) return null
  return asDate.toISOString()
}

export type RecordPaymentModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  invoiceId: string
  invoiceNumber?: string | null
  totalAmount?: number | null
  totalPaid?: number | null
  balanceDue?: number | null
  onSuccess?: () => void
}

export default function RecordPaymentModal({
  open,
  onOpenChange,
  invoiceId,
  invoiceNumber,
  totalAmount,
  totalPaid,
  balanceDue,
  onSuccess,
}: RecordPaymentModalProps) {
  const router = useRouter()

  const computedRemaining = React.useMemo(() => {
    const ta = typeof totalAmount === "number" ? totalAmount : 0
    const tp = typeof totalPaid === "number" ? totalPaid : 0
    const byCalc = Math.max(0, roundToTwoDecimals(ta - tp))
    const byField =
      typeof balanceDue === "number" ? Math.max(0, roundToTwoDecimals(balanceDue)) : null
    return byField ?? byCalc
  }, [totalAmount, totalPaid, balanceDue])

  const [amount, setAmount] = React.useState<number>(roundToTwoDecimals(computedRemaining || 0))
  const [method, setMethod] = React.useState<PaymentMethod | "">("")
  const [reference, setReference] = React.useState("")
  const [notes, setNotes] = React.useState("")
  const [paidDate, setPaidDate] = React.useState("")

  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState(false)
  const [receiptId, setReceiptId] = React.useState<string | null>(null)
  const [showAdditionalInfo, setShowAdditionalInfo] = React.useState(false)

  const willFullyPay =
    amount > 0 &&
    computedRemaining > 0 &&
    roundToTwoDecimals(amount) === roundToTwoDecimals(computedRemaining)

  const reset = React.useCallback(() => {
    setAmount(roundToTwoDecimals(computedRemaining || 0))
    setMethod("")
    setReference("")
    setNotes("")
    setPaidDate("")
    setLoading(false)
    setError(null)
    setSuccess(false)
    setReceiptId(null)
    setShowAdditionalInfo(false)
  }, [computedRemaining])

  React.useEffect(() => {
    if (!open) {
      const timeoutId = setTimeout(() => reset(), 200)
      return () => clearTimeout(timeoutId)
    }

    setAmount(roundToTwoDecimals(computedRemaining || 0))
  }, [open, reset, computedRemaining])

  function validate(): string | null {
    if (!invoiceId) return "Missing invoice ID."
    if (!method) return "Payment method is required."
    if (!amount || amount <= 0) return "Payment amount must be greater than zero."
    if (computedRemaining >= 0 && amount > computedRemaining) {
      return `Payment amount cannot exceed remaining balance (${formatCurrency(computedRemaining)}).`
    }
    if (paidDate && !normalizePaidAt(paidDate)) {
      return "Payment date is invalid."
    }
    return null
  }

  async function submitPayment() {
    setError(null)

    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }

    setLoading(true)
    const result = await recordInvoicePaymentAction({
      invoiceId,
      amount: roundToTwoDecimals(amount),
      paymentMethod: method,
      paymentReference: reference.trim() ? reference.trim() : null,
      notes: notes.trim() ? notes.trim() : null,
      paidAt: paidDate ? normalizePaidAt(paidDate) : null,
    })

    if (!result.ok) {
      setError(result.error || "Failed to record payment.")
      setLoading(false)
      return
    }

    setReceiptId(result.result.transactionId || result.result.paymentId || null)
    setSuccess(true)
    setLoading(false)

    setTimeout(() => {
      reset()
      onOpenChange(false)
      router.refresh()
      onSuccess?.()
    }, 1600)
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    void submitPayment()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1.5rem)] max-w-[560px] overflow-hidden rounded-2xl border border-border p-0 shadow-xl">
        <div className="flex max-h-[88dvh] flex-col bg-background">
          <DialogHeader className="space-y-2 border-b px-5 py-4 text-left">
            <DialogTitle className="text-base font-semibold">Record Payment</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Invoice {invoiceNumber || `#${invoiceId.slice(0, 8)}`}
            </DialogDescription>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="inline-flex items-center rounded-md bg-muted px-2.5 py-1 text-xs font-medium">
                Remaining {formatCurrency(computedRemaining)}
              </span>
              <span className="inline-flex items-center rounded-md border px-2.5 py-1 text-xs text-muted-foreground">
                Paid {formatCurrency(totalPaid ?? 0)}
              </span>
              <span className="inline-flex items-center rounded-md border px-2.5 py-1 text-xs text-muted-foreground">
                Total {formatCurrency(totalAmount ?? null)}
              </span>
            </div>
          </DialogHeader>

          {success ? (
            <div className="flex flex-1 flex-col items-center justify-center px-5 py-10 text-center">
              <div className="mb-3 rounded-full bg-green-100 p-2.5 text-green-700">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <h3 className="text-base font-semibold text-foreground">Payment recorded</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Applied {formatCurrency(amount)} to this invoice.
              </p>
              {receiptId ? (
                <div className="mt-3 rounded-md border bg-muted/40 px-3 py-1.5 font-mono text-xs text-muted-foreground">
                  Receipt {receiptId}
                </div>
              ) : null}
            </div>
          ) : (
            <form onSubmit={onSubmit} className="flex-1 overflow-y-auto">
              <div className="space-y-4 px-5 py-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">
                      Amount <span className="text-destructive">*</span>
                    </label>
                    <div className="relative">
                      <DollarSign className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        value={amount === 0 ? "" : String(amount)}
                        onChange={(event) => {
                          const value = event.target.value
                          if (value === "" || value === ".") {
                            setAmount(0)
                            return
                          }
                          const numeric = Number.parseFloat(value)
                          setAmount(Number.isFinite(numeric) ? numeric : 0)
                        }}
                        className="h-9 pl-8 text-sm"
                        required
                        disabled={loading}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setAmount(roundToTwoDecimals(computedRemaining))}
                      disabled={loading}
                      className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                    >
                      Use full balance
                    </button>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">
                      Method <span className="text-destructive">*</span>
                    </label>
                    <Select
                      value={method}
                      onValueChange={(value) => setMethod(value as PaymentMethod)}
                      disabled={loading}
                    >
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue placeholder="Select method" />
                      </SelectTrigger>
                      <SelectContent>
                        {paymentMethods.map((paymentMethod) => (
                          <SelectItem key={paymentMethod.value} value={paymentMethod.value}>
                            <span className="flex items-center gap-2">
                              <paymentMethod.icon className="h-3.5 w-3.5" />
                              <span>{paymentMethod.label}</span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="rounded-lg border bg-muted/20">
                  <button
                    type="button"
                    onClick={() => setShowAdditionalInfo((state) => !state)}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-medium text-muted-foreground hover:text-foreground"
                  >
                    <span>Additional details</span>
                    {showAdditionalInfo ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </button>

                  {showAdditionalInfo ? (
                    <div className="space-y-3 border-t px-3 py-3">
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-muted-foreground">Reference</label>
                          <div className="relative">
                            <Receipt className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                              placeholder="Transaction ID or check #"
                              value={reference}
                              onChange={(event) => setReference(event.target.value)}
                              disabled={loading}
                              className="h-9 pl-8 text-sm"
                            />
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-muted-foreground">Date</label>
                          <div className="relative">
                            <CalendarIcon className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                              type="date"
                              value={paidDate}
                              onChange={(event) => setPaidDate(event.target.value)}
                              disabled={loading}
                              className="h-9 pl-8 text-sm"
                            />
                          </div>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground">Notes</label>
                        <Textarea
                          placeholder="Optional note"
                          value={notes}
                          onChange={(event) => setNotes(event.target.value)}
                          disabled={loading}
                          className="min-h-[78px] text-sm"
                        />
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="rounded-lg border bg-muted/20 px-3 py-2 text-sm">
                  {willFullyPay ? (
                    <span className="font-medium text-green-700">This will mark the invoice as paid.</span>
                  ) : (
                    <span className="text-muted-foreground">
                      Remaining after payment:{" "}
                      <span className="font-medium text-foreground">
                        {formatCurrency(roundToTwoDecimals(computedRemaining - Math.max(0, amount)))}
                      </span>
                    </span>
                  )}
                </div>

                {error ? (
                  <div className="rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                    {error}
                  </div>
                ) : null}
              </div>

              <div className="flex items-center gap-2 border-t px-5 py-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={loading}
                  className="h-9 flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={loading || !method || amount <= 0}
                  className="h-9 flex-[1.35] bg-green-600 text-white hover:bg-green-700"
                >
                  {loading ? "Recording..." : "Record Payment"}
                </Button>
              </div>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
