"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  Calendar,
  ChevronDown,
  Download,
  Loader2,
  Mail,
  PlusCircle,
  Printer,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import InvoiceReportPDF from "@/components/invoices/invoice-report-pdf"
import RecordPaymentModal from "@/components/invoices/record-payment-modal"
import type {
  InvoiceDocumentData,
  InvoiceDocumentItem,
  InvoicingSettings,
} from "@/components/invoices/invoice-document-view"

export type InvoiceViewActionsProps = {
  invoiceId: string
  invoice: InvoiceDocumentData
  items: InvoiceDocumentItem[]
  settings: InvoicingSettings
  status?: string | null
  billToEmail?: string | null
  bookingId?: string | null
  onPaymentSuccess?: () => void
}

export default function InvoiceViewActions({
  invoiceId,
  invoice,
  items,
  settings,
  status,
  billToEmail,
  bookingId,
  onPaymentSuccess,
}: InvoiceViewActionsProps) {
  const router = useRouter()
  const [paymentOpen, setPaymentOpen] = React.useState(false)
  const [isDownloading, setIsDownloading] = React.useState(false)
  const [isPrinting, setIsPrinting] = React.useState(false)

  const canEmail = Boolean(billToEmail)
  const hasBalanceDue = typeof invoice.balanceDue === "number" ? invoice.balanceDue > 0 : true
  const canRecordPayment = (status === "pending" || status === "overdue") && hasBalanceDue

  const handleDownloadPDF = async () => {
    setIsDownloading(true)
    try {
      const { pdf } = await import("@react-pdf/renderer")
      const blob = await pdf(
        <InvoiceReportPDF invoice={invoice} items={items} settings={settings} />
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

  const emailInvoice = () => {
    if (!billToEmail) return
    const subject = encodeURIComponent(`Invoice ${invoice.invoiceNumber || ""}`.trim())
    const body = encodeURIComponent(
      `Hi,\n\nPlease find your invoice ${invoice.invoiceNumber || ""}.\n\nBalance due: $${typeof invoice.balanceDue === "number" ? invoice.balanceDue.toFixed(2) : "0.00"}\n\nThanks,\n`
    )
    window.location.href = `mailto:${billToEmail}?subject=${subject}&body=${body}`
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
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onSelect={(event) => {
              event.preventDefault()
              emailInvoice()
            }} disabled={!canEmail}>
              <Mail className="mr-2 h-4 w-4" />
              Email Invoice
            </DropdownMenuItem>

            <DropdownMenuItem onSelect={(event) => {
              event.preventDefault()
              void handleDownloadPDF()
            }} disabled={isDownloading}>
              {isDownloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              Download PDF
            </DropdownMenuItem>

            <DropdownMenuItem onSelect={(event) => {
              event.preventDefault()
              void handlePrint()
            }} disabled={isPrinting}>
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
        onSuccess={onPaymentSuccess}
      />
    </>
  )
}
