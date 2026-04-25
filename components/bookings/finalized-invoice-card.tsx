"use client"

import Link from "next/link"
import { IconLoader2, IconPlane } from "@tabler/icons-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { InvoiceRow } from "@/lib/types"
import type { InvoiceItem } from "@/lib/types/invoice_items"

type FinalizedInvoiceCardProps = {
  invoiceId: string
  invoiceLoading: boolean
  invoice: InvoiceRow | null
  invoiceItems: InvoiceItem[]
  selectedAircraftLabel: string
}

export function FinalizedInvoiceCard({
  invoiceId,
  invoiceLoading,
  invoice,
  invoiceItems,
  selectedAircraftLabel,
}: FinalizedInvoiceCardProps) {
  return (
    <Card className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-slate-900">
          <IconPlane className="h-4 w-4" />
          Finalized Invoice
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {invoiceLoading ? (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <IconLoader2 className="h-4 w-4 animate-spin" />
            Loading invoice details...
          </div>
        ) : invoice ? (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-md border border-slate-200 bg-white p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-600">Invoice Number</div>
                <div className="mt-1 font-semibold text-slate-900">{invoice.invoice_number || "Draft"}</div>
              </div>
              <div className="rounded-md border border-slate-200 bg-white p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-600">Total</div>
                <div className="mt-1 font-semibold text-slate-900">${Number(invoice.total_amount || 0).toFixed(2)}</div>
              </div>
              <div className="rounded-md border border-slate-200 bg-white p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-600">Aircraft</div>
                <div className="mt-1 font-semibold text-slate-900">{selectedAircraftLabel}</div>
              </div>
            </div>

            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-200 bg-slate-50/50 hover:bg-slate-50/50">
                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-600">Description</TableHead>
                    <TableHead className="text-right text-xs font-semibold uppercase tracking-wide text-slate-600">Qty</TableHead>
                    <TableHead className="text-right text-xs font-semibold uppercase tracking-wide text-slate-600">Rate</TableHead>
                    <TableHead className="text-right text-xs font-semibold uppercase tracking-wide text-slate-600">Line Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoiceItems.map((item) => (
                    <TableRow key={item.id} className="hover:bg-slate-50/50">
                      <TableCell className="font-medium text-slate-900">{item.description}</TableCell>
                      <TableCell className="text-right tabular-nums text-slate-900">{item.quantity.toFixed(2)}</TableCell>
                      <TableCell className="text-right tabular-nums text-slate-900">
                        ${(item.rate_inclusive ?? item.unit_price).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums text-slate-900">
                        ${Number(item.line_total ?? 0).toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-end">
              <Button
                asChild
                variant="outline"
                className="border-slate-200 font-semibold text-slate-700 hover:bg-slate-50"
              >
                <Link href={`/invoices/${invoiceId}`}>View Full Invoice</Link>
              </Button>
            </div>
          </div>
        ) : (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            Failed to load invoice details.
          </div>
        )}
      </CardContent>
    </Card>
  )
}
