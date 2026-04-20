"use client"

import * as React from "react"
import {
  IconBan,
  IconCalendarPlus,
  IconCash,
  IconCircleCheck,
  IconCoin,
  IconFileInvoice,
  IconPencil,
  IconPlus,
  IconReceipt2,
  IconTag,
  IconTrash,
} from "@tabler/icons-react"

import { useTimezone } from "@/contexts/timezone-context"
import type {
  InvoiceAuditLog,
  InvoiceAuditLookupMaps,
} from "@/lib/invoices/fetch-invoice-audit-logs"
import { formatDateTime } from "@/lib/utils/date-format"
import { cn } from "@/lib/utils"

function formatUser(user: {
  first_name: string | null
  last_name: string | null
  email: string | null
}): string {
  return [user.first_name, user.last_name].filter(Boolean).join(" ") || user.email || "Unknown"
}

const COLORS = {
  emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  green: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  red: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  blue: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  slate: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  indigo: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
}

function formatMoney(value: unknown, currency: string = "$"): string | null {
  if (value === null || value === undefined) return null
  const num = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(num)) return null
  return `${currency}${num.toFixed(2)}`
}

function asString(value: unknown): string | null {
  if (value === null || value === undefined) return null
  return String(value)
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

type AuditChange = {
  label: string
  oldValue?: string
  newValue?: string
  icon: React.ReactNode
  colorClass: string
}

type AuditEntry = {
  log: InvoiceAuditLog
  isCreate: boolean
  changes: AuditChange[]
}

function buildInvoiceChanges(log: InvoiceAuditLog): AuditChange[] {
  const newData = isJsonObject(log.new_data) ? log.new_data : null
  const oldData = isJsonObject(log.old_data) ? log.old_data : null

  if (log.action === "DELETE") {
    return [
      {
        label: "Invoice Deleted",
        icon: <IconTrash className="h-4 w-4" />,
        colorClass: COLORS.red,
      },
    ]
  }

  if (log.action !== "UPDATE" || !newData || !oldData) return []

  const changes: AuditChange[] = []
  const newStatus = asString(newData.status)
  const oldStatus = asString(oldData.status)

  if (newStatus !== oldStatus && newStatus) {
    switch (newStatus) {
      case "authorised":
        changes.push({
          label: "Invoice Approved",
          icon: <IconCircleCheck className="h-4 w-4" />,
          colorClass: COLORS.green,
        })
        break
      case "paid":
        changes.push({
          label: "Invoice Paid",
          icon: <IconCircleCheck className="h-4 w-4" />,
          colorClass: COLORS.green,
        })
        break
      case "voided":
        changes.push({
          label: "Invoice Voided",
          icon: <IconBan className="h-4 w-4" />,
          colorClass: COLORS.red,
        })
        break
      case "draft":
        changes.push({
          label: "Reverted to Draft",
          icon: <IconPencil className="h-4 w-4" />,
          colorClass: COLORS.slate,
        })
        break
      default:
        changes.push({
          label: "Status",
          oldValue: oldStatus ?? "—",
          newValue: newStatus,
          icon: <IconTag className="h-4 w-4" />,
          colorClass: COLORS.amber,
        })
    }
  }

  // Only surface meaningful manual edits. We intentionally skip auto-derived
  // financial fields (subtotal, tax_total, total_amount, total_paid,
  // balance_due) because they change as a side effect of line items / payments
  // and would otherwise spam the timeline.
  if (newData.due_date !== oldData.due_date) {
    changes.push({
      label: "Due Date",
      oldValue: asString(oldData.due_date) ?? "—",
      newValue: asString(newData.due_date) ?? "—",
      icon: <IconTag className="h-4 w-4" />,
      colorClass: COLORS.amber,
    })
  }
  if (newData.issue_date !== oldData.issue_date) {
    changes.push({
      label: "Issue Date",
      oldValue: asString(oldData.issue_date) ?? "—",
      newValue: asString(newData.issue_date) ?? "—",
      icon: <IconTag className="h-4 w-4" />,
      colorClass: COLORS.amber,
    })
  }
  if (newData.tax_rate !== oldData.tax_rate) {
    changes.push({
      label: "Tax Rate",
      oldValue: asString(oldData.tax_rate) ?? "—",
      newValue: asString(newData.tax_rate) ?? "—",
      icon: <IconTag className="h-4 w-4" />,
      colorClass: COLORS.amber,
    })
  }

  return changes
}

function buildInvoiceItemChanges(log: InvoiceAuditLog, currency: string): AuditChange[] {
  const newData = isJsonObject(log.new_data) ? log.new_data : null
  const oldData = isJsonObject(log.old_data) ? log.old_data : null

  if (log.action === "INSERT" && newData) {
    const desc = asString(newData.description) ?? "Line item"
    const amount = formatMoney(newData.line_total ?? newData.amount, currency)
    return [
      {
        label: "Line Item Added",
        newValue: amount ? `${desc} (${amount})` : desc,
        icon: <IconPlus className="h-4 w-4" />,
        colorClass: COLORS.indigo,
      },
    ]
  }

  if (log.action === "DELETE" && oldData) {
    const desc = asString(oldData.description) ?? "Line item"
    return [
      {
        label: "Line Item Removed",
        newValue: desc,
        icon: <IconTrash className="h-4 w-4" />,
        colorClass: COLORS.red,
      },
    ]
  }

  if (log.action === "UPDATE" && newData && oldData) {
    // Soft delete (deleted_at flipped) → show as removal.
    if (!oldData.deleted_at && newData.deleted_at) {
      const desc = asString(newData.description) ?? "Line item"
      return [
        {
          label: "Line Item Removed",
          newValue: desc,
          icon: <IconTrash className="h-4 w-4" />,
          colorClass: COLORS.red,
        },
      ]
    }

    const changes: AuditChange[] = []

    if (newData.description !== oldData.description) {
      changes.push({
        label: "Item Description",
        oldValue: asString(oldData.description) ?? "—",
        newValue: asString(newData.description) ?? "—",
        icon: <IconReceipt2 className="h-4 w-4" />,
        colorClass: COLORS.amber,
      })
    }
    if (newData.quantity !== oldData.quantity) {
      changes.push({
        label: "Quantity",
        oldValue: asString(oldData.quantity) ?? "—",
        newValue: asString(newData.quantity) ?? "—",
        icon: <IconReceipt2 className="h-4 w-4" />,
        colorClass: COLORS.amber,
      })
    }
    if (newData.unit_price !== oldData.unit_price) {
      changes.push({
        label: "Unit Price",
        oldValue: formatMoney(oldData.unit_price, currency) ?? "—",
        newValue: formatMoney(newData.unit_price, currency) ?? "—",
        icon: <IconReceipt2 className="h-4 w-4" />,
        colorClass: COLORS.amber,
      })
    }
    if (newData.line_total !== oldData.line_total) {
      changes.push({
        label: "Line Total",
        oldValue: formatMoney(oldData.line_total, currency) ?? "—",
        newValue: formatMoney(newData.line_total, currency) ?? "—",
        icon: <IconReceipt2 className="h-4 w-4" />,
        colorClass: COLORS.amber,
      })
    }

    return changes
  }

  return []
}

function buildInvoicePaymentChanges(log: InvoiceAuditLog, currency: string): AuditChange[] {
  const newData = isJsonObject(log.new_data) ? log.new_data : null
  const oldData = isJsonObject(log.old_data) ? log.old_data : null

  if (log.action === "INSERT" && newData) {
    const amount = formatMoney(newData.amount, currency)
    const method = asString(newData.payment_method) ?? asString(newData.method)
    const ref = asString(newData.reference) ?? asString(newData.payment_reference)
    const detailParts = [method, ref ? `Ref: ${ref}` : null].filter(Boolean) as string[]
    const detail = detailParts.length > 0 ? ` · ${detailParts.join(" · ")}` : ""

    return [
      {
        label: amount ? `Payment Received: ${amount}${detail}` : "Payment Received",
        icon: <IconCash className="h-4 w-4" />,
        colorClass: COLORS.green,
      },
    ]
  }

  if (log.action === "UPDATE" && newData && oldData) {
    const changes: AuditChange[] = []
    if (newData.amount !== oldData.amount) {
      changes.push({
        label: "Payment Amount",
        oldValue: formatMoney(oldData.amount, currency) ?? "—",
        newValue: formatMoney(newData.amount, currency) ?? "—",
        icon: <IconCoin className="h-4 w-4" />,
        colorClass: COLORS.blue,
      })
    }
    if (newData.payment_method !== oldData.payment_method) {
      changes.push({
        label: "Payment Method",
        oldValue: asString(oldData.payment_method) ?? "—",
        newValue: asString(newData.payment_method) ?? "—",
        icon: <IconCoin className="h-4 w-4" />,
        colorClass: COLORS.blue,
      })
    }
    if (newData.reference !== oldData.reference) {
      changes.push({
        label: "Payment Reference",
        oldValue: asString(oldData.reference) ?? "—",
        newValue: asString(newData.reference) ?? "—",
        icon: <IconCoin className="h-4 w-4" />,
        colorClass: COLORS.blue,
      })
    }
    return changes
  }

  return []
}

function computeEntries(logs: InvoiceAuditLog[], currency: string): AuditEntry[] {
  const entries: AuditEntry[] = []

  for (const log of logs) {
    if (log.table_name === "invoices" && log.action === "INSERT") {
      entries.push({ log, isCreate: true, changes: [] })
      continue
    }

    let changes: AuditChange[] = []
    switch (log.table_name) {
      case "invoices":
        changes = buildInvoiceChanges(log)
        break
      case "invoice_items":
        changes = buildInvoiceItemChanges(log, currency)
        break
      case "invoice_payments":
        changes = buildInvoicePaymentChanges(log, currency)
        break
    }

    if (changes.length > 0) {
      entries.push({ log, isCreate: false, changes })
    }
  }

  return entries
}

export function InvoiceAuditTimeline({
  logs,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  maps,
  currency = "$",
}: {
  logs: InvoiceAuditLog[]
  maps: InvoiceAuditLookupMaps
  currency?: string
}) {
  const { timeZone } = useTimezone()
  const entries = computeEntries(logs, currency)

  if (entries.length === 0) {
    return (
      <div className="px-4 py-10 text-center text-sm text-muted-foreground">
        <IconFileInvoice className="mx-auto mb-2 h-6 w-6 opacity-40" />
        No history available
      </div>
    )
  }

  return (
    <div className="px-4 py-2 sm:px-6">
      {entries.map((entry, idx) => {
        const isLast = idx === entries.length - 1
        const firstChange = entry.isCreate ? null : entry.changes[0]
        const icon = entry.isCreate ? (
          <IconCalendarPlus className="h-4 w-4" />
        ) : (
          firstChange?.icon
        )
        const colorClass = entry.isCreate
          ? COLORS.emerald
          : (firstChange?.colorClass ?? COLORS.slate)

        return (
          <div key={entry.log.id} className="flex gap-4">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                  colorClass,
                )}
              >
                {icon}
              </div>
              {!isLast ? <div className="my-1 w-px flex-1 bg-border/40" /> : null}
            </div>

            <div className={cn("min-w-0 flex-1", isLast ? "pb-2" : "pb-5")}>
              {entry.isCreate ? (
                <p className="text-sm font-semibold leading-8">Invoice Created</p>
              ) : (
                <div className="space-y-1 pt-1.5">
                  {entry.changes.map((change, i) => (
                    <div
                      key={i}
                      className="flex flex-wrap items-baseline gap-1 text-sm"
                    >
                      <span className="font-medium">{change.label}</span>
                      {change.oldValue !== undefined && change.newValue !== undefined ? (
                        <>
                          <span className="text-muted-foreground line-through">
                            {change.oldValue}
                          </span>
                          <span className="text-muted-foreground">→</span>
                          <span>{change.newValue}</span>
                        </>
                      ) : change.newValue !== undefined ? (
                        <span className="text-muted-foreground">{change.newValue}</span>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
              <p className="mt-1 text-xs text-muted-foreground">
                {formatDateTime(entry.log.created_at ?? "", timeZone) || "—"}
                {" · "}
                {entry.log.user ? formatUser(entry.log.user) : "System"}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
