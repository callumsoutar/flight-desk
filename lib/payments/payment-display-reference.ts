import type {
  InvoicePaymentDetail,
  MemberCreditPaymentDetail,
  PaymentDetailResult,
} from "@/lib/payments/fetch-payment-detail"
import { stableReceiptStyleNumberFromUuid } from "@/lib/payments/stable-receipt-style-number"

export function invoicePaymentDisplayReference(detail: InvoicePaymentDetail): {
  label: string
  value: string
} {
  const n =
    detail.receipt_number != null && Number.isFinite(detail.receipt_number)
      ? detail.receipt_number
      : stableReceiptStyleNumberFromUuid(detail.id)
  return { label: "Receipt number", value: `#${n}` }
}

export function memberCreditDisplayReference(detail: MemberCreditPaymentDetail): {
  label: string
  value: string
} {
  const n =
    detail.receipt_number != null && Number.isFinite(detail.receipt_number)
      ? detail.receipt_number
      : stableReceiptStyleNumberFromUuid(detail.id)
  return { label: "Receipt number", value: `#${n}` }
}

/** Browser tab / main `<h1>` title. */
export function paymentPageHeading(detail: PaymentDetailResult): string {
  const r =
    detail.kind === "invoice_payment"
      ? invoicePaymentDisplayReference(detail)
      : memberCreditDisplayReference(detail)
  return `Receipt ${r.value}`
}
