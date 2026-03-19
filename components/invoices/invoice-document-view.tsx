"use client"

import * as React from "react"

import { useTimezone } from "@/contexts/timezone-context"
import type { InvoicingSettings } from "@/lib/invoices/invoicing-settings"
import { formatDate } from "@/lib/utils/date-format"

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
  const { timeZone } = useTimezone()
  const taxPercent = Math.round((invoice.taxRate ?? 0) * 100)

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
      <div className="p-10">

        {/* ── Header + Addresses ─────────────────────────────────────── */}
        <div className="flex items-start justify-between mb-10 pb-10 border-b border-gray-100">
          {/* Left: title + from + bill to */}
          <div className="flex-1 pr-10">
            <h1 className="text-3xl font-bold tracking-tight text-gray-900 mb-8">INVOICE</h1>
            <div className="grid grid-cols-2 gap-8">
              <div>
                <div className="text-xs uppercase tracking-wider text-gray-400 mb-2">From</div>
                <div className="font-semibold text-gray-900">{settings.schoolName || "Flight School"}</div>
                {settings.billingAddress && (
                  <p className="mt-1 text-sm text-gray-500 whitespace-pre-line">{settings.billingAddress}</p>
                )}
                {settings.gstNumber && (
                  <p className="text-sm text-gray-500">GST: {settings.gstNumber}</p>
                )}
                {settings.contactPhone && (
                  <p className="text-sm text-gray-500">{settings.contactPhone}</p>
                )}
                {settings.contactEmail && (
                  <p className="text-sm text-gray-500">{settings.contactEmail}</p>
                )}
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider text-gray-400 mb-2">Bill To</div>
                <div className="font-semibold text-gray-900">{invoice.billToName}</div>
              </div>
            </div>
          </div>

          {/* Right: invoice meta */}
          <div className="text-right text-sm shrink-0">
            <div className="text-xs uppercase tracking-wider text-gray-400 mb-1">Invoice Number</div>
            <div className="font-semibold text-gray-900 text-base">{invoice.invoiceNumber || "—"}</div>
            <div className="mt-3 text-xs uppercase tracking-wider text-gray-400 mb-1">Invoice Date</div>
            <div className="text-gray-700">{formatDate(invoice.issueDate, timeZone, "medium") || "—"}</div>
            <div className="mt-3 text-xs uppercase tracking-wider text-gray-400 mb-1">Due Date</div>
            <div className="text-gray-700">{formatDate(invoice.dueDate, timeZone, "medium") || "—"}</div>
          </div>
        </div>

        {/* ── Line Items ─────────────────────────────────────────────── */}
        <div className="overflow-hidden rounded-lg border border-gray-100">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-400">Description</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-400">Qty</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-400">Rate (incl. tax)</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-400">Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.length > 0 ? (
                items.map((item, idx) => (
                  <tr
                    key={item.id}
                    className={idx < items.length - 1 ? "border-b border-gray-100" : ""}
                  >
                    <td className="px-4 py-3 text-gray-700">{item.description}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{item.quantity}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{formatMoney(item.rate_inclusive ?? item.unit_price)}</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">{formatMoney(item.line_total ?? 0)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-4 py-8 text-center text-gray-400" colSpan={4}>
                    No line items.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ── Totals ─────────────────────────────────────────────────── */}
        <div className="mt-6 flex justify-end">
          <div className="w-72 text-sm">
            <div className="flex justify-between py-1.5">
              <span className="text-gray-500">Subtotal (excl. tax)</span>
              <span className="text-gray-700 tabular-nums">{formatMoney(invoice.subtotal)}</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-gray-500">Tax{taxPercent > 0 ? ` (${taxPercent}%)` : ""}</span>
              <span className="text-gray-700 tabular-nums">{formatMoney(invoice.taxTotal)}</span>
            </div>
            <div className="flex justify-between py-2 mt-1 border-t border-gray-200">
              <span className="font-semibold text-gray-900 text-base">Total</span>
              <span className="font-semibold text-gray-900 text-base tabular-nums">{formatMoney(invoice.totalAmount)}</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-gray-500">Amount Paid</span>
              <span className="text-gray-700 tabular-nums">{formatMoney(invoice.totalPaid)}</span>
            </div>
            <div className="flex justify-between py-2 border-t border-gray-200 mt-1">
              <span className="font-semibold text-gray-900">Balance Due</span>
              <span className="font-semibold text-gray-900 tabular-nums">{formatMoney(invoice.balanceDue)}</span>
            </div>
          </div>
        </div>

        {/* ── Footer ─────────────────────────────────────────────────── */}
        {(settings.invoiceFooter || settings.paymentTerms) && (
          <div className="mt-10 pt-6 border-t border-gray-100 text-center space-y-1">
            {settings.invoiceFooter && (
              <p className="text-sm text-gray-500">{settings.invoiceFooter}</p>
            )}
            {settings.paymentTerms && (
              <p className="text-xs text-gray-400">{settings.paymentTerms}</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
