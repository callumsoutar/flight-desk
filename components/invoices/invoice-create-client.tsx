"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Check, Pencil, Plus, Trash2, X } from "lucide-react"
import { toast } from "sonner"

import { createAndApproveInvoiceAction, createInvoiceDraftAction } from "@/app/invoices/new/actions"
import InvoiceActionsToolbar from "@/components/invoices/invoice-actions-toolbar"
import ChargeableSearchDropdown from "@/components/invoices/chargeable-search-dropdown"
import MemberSelect, { type UserResult } from "@/components/invoices/member-select"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import {
  calculateInvoiceTotals,
  calculateItemAmounts,
  roundToTwoDecimals,
} from "@/lib/invoices/invoice-calculations"
import type {
  InvoiceCreateActionInput,
  InvoiceCreateChargeable,
  InvoiceCreateMember,
} from "@/lib/types/invoice-create"

type DraftLineItem = {
  id: string
  chargeableId: string
  quantity: number
  rateInclusive: number
}

function formatInputDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function dateInputToUtcIso(value: string): string | null {
  const [yearRaw, monthRaw, dayRaw] = value.split("-")
  const year = Number(yearRaw)
  const month = Number(monthRaw)
  const day = Number(dayRaw)

  if (!year || !month || !day) return null

  const date = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0))
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

function exclusiveToInclusive(unitPrice: number, taxRate: number): number {
  if (taxRate <= 0) return roundToTwoDecimals(unitPrice)
  return roundToTwoDecimals(unitPrice * (1 + taxRate))
}

function inclusiveToExclusive(rateInclusive: number, taxRate: number): number {
  if (taxRate <= 0) return roundToTwoDecimals(rateInclusive)
  return roundToTwoDecimals(rateInclusive / (1 + taxRate))
}

export function InvoiceCreateClient({
  members,
  chargeables,
  defaultTaxRate,
  defaultUserId = null,
}: {
  members: InvoiceCreateMember[]
  chargeables: InvoiceCreateChargeable[]
  defaultTaxRate: number
  defaultUserId?: string | null
}) {
  const router = useRouter()
  const [isPending, startTransition] = React.useTransition()
  const [activeAction, setActiveAction] = React.useState<"draft" | "approve" | null>(null)

  const today = React.useMemo(() => new Date(), [])
  const [issueDate, setIssueDate] = React.useState(() => formatInputDate(today))
  const [dueDate, setDueDate] = React.useState(() => {
    const date = new Date(today)
    date.setDate(date.getDate() + 7)
    return formatInputDate(date)
  })
  const [reference, setReference] = React.useState("")
  const [notes, setNotes] = React.useState("")

  const [items, setItems] = React.useState<DraftLineItem[]>([])
  const [newChargeableId, setNewChargeableId] = React.useState("")
  const [newQuantity, setNewQuantity] = React.useState(1)
  const [newRateInclusive, setNewRateInclusive] = React.useState(0)
  const [editingItemId, setEditingItemId] = React.useState<string | null>(null)
  const [editQuantity, setEditQuantity] = React.useState(1)
  const [editRateInclusive, setEditRateInclusive] = React.useState(0)

  const [selectedMember, setSelectedMember] = React.useState<UserResult | null>(() => {
    if (!defaultUserId) return null
    const existing = members.find((member) => member.id === defaultUserId)
    return existing
      ? {
          id: existing.id,
          first_name: existing.first_name,
          last_name: existing.last_name,
          email: existing.email,
        }
      : null
  })

  const chargeableMap = React.useMemo(
    () => new Map(chargeables.map((chargeable) => [chargeable.id, chargeable])),
    [chargeables]
  )

  const previewRows = React.useMemo(() => {
    return items.map((item) => {
      const chargeable = chargeableMap.get(item.chargeableId)
      const taxRate = chargeable?.is_taxable ? defaultTaxRate : 0
      const unitPrice = inclusiveToExclusive(item.rateInclusive, taxRate)

      try {
        const calculated = calculateItemAmounts({
          quantity: item.quantity,
          unitPrice,
          taxRate,
        })

        return {
          ...item,
          chargeable,
          unitPrice,
          taxRate,
          amount: calculated.amount,
          taxAmount: calculated.taxAmount,
          rateInclusive: calculated.rateInclusive,
          lineTotal: calculated.lineTotal,
        }
      } catch {
        return {
          ...item,
          chargeable,
          unitPrice,
          taxRate,
          amount: 0,
          taxAmount: 0,
          rateInclusive: 0,
          lineTotal: 0,
        }
      }
    })
  }, [chargeableMap, defaultTaxRate, items])

  const totals = React.useMemo(
    () =>
      calculateInvoiceTotals(
        previewRows.map((row) => ({
          quantity: row.quantity,
          unit_price: row.unitPrice,
          tax_rate: row.taxRate,
          amount: row.amount,
          tax_amount: row.taxAmount,
          deleted_at: null,
        }))
      ),
    [previewRows]
  )

  const canAddLineItem =
    !isPending && !!newChargeableId && newQuantity > 0 && Number.isFinite(newRateInclusive) && newRateInclusive >= 0

  const addLineItem = () => {
    if (!newChargeableId) {
      toast.error("Select a chargeable item")
      return
    }
    if (newQuantity <= 0) {
      toast.error("Quantity must be greater than zero")
      return
    }
    if (newRateInclusive < 0) {
      toast.error("Unit price cannot be negative")
      return
    }

    setItems((prev) => [
      ...prev,
      {
        id: `${newChargeableId}-${Date.now()}`,
        chargeableId: newChargeableId,
        quantity: roundToTwoDecimals(newQuantity),
        rateInclusive: roundToTwoDecimals(newRateInclusive),
      },
    ])
    setNewChargeableId("")
    setNewQuantity(1)
    setNewRateInclusive(0)
  }

  const removeLineItem = (id: string) => {
    if (editingItemId === id) {
      setEditingItemId(null)
    }
    setItems((prev) => prev.filter((item) => item.id !== id))
  }

  const updateLineItem = (id: string, patch: Partial<Pick<DraftLineItem, "quantity" | "rateInclusive">>) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              ...patch,
            }
          : item
      )
    )
  }

  const startEditLineItem = (row: (typeof previewRows)[number]) => {
    setEditingItemId(row.id)
    setEditQuantity(row.quantity)
    setEditRateInclusive(row.rateInclusive)
  }

  const cancelEditLineItem = () => {
    setEditingItemId(null)
  }

  const saveEditLineItem = (rowId: string) => {
    if (editQuantity <= 0) {
      toast.error("Quantity must be greater than zero")
      return
    }
    if (editRateInclusive < 0) {
      toast.error("Rate cannot be negative")
      return
    }

    updateLineItem(rowId, {
      quantity: roundToTwoDecimals(editQuantity),
      rateInclusive: roundToTwoDecimals(editRateInclusive),
    })
    setEditingItemId(null)
  }

  const submit = (mode: "draft" | "approve") => {
    if (!selectedMember) {
      toast.error("Please select a member")
      return
    }
    if (items.length === 0) {
      toast.error("Please add at least one line item")
      return
    }
    if (editingItemId) {
      toast.error("Please save or cancel your current line item edit")
      return
    }

    const issueDateIso = dateInputToUtcIso(issueDate)
    if (!issueDateIso) {
      toast.error("Issue date is invalid")
      return
    }

    const dueDateIso = dueDate ? dateInputToUtcIso(dueDate) : null
    if (dueDate && !dueDateIso) {
      toast.error("Due date is invalid")
      return
    }

    const payload: InvoiceCreateActionInput = {
      userId: selectedMember.id,
      issueDate: issueDateIso,
      dueDate: dueDateIso,
      reference: reference.trim() || null,
      notes: notes.trim() || null,
      items: previewRows.map((item) => ({
        chargeableId: item.chargeableId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      })),
    }

    setActiveAction(mode)
    startTransition(async () => {
      try {
        const result =
          mode === "approve"
            ? await createAndApproveInvoiceAction(payload)
            : await createInvoiceDraftAction(payload)

        if (!result.ok) {
          toast.error(result.error)
          setActiveAction(null)
          return
        }

        toast.success(mode === "approve" ? "Invoice approved" : "Draft invoice saved")
        router.replace(`/invoices/${result.invoiceId}`)
      } catch {
        toast.error("Failed to create invoice")
        setActiveAction(null)
      }
    })
  }

  return (
    <div className="flex flex-1 flex-col bg-muted/20">
      <div className="mx-auto w-full max-w-[920px] px-4 py-4 sm:px-6 lg:px-10 lg:py-8">
        <div className="sticky top-0 z-20 -mx-4 border-b bg-background/95 px-4 py-2.5 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/70 sm:-mx-6 sm:px-6 sm:py-4 lg:-mx-10 lg:px-10">
          <InvoiceActionsToolbar
            mode="new"
            member={selectedMember}
            onSave={() => submit("draft")}
            onApprove={() => submit("approve")}
            saveDisabled={isPending || !selectedMember || items.length === 0}
            approveDisabled={isPending || !selectedMember || items.length === 0}
            saveLoading={activeAction === "draft"}
            approveLoading={activeAction === "approve"}
            showApprove
          />
        </div>

        <div className="mt-6 space-y-6">
          <Card className="shadow-sm ring-1 ring-border/40">
            <div className="space-y-4 p-6">
              <div>
                <div className="text-sm font-medium text-foreground/80">Invoice</div>
                <div className="mt-1 text-2xl font-semibold tracking-tight">New invoice</div>
                <div className="mt-1 text-sm text-muted-foreground">
                  Create a draft invoice, then approve when ready.
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground/80">Bill to</label>
                  <MemberSelect
                    members={members}
                    value={selectedMember}
                    onSelect={setSelectedMember}
                    disabled={isPending}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground/80">Reference</label>
                  <Input
                    value={reference}
                    onChange={(event) => setReference(event.target.value)}
                    placeholder="Optional reference"
                    disabled={isPending}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground/80">Issue date</label>
                  <Input
                    type="date"
                    value={issueDate}
                    onChange={(event) => setIssueDate(event.target.value)}
                    disabled={isPending}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground/80">Due date</label>
                  <Input
                    type="date"
                    value={dueDate}
                    onChange={(event) => setDueDate(event.target.value)}
                    disabled={isPending}
                  />
                </div>
              </div>
            </div>
          </Card>

          <Card className="shadow-sm ring-1 ring-border/40">
            <div className="space-y-5 p-6">
              <div className="flex items-center justify-between gap-3">
                <div className="text-base font-semibold">Line items</div>
                <div className="text-xs text-muted-foreground tabular-nums">
                  {previewRows.length} {previewRows.length === 1 ? "item" : "items"}
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border border-border/70 bg-background shadow-sm">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/35 hover:bg-muted/35">
                      <TableHead className="h-10 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Item
                      </TableHead>
                      <TableHead className="h-10 w-[110px] text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Qty
                      </TableHead>
                      <TableHead className="h-10 w-[150px] text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Rate (incl.)
                      </TableHead>
                      <TableHead className="h-10 w-[140px] text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Tax
                      </TableHead>
                      <TableHead className="h-10 w-[150px] text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Amount
                      </TableHead>
                      <TableHead className="w-[80px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewRows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                          No line items yet.
                        </TableCell>
                      </TableRow>
                    ) : (
                      previewRows.map((row) => (
                        <TableRow key={row.id} className="hover:bg-muted/20">
                          <TableCell>
                            <div className="font-medium">{row.chargeable?.name ?? "Unknown item"}</div>
                          </TableCell>
                          <TableCell className="text-right">
                            {editingItemId === row.id ? (
                              <div className="ml-auto w-[92px]">
                                <Input
                                  type="number"
                                  min={0.01}
                                  step={0.01}
                                  value={editQuantity}
                                  onChange={(event) =>
                                    setEditQuantity(roundToTwoDecimals(Number(event.target.value) || 0))
                                  }
                                  disabled={isPending}
                                  className="h-8 border-border/60 bg-muted/20 text-right font-medium tabular-nums shadow-none focus-visible:ring-1"
                                />
                              </div>
                            ) : (
                              <span className="font-medium tabular-nums">{row.quantity.toFixed(2)}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {editingItemId === row.id ? (
                              <div className="relative ml-auto w-[126px]">
                                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                                  $
                                </span>
                                <Input
                                  type="number"
                                  min={0}
                                  step={0.01}
                                  value={editRateInclusive}
                                  onChange={(event) =>
                                    setEditRateInclusive(roundToTwoDecimals(Number(event.target.value) || 0))
                                  }
                                  disabled={isPending}
                                  className="h-8 border-border/60 bg-muted/20 pl-6 text-right font-medium tabular-nums shadow-none focus-visible:ring-1"
                                />
                              </div>
                            ) : (
                              <span className="font-medium tabular-nums">${row.rateInclusive.toFixed(2)}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-medium tabular-nums">
                            ${row.taxAmount.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right font-semibold tabular-nums">
                            ${row.lineTotal.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              {editingItemId === row.id ? (
                                <>
                                  <Button
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => saveEditLineItem(row.id)}
                                    disabled={isPending}
                                    className="h-8 w-8 text-emerald-700 hover:bg-emerald-500/10 hover:text-emerald-700"
                                  >
                                    <Check className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    onClick={cancelEditLineItem}
                                    disabled={isPending}
                                    className="h-8 w-8 text-muted-foreground hover:bg-muted/50"
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </>
                              ) : (
                                <>
                                  <Button
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => startEditLineItem(row)}
                                    disabled={isPending || (editingItemId !== null && editingItemId !== row.id)}
                                    className="h-8 w-8 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => removeLineItem(row.id)}
                                    disabled={isPending || (editingItemId !== null && editingItemId !== row.id)}
                                    className="h-8 w-8 text-red-600/90 hover:bg-red-500/10 hover:text-red-600"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>

                <div className="border-t bg-muted/[0.08] px-3 py-3 sm:px-4 sm:py-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Add line item
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      Select a chargeable, then set qty and inclusive rate
                    </span>
                  </div>
                  <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_110px_140px_auto]">
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-muted-foreground">Chargeable</label>
                      <ChargeableSearchDropdown
                        chargeables={chargeables}
                        value={newChargeableId}
                        taxRate={defaultTaxRate}
                        disabled={isPending}
                        onSelect={(chargeable) => {
                          setNewChargeableId(chargeable?.id ?? "")
                          const taxRate = chargeable?.is_taxable ? defaultTaxRate : 0
                          setNewRateInclusive(exclusiveToInclusive(chargeable?.rate ?? 0, taxRate))
                        }}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-muted-foreground">Qty</label>
                      <Input
                        type="number"
                        min={0.01}
                        step={0.01}
                        value={newQuantity}
                        onChange={(event) => setNewQuantity(Number(event.target.value) || 0)}
                        placeholder="Qty"
                        disabled={isPending}
                        className="h-10 text-right tabular-nums"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-muted-foreground">Rate (incl.)</label>
                      <div className="relative">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                          $
                        </span>
                        <Input
                          type="number"
                          min={0}
                          step={0.01}
                          value={newRateInclusive}
                          onChange={(event) => setNewRateInclusive(Number(event.target.value) || 0)}
                          placeholder="Rate (incl.)"
                          disabled={isPending}
                          className="h-10 pl-6 text-right tabular-nums"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-transparent">Add</label>
                      <Button type="button" onClick={addLineItem} disabled={!canAddLineItem} className="h-10 w-full">
                        <Plus className="mr-1 h-4 w-4" />
                        Add item
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="ml-auto w-full max-w-sm space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Subtotal (excl. tax)</span>
                  <span className="tabular-nums">${totals.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Tax</span>
                  <span className="tabular-nums">${totals.taxTotal.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between border-t pt-2 text-base font-semibold">
                  <span>Total</span>
                  <span className="tabular-nums">${totals.totalAmount.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </Card>

          <Card className="shadow-sm ring-1 ring-border/40">
            <div className="space-y-2 p-6">
              <div className="text-base font-semibold">Notes</div>
              <div className="text-sm text-muted-foreground">Optional internal notes for this invoice.</div>
              <Textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Add notes..."
                disabled={isPending}
                rows={5}
              />
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
