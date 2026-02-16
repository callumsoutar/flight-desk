"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, CheckCircle2, Save, Trash2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { InvoiceStatus } from "@/lib/types/invoices"

import type { UserResult } from "./member-select"

interface InvoiceActionsToolbarProps {
  mode: "new" | "edit" | "view"
  invoiceId?: string
  invoiceNumber?: string | null
  status?: InvoiceStatus
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

export default function InvoiceActionsToolbar({
  mode,
  invoiceId: _invoiceId,
  invoiceNumber,
  status,
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

  const getStatusBadgeVariant = (value?: InvoiceStatus) => {
    switch (value) {
      case "paid":
        return "default"
      case "pending":
        return "secondary"
      case "overdue":
        return "destructive"
      case "draft":
        return "outline"
      case "cancelled":
      case "refunded":
        return "outline"
      default:
        return "outline"
    }
  }

  const getStatusLabel = (value?: InvoiceStatus) => {
    if (!value) return "Draft"
    return value.charAt(0).toUpperCase() + value.slice(1)
  }

  const isReadOnly = mode === "view" || (status && status !== "draft")

  const displayName = member
    ? [member.first_name, member.last_name].filter(Boolean).join(" ") || member.email
    : ""

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-4 overflow-hidden sm:gap-8">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => router.back()}
          className="h-8 w-8 shrink-0 p-0 text-slate-500 hover:text-slate-900 sm:h-9 sm:w-auto sm:gap-2 sm:px-3"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Back</span>
        </Button>

        <div className="flex min-w-0 items-center gap-4 sm:gap-6">
          {displayInvoiceNumber ? (
            <div className="flex shrink-0 items-center gap-4">
              <span className="text-base font-bold leading-none tracking-tight text-slate-900 sm:text-xl">
                {displayInvoiceNumber}
              </span>

              {status ? (
                <Badge
                  variant={getStatusBadgeVariant(status)}
                  className="shrink-0 rounded-md border-none px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider shadow-sm"
                >
                  {getStatusLabel(status)}
                </Badge>
              ) : null}
            </div>
          ) : null}

          {member ? (
            <>
              <div className="hidden h-4 w-px shrink-0 bg-slate-200/60 md:block" />
              <div className="hidden min-w-0 items-center px-3 py-1.5 md:flex">
                <Link
                  href={`/members/${member.id}`}
                  className="truncate text-sm font-medium leading-none tracking-tight text-slate-500 transition-colors hover:text-slate-900"
                >
                  {displayName}
                </Link>
              </div>
            </>
          ) : null}
        </div>
      </div>

      <div className="-mx-4 flex justify-end overflow-x-auto px-4 pb-1 sm:mx-0 sm:overflow-visible sm:px-0 sm:pb-0">
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
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
                  {saveLoading ? "Saving..." : "Save Draft"}
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
                  {approveLoading ? (
                    "Approving..."
                  ) : (
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
                  {saveLoading ? (
                    "Saving..."
                  ) : (
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
                  {approveLoading ? (
                    "Approving..."
                  ) : (
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
                  <span>Delete</span>
                </Button>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}
