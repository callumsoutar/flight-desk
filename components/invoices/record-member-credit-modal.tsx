"use client"

import * as React from "react"
import {
  CalendarIcon,
  CheckCircle2,
  CreditCard,
  DollarSign,
  Landmark,
  Loader2,
  Receipt,
  User,
  Wallet,
} from "lucide-react"

import { IconPlus } from "@tabler/icons-react"

import { recordMemberCreditPaymentAction } from "@/app/invoices/actions"
import MemberSelect, { type UserResult } from "@/components/invoices/member-select"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
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
import { cn } from "@/lib/utils"

type PaymentMethod =
  | "cash"
  | "credit_card"
  | "debit_card"
  | "bank_transfer"
  | "other"

const paymentMethods: Array<{ value: PaymentMethod; label: string; icon: React.ElementType }> = [
  { value: "cash", label: "Cash", icon: DollarSign },
  { value: "credit_card", label: "Credit Card", icon: CreditCard },
  { value: "debit_card", label: "Debit Card", icon: CreditCard },
  { value: "bank_transfer", label: "Bank Transfer", icon: Landmark },
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
  /** When set (e.g. from a member profile), this member is selected and the picker is locked. */
  initialMember?: UserResult | null
  onSuccess?: () => void | Promise<void>
}

export default function RecordMemberCreditModal({
  open,
  onOpenChange,
  members,
  initialMember = null,
  onSuccess,
}: RecordMemberCreditModalProps) {
  const [selectedMember, setSelectedMember] = React.useState<UserResult | null>(null)
  const [amount, setAmount] = React.useState<number>(0)
  const [method, setMethod] = React.useState<PaymentMethod | "">("")
  const [reference, setReference] = React.useState("")
  const [notes, setNotes] = React.useState("")
  const [notesOpen, setNotesOpen] = React.useState(false)
  const [paidDate, setPaidDate] = React.useState("")

  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState(false)
  const [receiptNumber, setReceiptNumber] = React.useState<number | null>(null)
  const [newBalance, setNewBalance] = React.useState<number | null>(null)

  const lockMemberSelection = Boolean(initialMember)

  const reset = React.useCallback(() => {
    setSelectedMember(null)
    setAmount(0)
    setMethod("")
    setReference("")
    setNotes("")
    setNotesOpen(false)
    setPaidDate("")
    setLoading(false)
    setError(null)
    setSuccess(false)
    setReceiptNumber(null)
    setNewBalance(null)
  }, [])

  React.useEffect(() => {
    if (!open) {
      const timeoutId = setTimeout(() => reset(), 200)
      return () => clearTimeout(timeoutId)
    }
  }, [open, reset])

  React.useEffect(() => {
    if (open && initialMember) {
      setSelectedMember(initialMember)
    }
  }, [open, initialMember])

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

    setReceiptNumber(
      typeof result.result.receiptNumber === "number" && Number.isFinite(result.result.receiptNumber)
        ? result.result.receiptNumber
        : null
    )
    setNewBalance(result.result.newBalance ?? null)
    setSuccess(true)
    setLoading(false)

    setTimeout(() => {
      reset()
      onOpenChange(false)
      void onSuccess?.()
    }, 1600)
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    void submitPayment()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          "p-0 border-none shadow-2xl rounded-[24px] overflow-hidden flex flex-col",
          "[&_button]:cursor-pointer [&_button:disabled]:cursor-not-allowed",
          "w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] sm:w-full sm:max-w-[640px]",
          "top-4 sm:top-1/2 translate-y-0 sm:-translate-y-1/2",
          "h-[calc(100vh-2rem)] supports-[height:100dvh]:h-[calc(100dvh-2rem)] sm:h-auto sm:max-h-[calc(100vh-4rem)] sm:max-h-[calc(100dvh-4rem)]"
        )}
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
          <DialogHeader className="shrink-0 px-6 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-4 text-left sm:pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                <Wallet className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold tracking-tight text-slate-900">
                  Receive payment
                </DialogTitle>
                <DialogDescription className="mt-0.5 text-sm text-slate-500">
                  Record an unapplied payment as member account credit. Required fields are marked with{" "}
                  <span className="text-destructive">*</span>.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {success ? (
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 py-10 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                <CheckCircle2 className="h-7 w-7" />
              </div>
              <h3 className="text-lg font-bold tracking-tight text-slate-900">Payment recorded</h3>
              <p className="mt-1.5 text-sm text-slate-500">
                Account credit of {formatCurrency(amount)} has been added.
              </p>
              {typeof newBalance === "number" ? (
                <p className="mt-1 text-sm text-slate-500">
                  New balance:{" "}
                  <span className="font-semibold text-slate-900">{formatCurrency(newBalance)}</span>
                </p>
              ) : null}
              {receiptNumber != null ? (
                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-2.5 font-mono text-xs text-slate-600">
                  Receipt #{receiptNumber}
                </div>
              ) : null}
            </div>
          ) : (
            <>
              <form
                id="record-member-credit-form"
                onSubmit={onSubmit}
                className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain px-6 pb-4"
              >
                <div className="space-y-6">
                  <section>
                    <div className="mb-4 flex items-center gap-2 border-b border-slate-100 pb-3">
                      <User className="h-4 w-4 text-slate-500" />
                      <span className="text-[13px] font-semibold text-slate-900">Member</span>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        Select member <span className="text-destructive">*</span>
                      </label>
                      <MemberSelect
                        members={members}
                        value={selectedMember}
                        onSelect={setSelectedMember}
                        disabled={loading || lockMemberSelection}
                        buttonClassName="h-10 w-full justify-start rounded-xl border-slate-300 bg-white px-3 text-base font-medium shadow-none hover:bg-slate-50 focus:ring-0 md:text-sm"
                        contentClassName="rounded-xl border-slate-200 shadow-xl"
                        inputClassName="rounded-lg border-slate-200 bg-white text-xs font-medium placeholder:text-slate-300 focus:border-blue-500"
                        listClassName="rounded-xl border-slate-200"
                      />
                    </div>
                  </section>

                  <section>
                    <div className="mb-4 flex items-center gap-2 border-b border-slate-100 pb-3">
                      <DollarSign className="h-4 w-4 text-slate-500" />
                      <span className="text-[13px] font-semibold text-slate-900">Payment</span>
                    </div>
                    <div className="grid grid-cols-1 items-end gap-4 sm:grid-cols-[2fr_3fr]">
                      <div className="flex min-h-0 flex-col">
                        <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                          Amount <span className="text-destructive">*</span>
                        </label>
                        <div className="relative">
                          <DollarSign className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
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
                            className="h-10 rounded-xl border border-slate-300 bg-white pl-9 text-base font-medium shadow-none [appearance:textfield] placeholder:text-slate-300 focus-visible:ring-1 focus-visible:ring-slate-900 md:text-sm [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                            required
                            disabled={loading}
                          />
                        </div>
                      </div>
                      <div className="flex min-h-0 flex-col">
                        <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                          Method <span className="text-destructive">*</span>
                        </label>
                        <Select
                          value={method}
                          onValueChange={(value) => setMethod(value as PaymentMethod)}
                          disabled={loading}
                        >
                          <SelectTrigger className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-base font-medium shadow-none hover:bg-slate-50 focus:ring-0 md:text-sm">
                            <SelectValue placeholder="Select method" />
                          </SelectTrigger>
                          <SelectContent
                            position="popper"
                            className="w-[var(--radix-select-trigger-width)] rounded-xl border-slate-200 shadow-xl"
                          >
                            {paymentMethods.map((paymentMethod) => (
                              <SelectItem
                                key={paymentMethod.value}
                                value={paymentMethod.value}
                                className="rounded-lg py-2 text-xs"
                              >
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
                  </section>

                  <section>
                    <div className="mb-4 flex items-center gap-2 border-b border-slate-100 pb-3">
                      <Receipt className="h-4 w-4 text-slate-500" />
                      <span className="text-[13px] font-semibold text-slate-900">Details</span>
                    </div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                          Reference
                        </label>
                        <div className="relative">
                          <Receipt className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                          <Input
                            placeholder="Transaction ID or reference"
                            value={reference}
                            onChange={(event) => setReference(event.target.value)}
                            disabled={loading}
                            className="h-10 rounded-xl border-slate-300 bg-white pl-9 text-sm font-medium shadow-none placeholder:text-slate-300"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                          Date
                        </label>
                        <div className="relative">
                          <CalendarIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                          <Input
                            type="date"
                            value={paidDate}
                            onChange={(event) => setPaidDate(event.target.value)}
                            disabled={loading}
                            className="h-10 rounded-xl border-slate-300 bg-white pl-9 text-sm font-medium shadow-none"
                          />
                        </div>
                      </div>
                    </div>
                    <Collapsible open={notesOpen} onOpenChange={setNotesOpen} className="mt-4">
                      <CollapsibleTrigger asChild>
                        <button
                          type="button"
                          className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 transition-colors hover:text-blue-700 disabled:opacity-50"
                          disabled={loading}
                        >
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                            <IconPlus className="h-3.5 w-3.5" />
                          </span>
                          {notesOpen ? "Hide notes" : "Add notes"}
                        </button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="pt-3">
                        <div>
                          <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                            Notes
                          </label>
                          <Textarea
                            placeholder="Optional note for this payment"
                            value={notes}
                            onChange={(event) => setNotes(event.target.value)}
                            disabled={loading}
                            rows={3}
                            className="rounded-xl border-slate-200 bg-white px-3 py-2 text-[15px] shadow-none transition-colors focus-visible:ring-0"
                          />
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </section>

                  {selectedMember ? (
                    <div className="rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm text-slate-600">
                      <span className="inline-flex items-center gap-2">
                        <User className="h-4 w-4 text-slate-500" />
                        <span>
                          Credit will be applied to{" "}
                          <span className="font-semibold text-slate-900">
                            {[selectedMember.first_name, selectedMember.last_name].filter(Boolean).join(" ") ||
                              selectedMember.email}
                          </span>
                          .
                        </span>
                      </span>
                    </div>
                  ) : null}

                  {error ? (
                    <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-2.5 text-xs font-medium text-destructive">
                      {error}
                    </div>
                  ) : null}
                </div>
              </form>

              <div className="shrink-0 border-t border-slate-100 bg-white px-6 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pb-4">
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
                  <div className="flex flex-1 items-center justify-end">
                    <Button
                      type="submit"
                      form="record-member-credit-form"
                      disabled={loading || !method || amount <= 0 || !selectedMember}
                      className="h-11 min-w-[160px] rounded-xl bg-slate-900 px-6 text-sm font-semibold text-white shadow-lg shadow-slate-900/10 transition-shadow hover:bg-slate-900 hover:text-white hover:shadow-xl hover:shadow-slate-900/20"
                    >
                      {loading ? (
                        <span className="inline-flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Recording…
                        </span>
                      ) : (
                        "Record payment"
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
