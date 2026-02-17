"use client"

import * as React from "react"
import { CheckCircle, CreditCard, Gift, UserPlus } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import type {
  MembershipTypeWithChargeable,
  TenantDefaultTaxRate,
} from "@/lib/types/memberships"
import { calculateMembershipFee } from "@/lib/utils/membership-utils"

interface CreateMembershipModalProps {
  open: boolean
  onClose: () => void
  memberId: string
  membershipTypes: MembershipTypeWithChargeable[]
  defaultTaxRate: TenantDefaultTaxRate
  onCreateMembership: (data: {
    user_id: string
    membership_type_id: string
    custom_expiry_date?: string
    notes?: string
    create_invoice: boolean
  }) => Promise<void>
}

function calculateDefaultExpiry(durationMonths: number) {
  const now = new Date()
  const end = new Date(now)
  end.setMonth(end.getMonth() + durationMonths)
  return end
}

function formatDate(value: Date | null) {
  if (!value) return ""
  return value.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  })
}

export function CreateMembershipModal({
  open,
  onClose,
  memberId,
  membershipTypes,
  defaultTaxRate,
  onCreateMembership,
}: CreateMembershipModalProps) {
  const [selectedTypeId, setSelectedTypeId] = React.useState<string>("")
  const [notes, setNotes] = React.useState("")
  const [createInvoice, setCreateInvoice] = React.useState(true)
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  React.useEffect(() => {
    if (!open) return
    setSelectedTypeId("")
    setNotes("")
    setCreateInvoice(true)
  }, [open])

  const selectedType = membershipTypes.find((type) => type.id === selectedTypeId)
  const expiryDate = selectedType
    ? calculateDefaultExpiry(selectedType.duration_months)
    : null

  const handleSubmit = async () => {
    if (!selectedType) return
    setIsSubmitting(true)
    try {
      await onCreateMembership({
        user_id: memberId,
        membership_type_id: selectedTypeId,
        notes: notes.trim() || undefined,
        create_invoice: createInvoice,
      })
      onClose()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-[560px] max-w-[92vw] rounded-2xl border border-slate-200 bg-white p-0 shadow-2xl">
        <div className="flex flex-col">
          <DialogHeader className="space-y-2 border-b border-slate-100 px-6 pt-6 pb-4">
            <DialogTitle className="flex items-center gap-2 text-xl text-slate-900">
              <UserPlus className="h-5 w-5 text-indigo-600" />
              Create Membership
            </DialogTitle>
            <p className="text-sm text-slate-600">
              Assign a new membership for this member.
            </p>
          </DialogHeader>

          <div className="space-y-5 px-6 py-5">
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-800">
                <Gift className="h-4 w-4 text-indigo-600" />
                Membership Type
              </label>
              <Select value={selectedTypeId} onValueChange={setSelectedTypeId}>
                <SelectTrigger className="h-11 rounded-xl border-slate-300 bg-white">
                  <SelectValue placeholder="Select membership type" />
                </SelectTrigger>
                <SelectContent>
                  {membershipTypes
                    .filter((type) => type.is_active)
                    .map((type) => (
                      <SelectItem key={type.id} value={type.id}>
                        <div className="flex w-full items-center justify-between gap-4">
                          <span className="font-medium">{type.name}</span>
                          <span className="text-xs text-slate-500">
                            {type.duration_months} months
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-blue-50 p-4">
              {selectedType ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h4 className="text-lg font-semibold text-slate-900">
                        {selectedType.name}
                      </h4>
                      <CheckCircle className="h-4 w-4 text-indigo-600" />
                    </div>
                    <p className="text-lg font-bold text-slate-900">
                      {calculateMembershipFee(
                        selectedType.chargeables?.rate,
                        selectedType.chargeables?.is_taxable,
                        defaultTaxRate?.rate,
                        defaultTaxRate?.tax_name
                      )}
                    </p>
                  </div>
                  <p className="text-sm text-slate-600">
                    Duration: {selectedType.duration_months} months
                  </p>
                  {expiryDate ? (
                    <p className="text-sm text-slate-600">
                      Expires: {formatDate(expiryDate)}
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="text-sm text-slate-600">
                  Select a membership type to preview details.
                </p>
              )}
            </div>

            <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-3">
              <div>
                <p className="text-sm font-medium text-slate-800">Create invoice</p>
                <p className="text-xs text-slate-600">Generate invoice for payment</p>
              </div>
              <Switch checked={createInvoice} onCheckedChange={setCreateInvoice} />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-800">
                Notes (optional)
              </label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Add any notes about this membership..."
              />
            </div>
          </div>

          <DialogFooter className="border-t border-slate-100 px-6 py-4">
            <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !selectedType}
              className="bg-slate-900 text-white hover:bg-slate-800"
            >
              {isSubmitting ? (
                <>
                  <UserPlus className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  {createInvoice ? (
                    <CreditCard className="mr-2 h-4 w-4" />
                  ) : (
                    <UserPlus className="mr-2 h-4 w-4" />
                  )}
                  Create Membership
                </>
              )}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}
