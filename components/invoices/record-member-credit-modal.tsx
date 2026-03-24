"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  CalendarIcon,
  CheckCircle2,
  CreditCard,
  DollarSign,
  Landmark,
  Receipt,
  User,
  Wallet,
} from "lucide-react"

import { recordMemberCreditPaymentAction } from "@/app/invoices/actions"
import MemberSelect, { type UserResult } from "@/components/invoices/member-select"
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

export type RecordMemberCreditModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  members: UserResult[]
}

export default function RecordMemberCreditModal({
  open,
  onOpenChange,
  members,
}: RecordMemberCreditModalProps) {
  const router = useRouter()

  const [selectedMember, setSelectedMember] = React.useState<UserResult | null>(null)
  const [amount, setAmount] = React.useState<number>(0)
  const [method, setMethod] = React.useState<PaymentMethod | "">("")
  const [reference, setReference] = React.useState("")
  const [notes, setNotes] = React.useState("")
  const [paidDate, setPaidDate] = React.useState("")

  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState(false)
  const [receiptId, setReceiptId] = React.useState<string | null>(null)
  const [newBalance, setNewBalance] = React.useState<number | null>(null)

  const reset = React.useCallback(() => {
    setSelectedMember(null)
    setAmount(0)
    setMethod("")
    setReference("")
    setNotes("")
    setPaidDate("")
    setLoading(false)
    setError(null)
    setSuccess(false)
    setReceiptId(null)
    setNewBalance(null)
  }, [])

  React.useEffect(() => {
    if (!open) {
      const timeoutId = setTimeout(() => reset(), 200)
      return () => clearTimeout(timeoutId)
    }
  }, [open, reset])

  function validate(): string | null {
    if (!selectedMember) return "Member is required."
    if (!method) return "Payment method is required."
    if (!amount || amount <= 0) return "Payment amount must be greater than zero."
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

    if (!selectedMember) return

    setLoading(true)
    const result = await recordMemberCreditPaymentAction({
      userId: selectedMember.id,
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

    setReceiptId(result.result.transactionId || null)
    setNewBalance(result.result.newBalance ?? null)
    setSuccess(true)
    setLoading(false)

    setTimeout(() => {
      reset()
      onOpenChange(false)
      router.refresh()
    }, 1600)
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    void submitPayment()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1.5rem)] max-w-[620px] overflow-hidden rounded-2xl border border-border p-0 shadow-xl">
        <div className="flex max-h-[88dvh] flex-col bg-background">
          <DialogHeader className="space-y-1.5 border-b px-5 py-4 text-left">
            <DialogTitle className="text-base font-semibold">Receive Payment</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Record an unapplied payment as member account credit.
            </DialogDescription>
          </DialogHeader>

          {success ? (
            <div className="flex flex-1 flex-col items-center justify-center px-5 py-10 text-center">
              <div className="mb-3 rounded-full bg-green-100 p-2.5 text-green-700">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <h3 className="text-base font-semibold text-foreground">Payment recorded</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Account credit of {formatCurrency(amount)} has been added.
              </p>
              {typeof newBalance === "number" ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  New balance: <span className="font-medium text-foreground">{formatCurrency(newBalance)}</span>
                </p>
              ) : null}
              {receiptId ? (
                <div className="mt-3 rounded-md border bg-muted/40 px-3 py-1.5 font-mono text-xs text-muted-foreground">
                  Receipt {receiptId}
                </div>
              ) : null}
            </div>
          ) : (
            <form onSubmit={onSubmit} className="flex-1 overflow-y-auto">
              <div className="space-y-4 px-5 py-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    Member <span className="text-destructive">*</span>
                  </label>
                  <MemberSelect
                    members={members}
                    value={selectedMember}
                    onSelect={setSelectedMember}
                    disabled={loading}
                    buttonClassName="h-10"
                  />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-[2fr_3fr]">
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
                        className="h-10 pl-8 text-sm"
                        required
                        disabled={loading}
                      />
                    </div>
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
                      <SelectTrigger className="h-10 w-full text-sm">
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

                {selectedMember ? (
                  <div className="rounded-lg border bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <User className="h-4 w-4" />
                      Credit will be applied to{" "}
                      <span className="font-medium text-foreground">
                        {[selectedMember.first_name, selectedMember.last_name].filter(Boolean).join(" ") ||
                          selectedMember.email}
                      </span>
                      .
                    </span>
                  </div>
                ) : null}

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
                  disabled={loading || !method || amount <= 0 || !selectedMember}
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
