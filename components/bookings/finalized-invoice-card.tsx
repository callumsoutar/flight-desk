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
    <Card className="border-border/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <IconPlane className="h-4 w-4" />
          Finalized Invoice
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {invoiceLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <IconLoader2 className="h-4 w-4 animate-spin" />
            Loading invoice details...
          </div>
        ) : invoice ? (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-md border p-3">
                <div className="text-xs font-medium uppercase text-muted-foreground">Invoice Number</div>
                <div className="mt-1 font-semibold">{invoice.invoice_number || "Draft"}</div>
              </div>
              <div className="rounded-md border p-3">
                <div className="text-xs font-medium uppercase text-muted-foreground">Total</div>
                <div className="mt-1 font-semibold">${Number(invoice.total_amount || 0).toFixed(2)}</div>
              </div>
              <div className="rounded-md border p-3">
                <div className="text-xs font-medium uppercase text-muted-foreground">Aircraft</div>
                <div className="mt-1 font-semibold">{selectedAircraftLabel}</div>
              </div>
            </div>

            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Rate</TableHead>
                    <TableHead className="text-right">Line Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoiceItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.description}</TableCell>
                      <TableCell className="text-right tabular-nums">{item.quantity.toFixed(2)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        ${(item.rate_inclusive ?? item.unit_price).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        ${Number(item.line_total ?? 0).toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-end">
              <Button asChild variant="outline">
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
