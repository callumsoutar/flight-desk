"use client"

import * as React from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Loader2 } from "lucide-react"
import { toast } from "sonner"

import {
  deleteMemberCreditTransactionAction,
  updateInvoicePaymentMetadataAction,
  updateMemberCreditTransactionAction,
} from "@/app/payments/[id]/actions"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useTimezone } from "@/contexts/timezone-context"
import type {
  InvoicePaymentDetail,
  MemberCreditPaymentDetail,
  PaymentDetailResult,
} from "@/lib/payments/fetch-payment-detail"
import {
  invoicePaymentDisplayReference,
  memberCreditDisplayReference,
  paymentPageHeading,
} from "@/lib/payments/payment-display-reference"
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

type PaymentDetailClientProps =
  | {
      variant: "detail"
      detail: PaymentDetailResult
      canManageFinance: boolean
    }
  | {
      variant: "failed"
      failedMessage: string
    }

export function PaymentDetailClient(props: PaymentDetailClientProps) {
  const router = useRouter()
  const { timeZone } = useTimezone()

  React.useEffect(() => {
    const onAfterPrint = () => document.documentElement.classList.remove("payment-receipt-print-mode")
    window.addEventListener("afterprint", onAfterPrint)
    return () => window.removeEventListener("afterprint", onAfterPrint)
  }, [])

  if (props.variant === "failed") {
    return (
      <div className="flex flex-1 flex-col bg-muted/20">
        <div className="mx-auto w-full max-w-[920px] px-4 py-4 sm:px-6 lg:px-10 lg:py-8">
          <Card className="rounded-2xl border border-border/50 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Payment</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{props.failedMessage}</p>
              <Button type="button" variant="outline" className="mt-4" onClick={() => router.back()}>
                Go back
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const { detail, canManageFinance } = props

  return (
    <PaymentDetailLoaded
      detail={detail}
      canManageFinance={canManageFinance}
      formatDate={(v, mode) => formatDate(v, timeZone, mode)}
    />
  )
}

function PaymentDetailLoaded({
  detail,
  canManageFinance,
  formatDate,
}: {
  detail: PaymentDetailResult
  canManageFinance: boolean
  formatDate: (value: string, mode?: "short" | "long") => string | null
}) {
  const router = useRouter()
  const [reverseOpen, setReverseOpen] = React.useState(false)
  const [editOpen, setEditOpen] = React.useState(false)
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [deleteLoading, setDeleteLoading] = React.useState(false)

  const pageHeading = paymentPageHeading(detail)
  const eyebrow =
    detail.kind === "invoice_payment"
      ? detail.invoice_number
        ? `Invoice ${detail.invoice_number}`
        : "Invoice payment"
      : "Member credit"
  const eventDate = detail.kind === "invoice_payment" ? detail.paid_at : detail.paid_at
  const eventDateLabel = formatDate(eventDate, "long") ?? eventDate

  const handlePrint = () => {
    document.documentElement.classList.add("payment-receipt-print-mode")
    requestAnimationFrame(() => {
      window.print()
    })
  }

  const invoicePaymentRef =
    detail.kind === "invoice_payment" ? invoicePaymentDisplayReference(detail) : null
  const memberCreditRef =
    detail.kind === "member_credit_topup" ? memberCreditDisplayReference(detail) : null

  return (
    <div className="flex flex-1 flex-col bg-muted/20">
      <div
        id="payment-receipt-print-root"
        className="pointer-events-none fixed left-[-10000px] top-0 w-px overflow-hidden print:pointer-events-auto print:static print:left-auto print:w-full print:overflow-visible print:rounded-none print:border-0"
        aria-hidden
      >
        <div className="border border-border/60 bg-background p-6 text-sm text-foreground shadow-none print:border-0 print:shadow-none">
          <div className="text-lg font-semibold">Payment receipt</div>
          {detail.kind === "invoice_payment" ? (
            <>
              {invoicePaymentRef ? (
                <p className="mt-3 text-base font-semibold tabular-nums">
                  Receipt {invoicePaymentRef.value}
                </p>
              ) : null}
              <p className="mt-4">
                Amount: <span className="font-medium">{formatMoney(detail.amount)}</span>
              </p>
              <p className="mt-1">
                Method:{" "}
                <span className="font-medium">{formatMethod(String(detail.payment_method))}</span>
              </p>
              <p className="mt-1">Date paid: {formatDate(detail.paid_at, "long") ?? detail.paid_at}</p>
              {detail.payment_reference ? (
                <p className="mt-1 font-mono text-xs">
                  Reference: {detail.payment_reference}
                </p>
              ) : null}
            </>
          ) : (
            <>
              <p className="mt-2 font-medium text-muted-foreground">Member credit top-up</p>
              {memberCreditRef ? (
                <p className="mt-2 text-base font-semibold tabular-nums">
                  Receipt {memberCreditRef.value}
                </p>
              ) : null}
              <p className="mt-4">
                Amount: <span className="font-medium">{formatMoney(detail.amount)}</span>
              </p>
              <p className="mt-1 text-muted-foreground">
                Paid: {formatDate(detail.paid_at, "long") ?? detail.paid_at}
              </p>
              {detail.payment_reference ? (
                <p className="mt-1 font-mono text-xs">Reference: {detail.payment_reference}</p>
              ) : null}
            </>
          )}
        </div>
      </div>
      <div className="mx-auto w-full max-w-[920px] px-4 py-4 sm:px-6 lg:px-10 lg:py-8">
        <div className="sticky top-0 z-20 -mx-4 border-b border-border/60 bg-background/95 px-4 py-4 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/70 sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="-ml-2 h-8 gap-1 px-2 text-muted-foreground hover:text-foreground"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>

          <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0 space-y-2">
              <p className="text-sm text-muted-foreground">{eyebrow}</p>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                {pageHeading}
              </h1>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <span>{eventDateLabel}</span>
                {detail.payer_name ? (
                  detail.kind === "invoice_payment" ? (
                    <Link href={`/members/${detail.user_id}`} className="underline-offset-4 hover:underline">
                      {detail.payer_name}
                    </Link>
                  ) : (
                    <Link
                      href={`/members/${detail.user_id}?tab=finances`}
                      className="underline-offset-4 hover:underline"
                    >
                      {detail.payer_name}
                    </Link>
                  )
                ) : null}
                {detail.kind === "invoice_payment" && detail.reversed_at ? (
                  <span className="rounded-full border border-border/60 px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-foreground">
                    Reversed
                  </span>
                ) : null}
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handlePrint}
              >
                Print receipt
              </Button>

              {detail.kind === "invoice_payment" &&
              canManageFinance &&
              !detail.reversed_at &&
              detail.invoice_id ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setEditOpen(true)}
                  >
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-rose-700 hover:bg-rose-50 hover:text-rose-800"
                    onClick={() => setReverseOpen(true)}
                  >
                    Reverse
                  </Button>
                </>
              ) : null}

              {detail.kind === "member_credit_topup" && canManageFinance ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setEditOpen(true)}
                  >
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-rose-700 hover:bg-rose-50 hover:text-rose-800"
                    onClick={() => setDeleteOpen(true)}
                  >
                    Delete
                  </Button>
                </>
              ) : null}
            </div>
          </div>
        </div>

        <div className="mt-6 pb-8">
          {detail.kind === "invoice_payment" ? (
            <>
              <InvoicePaymentBody detail={detail} formatDate={formatDate} router={router} />
              {reverseOpen ? (
                <ReversePaymentModal
                  open={reverseOpen}
                  onOpenChange={setReverseOpen}
                  paymentId={detail.id}
                  amount={detail.amount}
                  paymentMethod={String(detail.payment_method)}
                  paidAt={detail.paid_at}
                  onSuccess={async () => {
                    router.push(`/invoices/${detail.invoice_id}`)
                    router.refresh()
                  }}
                />
              ) : null}
              <InvoicePaymentEditDialog
                detail={detail}
                open={editOpen}
                onOpenChange={setEditOpen}
                onSaved={() => {
                  toast.success("Payment updated")
                  router.refresh()
                }}
              />
            </>
          ) : (
            <>
              <MemberCreditBody detail={detail} formatDate={formatDate} router={router} />
              <MemberCreditEditDialog detail={detail} open={editOpen} onOpenChange={setEditOpen} />

              <AlertDialog open={deleteOpen} onOpenChange={(o) => !deleteLoading && setDeleteOpen(o)}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this credit entry?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This permanently removes the member credit top-up from the ledger for{" "}
                      <span className="font-medium">{formatMoney(detail.amount)}</span>. Confirm only
                      if the entry was created in error.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel type="button" disabled={deleteLoading}>
                      Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction
                      type="button"
                      className="bg-rose-600 text-white hover:bg-rose-700"
                      disabled={deleteLoading}
                      onClick={async () => {
                        setDeleteLoading(true)
                        try {
                          const result = await deleteMemberCreditTransactionAction({
                            transactionId: detail.id,
                          })
                          if (!result.ok) {
                            toast.error(result.error)
                            return
                          }
                          toast.success("Credit entry deleted")
                          setDeleteOpen(false)
                          router.push(result.redirectTo)
                          router.refresh()
                        } finally {
                          setDeleteLoading(false)
                        }
                      }}
                    >
                      {deleteLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Deleting…
                        </>
                      ) : (
                        "Delete"
                      )}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function InvoicePaymentBody({
  detail,
  formatDate,
  router,
}: {
  detail: InvoicePaymentDetail
  formatDate: (value: string, mode?: "short" | "long") => string | null
  router: ReturnType<typeof useRouter>
}) {
  const isReversed = Boolean(detail.reversed_at)
  const displayReference = invoicePaymentDisplayReference(detail)

  return (
    <Card className="overflow-hidden rounded-[28px] border border-border/60 shadow-sm">
      <CardContent className="p-0">
        <div className="border-b border-border/50 px-6 py-6 sm:px-8 sm:py-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                {isReversed ? "Reversed invoice payment" : "Invoice payment"}
              </p>
              <p className="text-3xl font-semibold tracking-tight tabular-nums text-foreground sm:text-4xl">
                {formatMoney(detail.amount)}
              </p>
              <p className="text-sm text-muted-foreground">
                {formatMethod(String(detail.payment_method))} ·{" "}
                {formatDate(detail.paid_at, "long") ?? detail.paid_at}
              </p>
            </div>

            <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:min-w-[320px]">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  {displayReference.label}
                </p>
                <p className="mt-2 text-sm font-semibold tabular-nums text-foreground">
                  {displayReference.value}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  Invoice
                </p>
                <div className="mt-2 text-sm text-foreground">
                  <button
                    type="button"
                    className="text-left underline-offset-4 hover:underline"
                    onClick={() => router.push(`/invoices/${detail.invoice_id}`)}
                  >
                    {detail.invoice_number ? detail.invoice_number : "Open linked invoice"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6 px-6 py-6 sm:px-8 sm:py-8">
          {isReversed ? (
            <div className="rounded-xl border border-border/60 bg-muted/30 px-4 py-3 text-sm text-foreground">
              Reversed{" "}
              {detail.reversed_at ? formatDate(detail.reversed_at, "long") ?? detail.reversed_at : ""}
              {detail.reversal_reason ? ` · ${detail.reversal_reason}` : ""}
            </div>
          ) : null}

          <dl className="grid gap-x-12 gap-y-6 sm:grid-cols-2">
            <div>
              <dt className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                Paying member
              </dt>
              <dd className="mt-2 text-sm text-foreground">
              {detail.payer_name ? (
                <Link href={`/members/${detail.user_id}`} className="underline-offset-4 hover:underline">
                  {detail.payer_name}
                </Link>
              ) : (
                <button
                  type="button"
                  className="text-left underline-offset-4 hover:underline"
                  onClick={() => router.push(`/members/${detail.user_id}`)}
                >
                  View member
                </button>
              )}
              </dd>
            </div>

            {detail.payment_reference ? (
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  Reference
                </dt>
                <dd className="mt-2 text-sm text-foreground">
                  <span className="font-mono">{detail.payment_reference}</span>
                </dd>
              </div>
            ) : null}

            {detail.notes?.trim() ? (
              <div className="sm:col-span-2">
                <dt className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  Notes
                </dt>
                <dd className="mt-2 whitespace-pre-wrap text-sm text-foreground">{detail.notes.trim()}</dd>
              </div>
            ) : null}
          </dl>

          <div className="border-t border-border/60 pt-4 text-sm text-muted-foreground">
            <p>
              Recorded by {detail.created_by_name ?? "—"}
              {detail.created_at ? ` · ${formatDate(detail.created_at, "short") ?? detail.created_at}` : ""}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function MemberCreditBody({
  detail,
  formatDate,
  router,
}: {
  detail: MemberCreditPaymentDetail
  formatDate: (value: string, mode?: "short" | "long") => string | null
  router: ReturnType<typeof useRouter>
}) {
  const reference = detail.payment_reference?.trim() || detail.reference_number?.trim() || null
  const displayReference = memberCreditDisplayReference(detail)

  return (
    <Card className="overflow-hidden rounded-[28px] border border-border/60 shadow-sm">
      <CardContent className="p-0">
        <div className="border-b border-border/50 px-6 py-6 sm:px-8 sm:py-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Member credit</p>
              <p className="text-3xl font-semibold tracking-tight tabular-nums text-foreground sm:text-4xl">
                {formatMoney(detail.amount)}
              </p>
              <p className="text-sm text-muted-foreground">
                {detail.payment_method_label ?? "Recorded manually"} ·{" "}
                {formatDate(detail.paid_at, "long") ?? detail.paid_at}
              </p>
            </div>

            <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:min-w-[320px]">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  {displayReference.label}
                </p>
                <p className="mt-2 text-sm font-semibold tabular-nums text-foreground">
                  {displayReference.value}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  Member
                </p>
                <div className="mt-2 text-sm text-foreground">
                  {detail.payer_name ? (
                    <Link
                      href={`/members/${detail.user_id}?tab=finances`}
                      className="underline-offset-4 hover:underline"
                    >
                      {detail.payer_name}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      className="text-left underline-offset-4 hover:underline"
                      onClick={() => router.push(`/members/${detail.user_id}?tab=finances`)}
                    >
                      Open member finances
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6 px-6 py-6 sm:px-8 sm:py-8">
          <dl className="grid gap-x-12 gap-y-6 sm:grid-cols-2">
            {reference ? (
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  Reference
                </dt>
                <dd className="mt-2 text-sm text-foreground">
                  <span className="font-mono">{reference}</span>
                </dd>
              </div>
            ) : null}

            <div className="sm:col-span-2">
              <dt className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                Description
              </dt>
              <dd className="mt-2 text-sm text-foreground">{detail.description}</dd>
            </div>

            {detail.notes?.trim() ? (
              <div className="sm:col-span-2">
                <dt className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  Notes
                </dt>
                <dd className="mt-2 whitespace-pre-wrap text-sm text-foreground">{detail.notes.trim()}</dd>
              </div>
            ) : null}
          </dl>

          <div className="border-t border-border/60 pt-4 text-sm text-muted-foreground">
            <p>
              Recorded
              {detail.created_at ? ` · ${formatDate(detail.created_at, "short") ?? detail.created_at}` : ""}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function InvoicePaymentEditDialog({
  detail,
  open,
  onOpenChange,
  onSaved,
}: {
  detail: InvoicePaymentDetail
  open: boolean
  onOpenChange: (v: boolean) => void
  onSaved: () => void
}) {
  const [notes, setNotes] = React.useState(detail.notes ?? "")
  const [ref, setRef] = React.useState(detail.payment_reference ?? "")
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    if (open) {
      setNotes(detail.notes ?? "")
      setRef(detail.payment_reference ?? "")
    }
  }, [open, detail.notes, detail.payment_reference])

  const submit = async () => {
    setLoading(true)
    try {
      const result = await updateInvoicePaymentMetadataAction({
        paymentId: detail.id,
        notes,
        paymentReference: ref.trim() === "" ? null : ref.trim(),
      })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      onSaved()
      onOpenChange(false)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !loading && onOpenChange(v)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit payment details</DialogTitle>
          <DialogDescription>Update reference details shown on receipts and invoices.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="ip-ref">Payment reference</Label>
            <Input id="ip-ref" value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Optional" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ip-notes">Notes</Label>
            <Textarea
              id="ip-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional"
              rows={4}
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void submit()} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function MemberCreditEditDialog({
  detail,
  open,
  onOpenChange,
}: {
  detail: MemberCreditPaymentDetail
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const router = useRouter()
  const [description, setDescription] = React.useState(detail.description)
  const [reference, setReference] = React.useState(detail.reference_number ?? "")
  const [notes, setNotes] = React.useState(detail.notes ?? "")
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    if (open) {
      setDescription(detail.description)
      setReference(detail.reference_number ?? "")
      setNotes(detail.notes ?? "")
    }
  }, [open, detail.description, detail.reference_number, detail.notes])

  const submit = async () => {
    setLoading(true)
    try {
      const result = await updateMemberCreditTransactionAction({
        transactionId: detail.id,
        description: description.trim(),
        referenceNumber: reference.trim() === "" ? null : reference.trim(),
        notes: notes.trim() === "" ? null : notes,
      })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success("Credit entry updated")
      onOpenChange(false)
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !loading && onOpenChange(v)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit credit entry</DialogTitle>
          <DialogDescription>Adjust wording shown on statements and receipts.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="mc-desc">Description</Label>
            <Input id="mc-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mc-ref">Reference number</Label>
            <Input id="mc-ref" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Optional" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mc-notes">Internal notes</Label>
            <Textarea id="mc-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void submit()} disabled={loading || description.trim().length === 0}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
