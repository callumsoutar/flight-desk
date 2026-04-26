"use client"

import * as React from "react"
import { CheckCircle, CreditCard, Gift, RotateCcw, UserPlus } from "lucide-react"
import { addDays, addMonths, format } from "date-fns"
import { toast } from "sonner"

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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useMembershipSubmit } from "@/hooks/useMembershipSubmit"
import type {
  MembershipYearSettings,
  MembershipTypeWithChargeable,
  TenantDefaultTaxRate,
} from "@/lib/types/memberships"
import {
  calculateMembershipFee,
  computeMembershipExpiryDefault,
} from "@/lib/utils/membership-utils"
import { useTimezone } from "@/contexts/timezone-context"
import { formatDate } from "@/lib/utils/date-format"

interface CreateMembershipModalProps {
  open: boolean
  onClose: () => void
  onSuccess?: () => void | Promise<void>
  memberId: string
  membershipTypes: MembershipTypeWithChargeable[]
  defaultTaxRate: TenantDefaultTaxRate
  membershipYear: MembershipYearSettings | null
}

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

function getInvoiceReadyChargeable(
  chargeable: MembershipTypeWithChargeable["chargeables"]
) {
  if (!chargeable) return null
  if (chargeable.rate === null || chargeable.is_taxable === null) return null

  return {
    id: chargeable.id,
    name: chargeable.name,
    rate: chargeable.rate,
    is_taxable: chargeable.is_taxable,
  }
}

export function CreateMembershipModal({
  open,
  onClose,
  onSuccess,
  memberId,
  membershipTypes,
  defaultTaxRate,
  membershipYear,
}: CreateMembershipModalProps) {
  const { timeZone } = useTimezone()
  const [selectedTypeId, setSelectedTypeId] = React.useState<string>("")
  const [notes, setNotes] = React.useState("")
  const [createInvoice, setCreateInvoice] = React.useState(true)
  const [startDate, setStartDate] = React.useState(() => new Date())
  const [expiryDate, setExpiryDate] = React.useState<Date | null>(null)
  const [expiryIsManual, setExpiryIsManual] = React.useState(false)
  const { submit, loading, error } = useMembershipSubmit({
    onSuccess: async ({ invoiceId }) => {
      toast.success(invoiceId ? "Membership created with invoice" : "Membership created")
      onClose()
      await onSuccess?.()
    },
    onError: (submissionError) => toast.error(submissionError.message),
  })

  React.useEffect(() => {
    if (!open) return
    setSelectedTypeId("")
    setNotes("")
    setCreateInvoice(true)
    setStartDate(new Date())
    setExpiryDate(null)
    setExpiryIsManual(false)
  }, [open])

  const selectedType = membershipTypes.find((type) => type.id === selectedTypeId)
  const selectedChargeable = getInvoiceReadyChargeable(selectedType?.chargeables ?? null)
  const hasLinkedChargeable = Boolean(selectedType?.chargeable_id)
  const recommendedExpiry = React.useMemo(() => {
    if (!selectedType) return null
    return computeMembershipExpiryDefault(startDate, selectedType.duration_months, membershipYear)
  }, [selectedType, startDate, membershipYear])
  const minExpiryDate = React.useMemo(() => addDays(startDate, 1), [startDate])

  React.useEffect(() => {
    if (createInvoice && selectedType && !selectedType.chargeable_id) {
      setCreateInvoice(false)
    }
  }, [createInvoice, selectedType])

  React.useEffect(() => {
    if (!expiryIsManual && recommendedExpiry) {
      setExpiryDate(recommendedExpiry)
    }
  }, [expiryIsManual, recommendedExpiry])

  const handleExpiryChange = (value: string | null) => {
    setExpiryDate(fromInputDate(value))
    setExpiryIsManual(true)
  }

  const handleResetExpiry = () => {
    if (!recommendedExpiry) return
    setExpiryDate(recommendedExpiry)
    setExpiryIsManual(false)
  }

  const handleSubmit = async () => {
    if (!selectedType || loading) return
    if (!expiryDate) {
      toast.error("Expiry date is required.")
      return
    }

    if (expiryDate <= startDate) {
      toast.error("Expiry date must be after the start date.")
      return
    }

    if (expiryDate < addMonths(startDate, 1)) {
      toast.error("Expiry date must be at least 1 month after the start date.")
      return
    }

    await submit(
      {
        userId: memberId,
        membershipTypeId: selectedType.id,
        membershipType: {
          id: selectedType.id,
          name: selectedType.name,
          duration_months: selectedType.duration_months,
          chargeable_id: selectedType.chargeable_id,
        },
        chargeable: selectedChargeable,
        startDate,
        expiryDate,
        notes: notes.trim() || undefined,
        autoRenew: false,
        gracePeriodDays: 30,
        mode: "create",
      },
      createInvoice
    )
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !loading) onClose()
      }}
    >
      <DialogContent className="w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] overflow-hidden rounded-[24px] border-none p-0 shadow-2xl top-[calc(env(safe-area-inset-top)+1rem)] translate-y-0 sm:top-[50%] sm:w-full sm:max-w-[560px] sm:translate-y-[-50%] h-[calc(100dvh-2rem)] sm:h-auto sm:max-h-[calc(100dvh-4rem)]">
        <div className="flex h-full min-h-0 flex-col bg-white">
          <DialogHeader className="space-y-2 border-b border-slate-100 px-6 pt-6 pb-4">
            <DialogTitle className="flex items-center gap-2 text-xl text-slate-900">
              <UserPlus className="h-5 w-5 text-indigo-600" />
              Create Membership
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-600">
              Assign a new membership for this member.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 min-h-0 space-y-5 overflow-y-auto overscroll-contain px-6 py-5">
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
                      Expires: {formatDate(expiryDate, timeZone)}
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="text-sm text-slate-600">
                  Select a membership type to preview details.
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <div className="flex min-h-7 items-center justify-between">
                  <label className="text-sm font-medium text-slate-800">Start Date</label>
                  <span aria-hidden="true" className="h-7 w-7" />
                </div>
                <DatePicker
                  id="create-membership-start-date"
                  date={toInputDate(startDate)}
                  onChange={(value) => {
                    const parsed = fromInputDate(value)
                    if (parsed) setStartDate(parsed)
                  }}
                  disabled={loading}
                  className="h-11 rounded-xl border-slate-300"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-slate-800">Expiry Date</label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={handleResetExpiry}
                          disabled={loading || !recommendedExpiry}
                          className="h-7 w-7"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top">Reset to recommended date</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <DatePicker
                  id="create-membership-expiry-date"
                  date={toInputDate(expiryDate)}
                  onChange={handleExpiryChange}
                  min={toInputDate(minExpiryDate) ?? undefined}
                  disabled={loading || !selectedType}
                  className="h-11 rounded-xl border-slate-300"
                />
                {selectedType ? (
                  membershipYear ? (
                    <p className="text-xs text-slate-500">
                      {expiryIsManual && recommendedExpiry
                        ? `Custom date set. Recommended: ${format(recommendedExpiry, "dd MMM yyyy")}`
                        : `Aligned to membership year end (${membershipYear.description ?? `${membershipYear.end_day}/${membershipYear.end_month}`})`}
                    </p>
                  ) : (
                    <p className="text-xs text-slate-500">
                      Based on {selectedType.duration_months}-month membership period.
                    </p>
                  )
                ) : null}
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-3">
              <div>
                <p className="text-sm font-medium text-slate-800">Create invoice</p>
                <p className="text-xs text-slate-600">Generate invoice for payment</p>
              </div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Switch
                        checked={createInvoice}
                        onCheckedChange={setCreateInvoice}
                        disabled={selectedType ? !hasLinkedChargeable : false}
                      />
                    </span>
                  </TooltipTrigger>
                  {selectedType && !hasLinkedChargeable ? (
                    <TooltipContent side="top">
                      No chargeable linked to this membership type. Configure one in Settings.
                    </TooltipContent>
                  ) : null}
                </Tooltip>
              </TooltipProvider>
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
            <Button variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={loading || !selectedType}
              className="bg-slate-900 text-white hover:bg-slate-800"
            >
              {loading ? (
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
          {error ? <p className="px-6 pb-4 text-sm text-red-600">{error.message}</p> : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
