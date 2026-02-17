"use client"

import * as React from "react"
import {
  Calendar as CalendarIcon,
  ChevronDown,
  ChevronUp,
  CreditCard,
  FileText,
  Gift,
  RefreshCw,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import type {
  MembershipRecord,
  MembershipTypeWithChargeable,
  TenantDefaultTaxRate,
} from "@/lib/types/memberships"
import { calculateMembershipFee } from "@/lib/utils/membership-utils"

type RenewData = {
  membership_type_id?: string
  notes?: string
  create_invoice: boolean
}

function formatDate(value: Date) {
  return value.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  })
}

function addMonths(dateValue: Date, months: number) {
  const next = new Date(dateValue)
  next.setMonth(next.getMonth() + months)
  return next
}

function calculateRenewalPreviewExpiry(durationMonths: number | null | undefined): Date | null {
  if (!durationMonths || durationMonths < 1) return null
  return addMonths(new Date(), durationMonths)
}

export function RenewMembershipModal({
  open,
  onClose,
  currentMembership,
  membershipTypes,
  defaultTaxRate,
  onRenew,
}: {
  open: boolean
  onClose: () => void
  currentMembership: MembershipRecord
  membershipTypes: MembershipTypeWithChargeable[]
  defaultTaxRate: TenantDefaultTaxRate
  onRenew: (data: RenewData) => Promise<void>
}) {
  const activeTypes = React.useMemo(
    () => membershipTypes.filter((type) => type.is_active),
    [membershipTypes]
  )

  const [selectedTypeId, setSelectedTypeId] = React.useState<string>("")
  const [notes, setNotes] = React.useState("")
  const [showNotes, setShowNotes] = React.useState(false)
  const [createInvoice, setCreateInvoice] = React.useState(true)
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  React.useEffect(() => {
    if (!open) return

    const currentTypeExists = activeTypes.some(
      (type) => type.id === currentMembership.membership_type_id
    )
    const initialTypeId = currentTypeExists
      ? currentMembership.membership_type_id
      : (activeTypes[0]?.id ?? "")

    setSelectedTypeId(initialTypeId)
    setNotes("")
    setShowNotes(false)
    setCreateInvoice(true)
  }, [open, activeTypes, currentMembership.membership_type_id])

  const selectedType = activeTypes.find((type) => type.id === selectedTypeId) ?? null
  const isChangingType =
    Boolean(selectedTypeId) && selectedTypeId !== currentMembership.membership_type_id
  const expiryDate = selectedType
    ? calculateRenewalPreviewExpiry(selectedType.duration_months)
    : null

  const handleSubmit = async () => {
    if (!selectedType || isSubmitting) return

    setIsSubmitting(true)
    try {
      await onRenew({
        membership_type_id: isChangingType ? selectedTypeId : undefined,
        notes: notes.trim() || undefined,
        create_invoice: createInvoice,
      })
      onClose()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !isSubmitting) onClose()
      }}
    >
      <DialogContent className="max-h-[90vh] w-[680px] max-w-[92vw] overflow-hidden p-0">
        <div className="flex h-full max-h-[90vh] flex-col">
          <DialogHeader className="border-b border-slate-200 px-6 pt-6 pb-4">
            <DialogTitle className="flex items-center gap-2 text-xl text-slate-900">
              <RefreshCw className="h-5 w-5 text-blue-600" />
              Renew Membership
            </DialogTitle>
            <p className="text-sm text-slate-600">
              Renew this member&apos;s membership and optionally create an invoice.
            </p>
          </DialogHeader>

          <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
            <div className="space-y-4">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-800">
                <Gift className="h-4 w-4 text-indigo-600" />
                Membership Type
              </label>

              <Select value={selectedTypeId} onValueChange={setSelectedTypeId}>
                <SelectTrigger className="h-11 text-base">
                  <SelectValue placeholder="Choose a membership type" />
                </SelectTrigger>
                <SelectContent>
                  {activeTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      <div className="flex w-full items-center justify-between gap-3">
                        <span className="font-medium">{type.name}</span>
                        <span className="text-sm font-semibold text-slate-900">
                          {calculateMembershipFee(
                            type.chargeables?.rate,
                            type.chargeables?.is_taxable,
                            defaultTaxRate?.rate,
                            defaultTaxRate?.tax_name
                          )}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedType ? (
                <div className="space-y-3 rounded-lg border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="text-lg font-semibold text-slate-900">{selectedType.name}</h4>
                      <p className="mt-1 text-sm text-slate-600">
                        {selectedType.duration_months} month term
                      </p>
                    </div>
                    <div className="text-right text-xl font-bold text-slate-900">
                      {calculateMembershipFee(
                        selectedType.chargeables?.rate,
                        selectedType.chargeables?.is_taxable,
                        defaultTaxRate?.rate,
                        defaultTaxRate?.tax_name
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 border-t border-blue-200 pt-3 text-sm">
                    <CalendarIcon className="h-4 w-4 text-slate-600" />
                    <span className="text-slate-600">New Expiry:</span>
                    <span className="font-semibold text-slate-900">
                      {expiryDate ? formatDate(expiryDate) : "N/A"}
                    </span>
                  </div>
                </div>
              ) : null}
            </div>

            {selectedType ? (
              <div className="space-y-4 border-t border-slate-200 pt-3">
                <div className="flex items-center justify-between rounded-lg bg-slate-50 p-3">
                  <div className="flex-1">
                    <label htmlFor="create-invoice" className="cursor-pointer text-sm font-medium">
                      Create invoice
                    </label>
                    <p className="text-xs text-slate-600">Generate invoice for payment</p>
                  </div>
                  <Switch
                    id="create-invoice"
                    checked={createInvoice}
                    onCheckedChange={setCreateInvoice}
                  />
                </div>
              </div>
            ) : null}

            <div className="space-y-2 border-t border-slate-200 pt-3">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setShowNotes((prev) => !prev)}
                className="h-8 w-full justify-between px-0 text-sm font-medium hover:bg-transparent"
              >
                <span className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Add Notes (optional)
                </span>
                {showNotes ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>

              {showNotes ? (
                <Textarea
                  id="renew-membership-notes"
                  placeholder="Add any notes about this renewal..."
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={3}
                  className="text-sm"
                />
              ) : null}
            </div>
          </div>

          <DialogFooter className="border-t border-slate-200 px-6 py-4">
            <div className="flex w-full items-center justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-6"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting || !selectedType}
                className="bg-slate-900 px-6 text-white hover:bg-slate-800"
                size="lg"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Processing Renewal...
                  </>
                ) : (
                  <>
                    {createInvoice ? (
                      <CreditCard className="mr-2 h-4 w-4" />
                    ) : (
                      <RefreshCw className="mr-2 h-4 w-4" />
                    )}
                    Renew Membership
                  </>
                )}
              </Button>
            </div>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}
