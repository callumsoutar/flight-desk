"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import {
  Ban,
  Calendar,
  ChevronDown,
  Download,
  ExternalLink,
  Loader2,
  Mail,
  PlusCircle,
  Printer,
  RefreshCw,
  Scissors,
} from "lucide-react"
import { toast } from "sonner"

import { useTimezone } from "@/contexts/timezone-context"
import { runAsyncProgressToast } from "@/components/ui/async-progress-toast"
import { Button } from "@/components/ui/button"
import {
  exportInvoicesToXeroMutation,
  type InvoiceDetailQueryData,
  invoiceDetailQueryKey,
  sendInvoiceEmailMutation,
} from "@/hooks/use-invoice-detail-query"
import { invoicesQueryKey } from "@/hooks/use-invoices-query"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import dynamic from "next/dynamic"

const RecordPaymentModal = dynamic(
  () => import("@/components/invoices/record-payment-modal"),
  { ssr: false }
)
const VoidAndReissueModal = dynamic(
  () => import("@/components/invoices/void-and-reissue-modal").then((mod) => mod.VoidAndReissueModal),
  { ssr: false }
)
const VoidInvoiceModal = dynamic(
  () => import("@/components/invoices/void-invoice-modal").then((mod) => mod.VoidInvoiceModal),
  { ssr: false }
)

import type {
  InvoiceDocumentData,
  InvoiceDocumentItem,
  InvoicingSettings,
} from "@/components/invoices/invoice-document-view"

type XeroStatusData = {
  export_status: "pending" | "exported" | "failed" | "voided"
  xero_invoice_id: string | null
  exported_at: string | null
  error_message: string | null
}

export type InvoiceViewActionsProps = {
  invoiceId: string
  invoice: InvoiceDocumentData
  items: InvoiceDocumentItem[]
  settings: InvoicingSettings
  status?: string | null
  billToEmail?: string | null
  bookingId?: string | null
  xeroEnabled?: boolean
  xeroStatus?: XeroStatusData | null
  canVoid?: boolean
  onPaymentSuccess?: () => void
}

const VOIDABLE_STATUSES = new Set(["draft", "authorised", "overdue", "paid"])

const XERO_EXPORTABLE = new Set(["authorised", "paid", "overdue"])

/** react-pdf in the browser often fails to embed remote URLs; prefetch as data URI when possible. */
async function fetchLogoAsDataUri(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, { mode: "cors", credentials: "omit", cache: "no-store" })
    if (!response.ok) return null
    const blob = await response.blob()
    return await new Promise<string | null>((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        const result = reader.result
        resolve(typeof result === "string" ? result : null)
      }
      reader.onerror = () => reject(reader.error ?? new Error("Failed to read logo"))
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

export default function InvoiceViewActions({
  invoiceId,
  invoice,
  items,
  settings,
  status,
  billToEmail,
  bookingId,
  xeroEnabled = false,
  xeroStatus = null,
  canVoid = false,
  onPaymentSuccess,
}: InvoiceViewActionsProps) {
  const queryClient = useQueryClient()
  const router = useRouter()
  const { timeZone } = useTimezone()
  const [paymentOpen, setPaymentOpen] = React.useState(false)
  const [voidOpen, setVoidOpen] = React.useState(false)
  const [voidInvoiceOpen, setVoidInvoiceOpen] = React.useState(false)
  const [isDownloading, setIsDownloading] = React.useState(false)
  const [isPrinting, setIsPrinting] = React.useState(false)
  const [isExporting, setIsExporting] = React.useState(false)
  const [isEmailing, setIsEmailing] = React.useState(false)

  const canEmail = Boolean(billToEmail)
  const hasBalanceDue = typeof invoice.balanceDue === "number" ? invoice.balanceDue > 0 : true
  const canRecordPayment = (status === "authorised" || status === "overdue") && hasBalanceDue

  const canExportToXero =
    xeroEnabled &&
    !!status &&
    XERO_EXPORTABLE.has(status) &&
    (!xeroStatus || xeroStatus.export_status === "voided")
  const canRetryXero = xeroEnabled && xeroStatus?.export_status === "failed"
  const canViewInXero =
    xeroEnabled && xeroStatus?.export_status === "exported" && !!xeroStatus?.xero_invoice_id
  const canVoidAndReissue = canViewInXero

  const showXeroSection = xeroEnabled && (canExportToXero || canRetryXero || canViewInXero)

  const isXeroLockedForVoid = !!xeroStatus && xeroStatus.export_status === "exported"
  const showVoidInvoice =
    canVoid && !!status && VOIDABLE_STATUSES.has(status) && !isXeroLockedForVoid

  const handleDownloadPDF = async () => {
    setIsDownloading(true)
    try {
      const [{ pdf }, { default: InvoiceReportPDF }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("@/components/invoices/invoice-report-pdf"),
      ])
      let pdfSettings = settings
      if (
        settings.includeLogoOnInvoice &&
        settings.logoUrl &&
        (settings.logoUrl.startsWith("http://") || settings.logoUrl.startsWith("https://"))
      ) {
        const dataUri = await fetchLogoAsDataUri(settings.logoUrl)
        if (dataUri) {
          pdfSettings = { ...settings, logoUrl: dataUri }
        }
      }

      const blob = await pdf(
        <InvoiceReportPDF invoice={invoice} items={items} settings={pdfSettings} timeZone={timeZone} />
      ).toBlob()

      const objectUrl = URL.createObjectURL(blob)
      const link = document.createElement("a")
      const rawNumber = invoice.invoiceNumber || `#${invoiceId.slice(0, 8)}`
      const safeInvoiceNumber = rawNumber.replace(/[^a-zA-Z0-9_-]/g, "_")

      link.href = objectUrl
      link.download = `invoice-${safeInvoiceNumber}.pdf`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(objectUrl)
    } catch {
      toast.error("Failed to generate PDF")
    } finally {
      setIsDownloading(false)
    }
  }

  const handlePrint = async () => {
    setIsPrinting(true)
    await new Promise((resolve) => setTimeout(resolve, 300))
    window.print()
    setIsPrinting(false)
  }

  const handleExportToXero = async () => {
    setIsExporting(true)
    try {
      const results = await exportInvoicesToXeroMutation([invoiceId])
      const exportResult = results.find((result) => result.invoiceId === invoiceId)

      if (exportResult?.status === "failed") {
        throw new Error(exportResult.error || "Failed to export to Xero")
      }

      if (exportResult?.status === "exported" || exportResult?.status === "skipped") {
        queryClient.setQueryData<InvoiceDetailQueryData>(invoiceDetailQueryKey(invoiceId), (current) => {
          if (!current) return current
          return {
            ...current,
            xeroStatus: {
              export_status: "exported",
              xero_invoice_id:
                exportResult.xeroInvoiceId ?? current.xeroStatus?.xero_invoice_id ?? null,
              exported_at: new Date().toISOString(),
              error_message: null,
            },
          }
        })
      }

      toast.success("Invoice exported to Xero")
      await Promise.all([
        queryClient.refetchQueries({ queryKey: invoiceDetailQueryKey(invoiceId), exact: true }),
        queryClient.invalidateQueries({ queryKey: invoicesQueryKey(xeroEnabled) }),
      ])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to export to Xero")
    } finally {
      setIsExporting(false)
    }
  }

  const handleEmailInvoice = async () => {
    if (!canEmail) return
    setIsEmailing(true)
    try {
      await runAsyncProgressToast({
        promise: () => sendInvoiceEmailMutation(invoiceId),
        loading: "Sending invoice",
        loadingDescription: "Preparing the invoice email and attachments.",
        success: "Invoice sent to member",
        successDescription: billToEmail ?? undefined,
        error: (error) => error instanceof Error ? error.message : "Failed to send invoice email",
      })
    } catch {
      return
    } finally {
      setIsEmailing(false)
    }
  }

  return (
    <>
      <div className="flex items-center gap-2">
        {canRecordPayment ? (
          <Button
            type="button"
            size="sm"
            className="h-8 gap-1.5 sm:h-9"
            onClick={() => setPaymentOpen(true)}
          >
            <PlusCircle className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Add Payment</span>
            <span className="sm:hidden">Pay</span>
          </Button>
        ) : null}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 sm:h-9">
              Options
              <ChevronDown className="h-3.5 w-3.5 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem
              onSelect={(e) => { e.preventDefault(); void handleEmailInvoice() }}
              disabled={!canEmail || isEmailing}
            >
              {isEmailing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
              Email Invoice
            </DropdownMenuItem>

            <DropdownMenuItem onSelect={(e) => { e.preventDefault(); void handleDownloadPDF() }} disabled={isDownloading}>
              {isDownloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              Download PDF
            </DropdownMenuItem>

            <DropdownMenuItem onSelect={(e) => { e.preventDefault(); void handlePrint() }} disabled={isPrinting}>
              {isPrinting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}
              Print PDF
            </DropdownMenuItem>

            {bookingId ? (
              <DropdownMenuItem onSelect={() => router.push(`/bookings/${bookingId}`)}>
                <Calendar className="mr-2 h-4 w-4" />
                View Booking
              </DropdownMenuItem>
            ) : null}

            {canRecordPayment ? (
              <DropdownMenuItem onSelect={() => setPaymentOpen(true)}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Record Payment
              </DropdownMenuItem>
            ) : null}

            {showXeroSection ? (
              <>
                <DropdownMenuSeparator />

                {(canExportToXero || canRetryXero) ? (
                  <DropdownMenuItem
                    onSelect={(e) => { e.preventDefault(); void handleExportToXero() }}
                    disabled={isExporting}
                  >
                    {isExporting
                      ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      : <RefreshCw className="mr-2 h-4 w-4" />}
                    {canRetryXero ? "Retry Xero Export" : "Export to Xero"}
                  </DropdownMenuItem>
                ) : null}

                {canViewInXero ? (
                  <DropdownMenuItem
                    onSelect={() =>
                      window.open(
                        `https://go.xero.com/AccountsReceivable/View.aspx?InvoiceID=${xeroStatus!.xero_invoice_id}`,
                        "_blank",
                        "noreferrer"
                      )
                    }
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    View in Xero
                  </DropdownMenuItem>
                ) : null}

                {canVoidAndReissue ? (
                  <DropdownMenuItem onSelect={() => setVoidOpen(true)}>
                    <Scissors className="mr-2 h-4 w-4" />
                    Void &amp; Reissue
                  </DropdownMenuItem>
                ) : null}
              </>
            ) : null}

            {showVoidInvoice ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault()
                    setVoidInvoiceOpen(true)
                  }}
                  className="text-destructive focus:text-destructive"
                >
                  <Ban className="mr-2 h-4 w-4" />
                  Void Invoice
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <RecordPaymentModal
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        invoiceId={invoiceId}
        invoiceNumber={invoice.invoiceNumber}
        totalAmount={invoice.totalAmount ?? null}
        totalPaid={invoice.totalPaid ?? null}
        balanceDue={invoice.balanceDue ?? null}
        onSuccess={async () => {
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: invoiceDetailQueryKey(invoiceId) }),
            queryClient.invalidateQueries({ queryKey: invoicesQueryKey(xeroEnabled) }),
          ])
          await onPaymentSuccess?.()
        }}
      />

      <VoidAndReissueModal
        open={voidOpen}
        onOpenChange={setVoidOpen}
        invoiceId={invoiceId}
        invoiceNumber={invoice.invoiceNumber}
        onSuccess={() => {
          void Promise.all([
            queryClient.invalidateQueries({ queryKey: invoiceDetailQueryKey(invoiceId) }),
            queryClient.invalidateQueries({ queryKey: invoicesQueryKey(xeroEnabled) }),
          ])
        }}
      />

      {showVoidInvoice ? (
        <VoidInvoiceModal
          open={voidInvoiceOpen}
          onOpenChange={setVoidInvoiceOpen}
          invoiceId={invoiceId}
          invoiceNumber={invoice.invoiceNumber}
          totalPaid={invoice.totalPaid ?? 0}
          onSuccess={async () => {
            await Promise.all([
              queryClient.invalidateQueries({ queryKey: invoiceDetailQueryKey(invoiceId) }),
              queryClient.invalidateQueries({ queryKey: invoicesQueryKey(xeroEnabled) }),
            ])
            router.push("/invoices")
            router.refresh()
          }}
        />
      ) : null}
    </>
  )
}
