"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { ChevronRight } from "lucide-react"
import { toast } from "sonner"

import { approveDraftInvoiceAction } from "@/app/invoices/[id]/actions"
import InvoiceActionsToolbar from "@/components/invoices/invoice-actions-toolbar"
import InvoiceDocumentView from "@/components/invoices/invoice-document-view"
import InvoiceViewActions from "@/components/invoices/invoice-view-actions"
import type { UserResult } from "@/components/invoices/member-select"
import { Card } from "@/components/ui/card"
import { roundToTwoDecimals } from "@/lib/invoices/invoice-calculations"
import {
  DEFAULT_INVOICING_SETTINGS,
  type InvoicingSettings,
} from "@/lib/invoices/invoicing-settings"
import type { InvoiceItemsRow } from "@/lib/types"
import type { InvoiceWithRelations } from "@/lib/types/invoices"

export function InvoiceDetailClient({
  invoice,
  items,
  settings = DEFAULT_INVOICING_SETTINGS,
  loadErrors = [],
  canApproveDraft = false,
}: {
  invoice: InvoiceWithRelations
  items: InvoiceItemsRow[]
  settings?: InvoicingSettings
  loadErrors?: string[]
  canApproveDraft?: boolean
}) {
  const router = useRouter()
  const [isApproving, startApproveTransition] = React.useTransition()

  const selectedMember = React.useMemo<UserResult | null>(() => {
    if (!invoice.user || !invoice.user.id || !invoice.user.email) return null
    return {
      id: invoice.user.id,
      first_name: invoice.user.first_name,
      last_name: invoice.user.last_name,
      email: invoice.user.email ?? "",
    }
  }, [invoice.user])

  const subtotal = roundToTwoDecimals(items.reduce((sum, item) => sum + (item.amount || 0), 0))
  const totalTax = roundToTwoDecimals(items.reduce((sum, item) => sum + (item.tax_amount || 0), 0))
  const total = roundToTwoDecimals(items.reduce((sum, item) => sum + (item.line_total || 0), 0))

  const billToName =
    (selectedMember
      ? `${selectedMember.first_name || ""} ${selectedMember.last_name || ""}`.trim() || selectedMember.email
      : invoice.user_id) || invoice.user_id

  const isReadOnly = invoice.status !== "draft"

  const handleApprove = React.useCallback(() => {
    if (invoice.status !== "draft") return

    startApproveTransition(async () => {
      const result = await approveDraftInvoiceAction({ invoiceId: invoice.id })
      if (!result.ok) {
        toast.error(result.error)
        return
      }

      toast.success("Invoice approved")
      router.refresh()
    })
  }, [invoice.id, invoice.status, router])

  return (
    <div className="flex flex-1 flex-col bg-muted/20">
      <div className="mx-auto w-full max-w-[920px] px-4 py-4 sm:px-6 lg:px-10 lg:py-8">
        <div className="sticky top-0 z-20 -mx-4 border-b bg-background/95 px-4 py-2.5 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/70 sm:-mx-6 sm:px-6 sm:py-4 lg:-mx-10 lg:px-10">
          <InvoiceActionsToolbar
            mode={isReadOnly ? "view" : "edit"}
            invoiceId={invoice.id}
            invoiceNumber={invoice.invoice_number}
            status={invoice.status}
            member={selectedMember}
            rightSlot={
              isReadOnly ? (
                <InvoiceViewActions
                  invoiceId={invoice.id}
                  billToEmail={invoice.user?.email || selectedMember?.email || null}
                  status={invoice.status}
                  settings={settings}
                  bookingId={invoice.booking_id}
                  invoice={{
                    invoiceNumber: invoice.invoice_number || `#${invoice.id.slice(0, 8)}`,
                    issueDate: invoice.issue_date,
                    dueDate: invoice.due_date,
                    taxRate: invoice.tax_rate,
                    subtotal: invoice.subtotal ?? subtotal,
                    taxTotal: invoice.tax_total ?? totalTax,
                    totalAmount: invoice.total_amount ?? total,
                    totalPaid: invoice.total_paid ?? 0,
                    balanceDue:
                      invoice.balance_due ??
                      Math.max(0, (invoice.total_amount ?? total) - (invoice.total_paid ?? 0)),
                    billToName,
                  }}
                  items={items.map((item) => ({
                    id: item.id,
                    description: item.description,
                    quantity: item.quantity,
                    unit_price: item.unit_price,
                    rate_inclusive: item.rate_inclusive,
                    line_total: item.line_total,
                  }))}
                />
              ) : null
            }
            onApprove={canApproveDraft && invoice.status === "draft" ? handleApprove : undefined}
            saveDisabled
            approveDisabled={isApproving}
            approveLoading={isApproving}
            showApprove={canApproveDraft && invoice.status === "draft"}
          />
        </div>

        {loadErrors.length > 0 ? (
          <p className="mt-4 text-sm text-amber-700">Some sections failed to load: {loadErrors.join(", ")}</p>
        ) : null}

        <div className="mt-6 space-y-6">
          <InvoiceDocumentView
            settings={settings}
            invoice={{
              invoiceNumber: invoice.invoice_number || `#${invoice.id.slice(0, 8)}`,
              issueDate: invoice.issue_date,
              dueDate: invoice.due_date,
              taxRate: invoice.tax_rate,
              subtotal: invoice.subtotal ?? subtotal,
              taxTotal: invoice.tax_total ?? totalTax,
              totalAmount: invoice.total_amount ?? total,
              totalPaid: invoice.total_paid ?? 0,
              balanceDue:
                invoice.balance_due ??
                Math.max(0, (invoice.total_amount ?? total) - (invoice.total_paid ?? 0)),
              billToName,
            }}
            items={items.map((item) => ({
              id: item.id,
              description: item.description,
              quantity: item.quantity,
              unit_price: item.unit_price,
              rate_inclusive: item.rate_inclusive,
              line_total: item.line_total,
            }))}
          />

          <Card className="shadow-sm ring-1 ring-border/40">
            <div className="p-6">
              <div className="text-base font-semibold">Notes</div>
              <div className="mt-1 text-sm text-muted-foreground">Optional internal notes for this invoice.</div>

              <details className="group mt-4 w-full">
                <summary className="flex w-full cursor-pointer list-none items-center gap-2 text-sm font-medium text-muted-foreground transition hover:text-foreground">
                  <ChevronRight className="h-4 w-4 transition-transform duration-200 group-open:rotate-90" />
                  <span>{invoice.notes ? "View notes" : "No notes"}</span>
                </summary>
                <div className="pt-3">
                  <textarea
                    className="min-h-[120px] w-full resize-vertical rounded-md border border-input bg-background px-3 py-2 text-sm transition placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={invoice.notes || ""}
                    readOnly
                  />
                </div>
              </details>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
