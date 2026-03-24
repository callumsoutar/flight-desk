"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, CheckCircle2, Lock, Save, Trash2, User } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { InvoiceStatus } from "@/lib/types/invoices"

import type { UserResult } from "./member-select"

interface InvoiceActionsToolbarProps {
  mode: "new" | "edit" | "view"
  invoiceId?: string
  invoiceNumber?: string | null
  status?: InvoiceStatus
  isXeroLocked?: boolean
  member?: UserResult | null
  rightSlot?: React.ReactNode
  onSave?: () => void
  onApprove?: () => void
  onDelete?: () => void
  saveDisabled?: boolean
  approveDisabled?: boolean
  saveLoading?: boolean
  approveLoading?: boolean
  showApprove?: boolean
  bookingId?: string | null
}

const STATUS_CONFIG: Record<
  string,
  { label: string; className: string }
> = {
  draft:      { label: "Draft",      className: "bg-slate-100 text-slate-600 ring-slate-200" },
  authorised: { label: "Authorised", className: "bg-blue-50 text-blue-700 ring-blue-200" },
  paid:       { label: "Paid",       className: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  overdue:    { label: "Overdue",    className: "bg-red-50 text-red-700 ring-red-200" },
  cancelled:  { label: "Cancelled",  className: "bg-slate-100 text-slate-500 ring-slate-200" },
  refunded:   { label: "Refunded",   className: "bg-slate-100 text-slate-500 ring-slate-200" },
}

export default function InvoiceActionsToolbar({
  mode,
  invoiceId: _invoiceId,
  invoiceNumber,
  status,
  isXeroLocked = false,
  member,
  rightSlot,
  onSave,
  onApprove,
  onDelete,
  saveDisabled = false,
  approveDisabled = false,
  saveLoading = false,
  approveLoading = false,
  showApprove = false,
}: InvoiceActionsToolbarProps) {
  const router = useRouter()
  const displayInvoiceNumber =
    invoiceNumber || (_invoiceId ? `#${_invoiceId.slice(0, 8)}` : null)

  const isReadOnly = mode === "view" || (status && status !== "draft")

  const displayName = member
    ? [member.first_name, member.last_name].filter(Boolean).join(" ") || member.email
    : ""

  const statusCfg = status ? (STATUS_CONFIG[status] ?? STATUS_CONFIG.draft) : null

  return (
    <div className="flex items-center justify-between gap-3">
      {/* ── Left: back + invoice identity ─────────────────────────── */}
      <div className="flex min-w-0 items-center gap-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => router.back()}
          className="h-8 w-8 shrink-0 p-0 text-muted-foreground hover:text-foreground sm:h-9 sm:w-auto sm:gap-1.5 sm:px-2.5"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline text-sm">Back</span>
        </Button>

        <div className="h-5 w-px shrink-0 bg-border/60" />

        {/* Identity block — two lines */}
        <div className="min-w-0">
          {/* Line 1: invoice number */}
          {displayInvoiceNumber ? (
            <p className="text-sm font-bold leading-tight tracking-tight text-foreground sm:text-base">
              {displayInvoiceNumber}
            </p>
          ) : null}

          {/* Line 2: badges + member link */}
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
            {statusCfg ? (
              <span
                className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ring-1 ring-inset ${statusCfg.className}`}
              >
                {statusCfg.label}
              </span>
            ) : null}

            {isXeroLocked ? (
              <span className="inline-flex items-center gap-0.5 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700 ring-1 ring-inset ring-amber-200">
                <Lock className="h-2.5 w-2.5" />
                Xero Locked
              </span>
            ) : null}

            {member ? (
              <>
                {(statusCfg || isXeroLocked) ? (
                  <span className="text-muted-foreground/40 text-[10px]">·</span>
                ) : null}
                <Link
                  href={`/members/${member.id}`}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  <User className="h-2.5 w-2.5" />
                  <span className="max-w-[140px] truncate">{displayName}</span>
                </Link>
              </>
            ) : null}
          </div>
        </div>
      </div>

      {/* ── Right: actions ────────────────────────────────────────── */}
      <div className="flex shrink-0 items-center gap-2">
        {rightSlot}

        {mode === "new" ? (
          <>
            {onSave ? (
              <Button
                type="button"
                size="sm"
                onClick={onSave}
                disabled={saveDisabled || saveLoading}
                variant="outline"
                className="h-8 sm:h-9"
              >
                {saveLoading ? "Saving…" : "Save Draft"}
              </Button>
            ) : null}
            {showApprove && onApprove ? (
              <Button
                type="button"
                size="sm"
                onClick={onApprove}
                disabled={approveDisabled || approveLoading}
                className="h-8 gap-1.5 sm:h-9"
              >
                {approveLoading ? "Approving…" : (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Approve
                  </>
                )}
              </Button>
            ) : null}
          </>
        ) : null}

        {mode === "edit" && !isReadOnly ? (
          <>
            {onSave ? (
              <Button
                type="button"
                size="sm"
                onClick={onSave}
                disabled={saveDisabled || saveLoading}
                variant="outline"
                className="h-8 gap-1.5 sm:h-9"
              >
                {saveLoading ? "Saving…" : (
                  <>
                    <Save className="h-3.5 w-3.5" />
                    Save
                  </>
                )}
              </Button>
            ) : null}
            {showApprove && onApprove ? (
              <Button
                type="button"
                size="sm"
                onClick={onApprove}
                disabled={approveDisabled || approveLoading}
                className="h-8 gap-1.5 sm:h-9"
              >
                {approveLoading ? "Approving…" : (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Approve
                  </>
                )}
              </Button>
            ) : null}
            {onDelete ? (
              <Button
                type="button"
                size="sm"
                onClick={onDelete}
                variant="destructive"
                className="h-8 gap-1.5 sm:h-9"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </Button>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  )
}
