"use client"

import * as React from "react"
import { useQueryClient } from "@tanstack/react-query"
import { IconChevronDown } from "@tabler/icons-react"
import { Ban } from "lucide-react"
import { toast } from "sonner"

import { useTimezone } from "@/contexts/timezone-context"
import { formatDate } from "@/lib/utils/date-format"

import { approveDraftInvoiceAction } from "@/app/invoices/[id]/actions"
import InvoiceActionsToolbar from "@/components/invoices/invoice-actions-toolbar"
import { InvoiceAuditTimeline } from "@/components/invoices/invoice-audit-timeline"
import InvoiceDocumentView from "@/components/invoices/invoice-document-view"
import { InvoicePaymentsCard } from "@/components/invoices/invoice-payments-card"
import InvoiceViewActions from "@/components/invoices/invoice-view-actions"
import type { UserResult } from "@/components/invoices/member-select"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { invoiceDetailQueryKey, useInvoiceDetailQuery } from "@/hooks/use-invoice-detail-query"
import { invoicesQueryKey } from "@/hooks/use-invoices-query"
import type {
  InvoiceAuditLog,
  InvoiceAuditLookupMaps,
} from "@/lib/invoices/fetch-invoice-audit-logs"
import type { InvoicePaymentRow } from "@/lib/invoices/fetch-invoice-payments"
import { roundToTwoDecimals } from "@/lib/invoices/invoice-calculations"
import {
  DEFAULT_INVOICING_SETTINGS,
  type InvoicingSettings,
} from "@/lib/invoices/invoicing-settings"
import type { InvoiceItemsRow } from "@/lib/types"
import type { InvoiceWithRelations } from "@/lib/types/invoices"
import { cn } from "@/lib/utils"

export function InvoiceDetailClient({
  invoice,
  items,
  settings = DEFAULT_INVOICING_SETTINGS,
  loadErrors = [],
  canApproveDraft = false,
  canVoid = false,
  xeroEnabled = false,
  xeroStatus = null,
  auditLogs = [],
  auditLookupMaps = { users: {} },
  payments = [],
}: {
  invoice: InvoiceWithRelations
  items: InvoiceItemsRow[]
  settings?: InvoicingSettings
  loadErrors?: string[]
  canApproveDraft?: boolean
  canVoid?: boolean
  xeroEnabled?: boolean
  xeroStatus?: {
    export_status: "pending" | "exported" | "failed" | "voided"
    xero_invoice_id: string | null
    exported_at: string | null
    error_message: string | null
  } | null
  auditLogs?: InvoiceAuditLog[]
  auditLookupMaps?: InvoiceAuditLookupMaps
  payments?: InvoicePaymentRow[]
}) {
  const queryClient = useQueryClient()
  const { timeZone } = useTimezone()
  const [isApproving, startApproveTransition] = React.useTransition()
  const [auditOpen, setAuditOpen] = React.useState(true)
  const { data } = useInvoiceDetailQuery({
    invoice,
    items,
    xeroStatus,
  })
  const liveInvoice = data.invoice
  const liveItems = data.items
  const liveXeroStatus = data.xeroStatus

  const selectedMember = React.useMemo<UserResult | null>(() => {
    if (!liveInvoice.user || !liveInvoice.user.id) return null
    return {
      id: liveInvoice.user.id,
      first_name: liveInvoice.user.first_name,
      last_name: liveInvoice.user.last_name,
      email: liveInvoice.user.email ?? "",
    }
  }, [liveInvoice.user])

  const subtotal = roundToTwoDecimals(liveItems.reduce((sum, item) => sum + (item.amount || 0), 0))
  const totalTax = roundToTwoDecimals(liveItems.reduce((sum, item) => sum + (item.tax_amount || 0), 0))
  const total = roundToTwoDecimals(liveItems.reduce((sum, item) => sum + (item.line_total || 0), 0))

  const billToName =
    (selectedMember
      ? `${selectedMember.first_name || ""} ${selectedMember.last_name || ""}`.trim() || selectedMember.email
      : liveInvoice.user_id) || liveInvoice.user_id

  const isXeroLocked = liveXeroStatus?.export_status === "exported"
  const isVoided = !!liveInvoice.deleted_at
  const isReadOnly = isXeroLocked || isVoided

  /** Logo is for PDF/email only — never pass `logoUrl` into the on-screen document or browser print. */
  const settingsForInvoiceScreen = React.useMemo(
    () => ({
      ...settings,
      logoUrl: null as string | null,
    }),
    [settings],
  )

  const handleApprove = React.useCallback(() => {
    if (liveInvoice.status !== "draft") return

    startApproveTransition(async () => {
      const result = await approveDraftInvoiceAction({ invoiceId: liveInvoice.id })
      if (!result.ok) {
        toast.error(result.error)
        return
      }

      toast.success("Invoice approved")
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: invoiceDetailQueryKey(liveInvoice.id) }),
        queryClient.invalidateQueries({ queryKey: invoicesQueryKey(xeroEnabled) }),
      ])
    })
  }, [liveInvoice.status, liveInvoice.id, queryClient, xeroEnabled])

  return (
    <div className="flex flex-1 flex-col bg-muted/20">
      <div className="mx-auto w-full max-w-[920px] px-4 py-4 sm:px-6 lg:px-10 lg:py-8">
        <div className="sticky top-0 z-20 -mx-4 border-b bg-background/95 px-4 py-3 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/70 sm:-mx-6 sm:px-6 sm:py-3.5 lg:-mx-10 lg:px-10">
          <InvoiceActionsToolbar
            mode={isReadOnly ? "view" : "edit"}
            invoiceId={liveInvoice.id}
            invoiceNumber={liveInvoice.invoice_number}
            status={liveInvoice.status}
            isXeroLocked={isXeroLocked}
            member={selectedMember}
            rightSlot={
              liveInvoice.status !== "draft" ? (
                <InvoiceViewActions
                  invoiceId={liveInvoice.id}
                  billToEmail={liveInvoice.user?.email || selectedMember?.email || null}
                  status={liveInvoice.status}
                  settings={settings}
                  xeroEnabled={xeroEnabled}
                  xeroStatus={liveXeroStatus}
                  canVoid={canVoid}
                  bookingId={liveInvoice.booking_id}
                  invoice={{
                    invoiceNumber: liveInvoice.invoice_number || `#${liveInvoice.id.slice(0, 8)}`,
                    issueDate: liveInvoice.issue_date,
                    dueDate: liveInvoice.due_date,
                    taxRate: liveInvoice.tax_rate,
                    subtotal: liveInvoice.subtotal ?? subtotal,
                    taxTotal: liveInvoice.tax_total ?? totalTax,
                    totalAmount: liveInvoice.total_amount ?? total,
                    totalPaid: liveInvoice.total_paid ?? 0,
                    balanceDue:
                      liveInvoice.balance_due ??
                      Math.max(0, (liveInvoice.total_amount ?? total) - (liveInvoice.total_paid ?? 0)),
                    billToName,
                  }}
                  items={liveItems.map((item) => ({
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
            onApprove={
              canApproveDraft && liveInvoice.status === "draft" && !isXeroLocked ? handleApprove : undefined
            }
            saveDisabled
            approveDisabled={isApproving}
            approveLoading={isApproving}
            showApprove={canApproveDraft && liveInvoice.status === "draft" && !isXeroLocked}
          />
        </div>

        {loadErrors.length > 0 ? (
          <p className="mt-4 text-sm text-amber-700">Some sections failed to load: {loadErrors.join(", ")}</p>
        ) : null}

        {isVoided ? (
          <div className="mt-4 flex items-start gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
            <Ban className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
            <div className="space-y-0.5">
              <div className="font-semibold">This invoice has been voided</div>
              <div className="text-rose-800">
                Voided{" "}
                {liveInvoice.deleted_at
                  ? formatDate(liveInvoice.deleted_at, timeZone, "long") || "previously"
                  : "previously"}
                {liveInvoice.deletion_reason ? ` - ${liveInvoice.deletion_reason}` : "."}{" "}
                A reversal transaction has been posted to restore the customer&rsquo;s account
                balance. Original ledger entries are kept for audit.
              </div>
            </div>
          </div>
        ) : null}

        <div className="mt-6 space-y-6">
          <InvoiceDocumentView
            settings={settingsForInvoiceScreen}
            invoice={{
              invoiceNumber: liveInvoice.invoice_number || `#${liveInvoice.id.slice(0, 8)}`,
              issueDate: liveInvoice.issue_date,
              dueDate: liveInvoice.due_date,
              taxRate: liveInvoice.tax_rate,
              subtotal: liveInvoice.subtotal ?? subtotal,
              taxTotal: liveInvoice.tax_total ?? totalTax,
              totalAmount: liveInvoice.total_amount ?? total,
              totalPaid: liveInvoice.total_paid ?? 0,
              balanceDue:
                liveInvoice.balance_due ??
                Math.max(0, (liveInvoice.total_amount ?? total) - (liveInvoice.total_paid ?? 0)),
              billToName,
            }}
            items={liveItems.map((item) => ({
              id: item.id,
              description: item.description,
              quantity: item.quantity,
              unit_price: item.unit_price,
              rate_inclusive: item.rate_inclusive,
              line_total: item.line_total,
            }))}
          />

          {payments.length > 0 ? (
            <InvoicePaymentsCard
              invoiceId={liveInvoice.id}
              payments={payments}
              canReverse={canVoid}
              xeroEnabled={xeroEnabled}
            />
          ) : null}

          <Card className="rounded-xl border border-border/50 shadow-md">
            <CardHeader className="border-b border-border/20 p-0">
              <Button
                variant="ghost"
                className="h-auto w-full justify-start gap-2 rounded-none px-6 py-4 text-left"
                onClick={() => setAuditOpen((prev) => !prev)}
              >
                <IconChevronDown
                  className={cn("h-4 w-4 transition-transform", !auditOpen && "-rotate-90")}
                />
                <CardTitle className="text-base sm:text-lg">Invoice History</CardTitle>
              </Button>
            </CardHeader>
            {auditOpen ? (
              <CardContent className="px-0 pt-4 pb-2">
                <InvoiceAuditTimeline logs={auditLogs} maps={auditLookupMaps} />
              </CardContent>
            ) : null}
          </Card>

        </div>
      </div>
    </div>
  )
}
