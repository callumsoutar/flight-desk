"use client"

import * as React from "react"
import { format } from "date-fns"
import { Pencil, Gift } from "lucide-react"
import { toast } from "sonner"

import { updateActiveMemberMembershipAction } from "@/app/members/actions"
import { Button } from "@/components/ui/button"
import { DatePicker } from "@/components/ui/date-picker"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import type { MembershipRecord, TenantDefaultTaxRate } from "@/lib/types/memberships"
import {
  calculateMembershipFee,
  parseMembershipDateField,
} from "@/lib/utils/membership-utils"
import { formatDate } from "@/lib/utils/date-format"
import { useTimezone } from "@/contexts/timezone-context"

function toInputDate(value: Date | null): string | null {
  if (!value) return null
  return format(value, "yyyy-MM-dd")
}

function fromInputDate(value: string | null): Date | null {
  if (!value) return null
  const [year, month, day] = value.split("-").map(Number)
  if (!year || !month || !day) return null
  return new Date(year, month - 1, day)
}

export function EditActiveMembershipModal({
  open,
  onClose,
  onSuccess,
  memberId,
  membership,
  defaultTaxRate,
}: {
  open: boolean
  onClose: () => void
  onSuccess?: () => void | Promise<void>
  memberId: string
  membership: MembershipRecord
  defaultTaxRate: TenantDefaultTaxRate
}) {
  const { timeZone } = useTimezone()
  const [startDate, setStartDate] = React.useState<Date | null>(null)
  const [expiryDate, setExpiryDate] = React.useState<Date | null>(null)
  const [notes, setNotes] = React.useState("")
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    if (!open) return
    const start = parseMembershipDateField(membership.start_date)
    const expiry = parseMembershipDateField(membership.expiry_date)
    setStartDate(start)
    setExpiryDate(expiry)
    setNotes(membership.notes ?? "")
  }, [open, membership.id, membership.start_date, membership.expiry_date, membership.notes])

  const handleSubmit = async () => {
    if (loading) return
    if (!startDate || !expiryDate) {
      toast.error("Start date and expiry date are required.")
      return
    }
    if (expiryDate < startDate) {
      toast.error("Expiry date must be on or after the start date.")
      return
    }

    const startKey = toInputDate(startDate)
    const expiryKey = toInputDate(expiryDate)
    if (!startKey || !expiryKey) {
      toast.error("Invalid dates.")
      return
    }

    setLoading(true)
    try {
      const result = await updateActiveMemberMembershipAction({
        memberId,
        membershipId: membership.id,
        start_date: startKey,
        expiry_date: expiryKey,
        notes: notes.trim() ? notes.trim() : null,
      })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success("Membership updated")
      onClose()
      await onSuccess?.()
    } finally {
      setLoading(false)
    }
  }

  const typeName = membership.membership_types?.name ?? "Membership"
  const minExpiry = toInputDate(startDate) ?? undefined

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !loading) onClose()
      }}
    >
      <DialogContent className="w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] overflow-hidden rounded-[24px] border-none p-0 shadow-2xl top-[calc(env(safe-area-inset-top)+1rem)] translate-y-0 sm:top-[50%] sm:w-full sm:max-w-[560px] sm:translate-y-[-50%] h-[calc(100dvh-2rem)] sm:h-auto sm:max-h-[calc(100dvh-4rem)]">
        <div className="flex h-full min-h-0 flex-col bg-white">
          <DialogHeader className="border-b border-slate-200 px-6 pt-6 pb-4">
            <DialogTitle className="flex items-center gap-2 text-xl text-slate-900">
              <Pencil className="h-5 w-5 text-indigo-600" />
              Edit membership
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-600">
              Adjust the period and notes for this member&apos;s active membership. Membership type is
              unchanged — use renew to change type or roll forward.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 min-h-0 space-y-5 overflow-y-auto overscroll-contain px-6 py-5">
            <div className="rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-blue-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Gift className="h-4 w-4 text-indigo-600" />
                  <h4 className="text-base font-semibold text-slate-900">{typeName}</h4>
                </div>
                <span className="text-sm font-semibold text-slate-900">
                  {calculateMembershipFee(
                    membership.membership_types?.chargeables?.rate,
                    membership.membership_types?.chargeables?.is_taxable,
                    defaultTaxRate?.rate,
                    defaultTaxRate?.tax_name
                  )}
                </span>
              </div>
              <p className="mt-2 text-xs text-slate-600">
                Current period (before save): {formatDate(membership.start_date, timeZone)} –{" "}
                {formatDate(membership.expiry_date, timeZone)}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="edit-membership-start" className="text-sm font-medium text-slate-800">
                  Start date
                </label>
                <DatePicker
                  id="edit-membership-start"
                  date={toInputDate(startDate)}
                  onChange={(v) => setStartDate(fromInputDate(v))}
                  disabled={loading}
                  className="h-11 rounded-xl border-slate-300"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="edit-membership-expiry" className="text-sm font-medium text-slate-800">
                  Expiry date
                </label>
                <DatePicker
                  id="edit-membership-expiry"
                  date={toInputDate(expiryDate)}
                  onChange={(v) => setExpiryDate(fromInputDate(v))}
                  min={minExpiry}
                  disabled={loading}
                  className="h-11 rounded-xl border-slate-300"
                />
                <p className="text-xs text-slate-500">Last day of this membership period.</p>
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="edit-membership-notes" className="text-sm font-medium text-slate-800">
                Notes
              </label>
              <Textarea
                id="edit-membership-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={loading}
                placeholder="Internal notes (optional)"
                rows={4}
                className="resize-y rounded-xl border-slate-300"
              />
            </div>
          </div>

          <DialogFooter className="border-t border-slate-200 px-6 py-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-slate-900 text-white hover:bg-slate-800"
              onClick={() => void handleSubmit()}
              disabled={loading}
            >
              {loading ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}
