"use client"

import * as React from "react"

import { Card } from "@/components/ui/card"
import type { InvoicingSettings } from "@/lib/invoices/invoicing-settings"

export type { InvoicingSettings } from "@/lib/invoices/invoicing-settings"

export type InvoiceDocumentData = {
  invoiceNumber: string
  issueDate: string | null
  dueDate: string | null
  taxRate: number
  subtotal: number
  taxTotal: number
  totalAmount: number
  totalPaid: number
  balanceDue: number
  billToName: string
}

export type InvoiceDocumentItem = {
  id: string
  description: string
  quantity: number
  unit_price: number
  rate_inclusive: number | null
  line_total: number | null
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function formatMoney(value: number | null | undefined) {
  return `$${Number(value || 0).toFixed(2)}`
}

export default function InvoiceDocumentView({
  settings,
  invoice,
  items,
}: {
  settings: InvoicingSettings
  invoice: InvoiceDocumentData
  items: InvoiceDocumentItem[]
}) {
  return (
    <Card className="shadow-sm ring-1 ring-border/40">
      <div className="p-6">
        <div className="mb-6 flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">{settings.schoolName || "Flight School"}</h2>
            <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{settings.billingAddress || ""}</p>
            {settings.contactEmail ? <p className="text-sm text-muted-foreground">{settings.contactEmail}</p> : null}
            {settings.contactPhone ? <p className="text-sm text-muted-foreground">{settings.contactPhone}</p> : null}
            {settings.gstNumber ? <p className="text-sm text-muted-foreground">GST: {settings.gstNumber}</p> : null}
          </div>

          <div className="rounded-md border bg-muted/20 px-4 py-3 text-sm">
            <div className="font-semibold">Invoice {invoice.invoiceNumber}</div>
            <div className="mt-1 text-muted-foreground">Issued: {formatDate(invoice.issueDate)}</div>
            <div className="text-muted-foreground">Due: {formatDate(invoice.dueDate)}</div>
          </div>
        </div>

        <div className="mb-6 rounded-md border bg-background px-4 py-3 text-sm">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Bill To</div>
          <div className="mt-1 font-medium">{invoice.billToName}</div>
        </div>

        <div className="overflow-hidden rounded-xl border bg-background">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-muted/40">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Item</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">Qty</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">Rate</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.length > 0 ? (
                items.map((item) => (
                  <tr key={item.id} className="border-t">
                    <td className="px-4 py-3">{item.description}</td>
                    <td className="px-4 py-3 text-right">{item.quantity}</td>
                    <td className="px-4 py-3 text-right">{formatMoney(item.rate_inclusive ?? item.unit_price)}</td>
                    <td className="px-4 py-3 text-right font-medium">{formatMoney(item.line_total ?? 0)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-4 py-8 text-center text-muted-foreground" colSpan={4}>
                    No line items.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-6 ml-auto w-full max-w-sm space-y-2.5 text-sm">
          <div className="flex items-center justify-between gap-8">
            <div className="text-muted-foreground">Subtotal</div>
            <div className="font-medium tabular-nums">{formatMoney(invoice.subtotal)}</div>
          </div>
          <div className="flex items-center justify-between gap-8">
            <div className="text-muted-foreground">Tax</div>
            <div className="font-medium tabular-nums">{formatMoney(invoice.taxTotal)}</div>
          </div>
          <div className="border-t pt-2.5 flex items-center justify-between gap-8">
            <div className="text-base font-semibold">Total</div>
            <div className="text-lg font-semibold tabular-nums">{formatMoney(invoice.totalAmount)}</div>
          </div>
          <div className="flex items-center justify-between gap-8">
            <div className="text-muted-foreground">Paid</div>
            <div className="font-medium tabular-nums">{formatMoney(invoice.totalPaid)}</div>
          </div>
          <div className="flex items-center justify-between gap-8">
            <div className="text-muted-foreground">Balance Due</div>
            <div className="font-semibold tabular-nums">{formatMoney(invoice.balanceDue)}</div>
          </div>
        </div>

        {settings.paymentTerms ? (
          <p className="mt-6 text-sm text-muted-foreground">{settings.paymentTerms}</p>
        ) : null}
        {settings.invoiceFooter ? (
          <p className="mt-2 text-sm text-muted-foreground">{settings.invoiceFooter}</p>
        ) : null}
      </div>
    </Card>
  )
}
