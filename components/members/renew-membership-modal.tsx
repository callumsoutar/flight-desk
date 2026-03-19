"use client"

import * as React from "react"
import {
  Calendar as CalendarIcon,
  ChevronDown,
  ChevronUp,
  CreditCard,
  FileText,
  Gift,
  RotateCcw,
  RefreshCw,
} from "lucide-react"
import { addDays, addMonths, format } from "date-fns"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { DatePicker } from "@/components/ui/date-picker"
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useMembershipSubmit } from "@/hooks/useMembershipSubmit"
import type {
  MembershipYearSettings,
  MembershipRecord,
  MembershipTypeWithChargeable,
  TenantDefaultTaxRate,
} from "@/lib/types/memberships"
import {
  calculateMembershipFee,
  computeMembershipExpiryDefault,
} from "@/lib/utils/membership-utils"
import { useTimezone } from "@/contexts/timezone-context"
import { formatDate } from "@/lib/utils/date-format"

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

export function RenewMembershipModal({
  open,
  onClose,
  memberId,
  currentMembership,
  membershipTypes,
  defaultTaxRate,
  membershipYear,
}: {
  open: boolean
  onClose: () => void
  memberId: string
  currentMembership: MembershipRecord
  membershipTypes: MembershipTypeWithChargeable[]
  defaultTaxRate: TenantDefaultTaxRate
  membershipYear: MembershipYearSettings | null
}) {
  const router = useRouter()
  const activeTypes = React.useMemo(
    () => membershipTypes.filter((type) => type.is_active),
    [membershipTypes]
  )

  const { timeZone } = useTimezone()
  const [selectedTypeId, setSelectedTypeId] = React.useState<string>("")
  const [notes, setNotes] = React.useState("")
  const [showNotes, setShowNotes] = React.useState(false)
  const [createInvoice, setCreateInvoice] = React.useState(true)
  const [startDate, setStartDate] = React.useState(() => new Date())
  const [expiryDate, setExpiryDate] = React.useState<Date | null>(null)
  const [expiryIsManual, setExpiryIsManual] = React.useState(false)
  const { submit, loading, error } = useMembershipSubmit({
    onSuccess: ({ invoiceId }) => {
      toast.success(invoiceId ? "Membership renewed with invoice" : "Membership renewed")
      onClose()
      router.refresh()
    },
    onError: (submissionError) => toast.error(submissionError.message),
  })

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
    setStartDate(new Date())
    setExpiryDate(null)
    setExpiryIsManual(false)
  }, [open, activeTypes, currentMembership.membership_type_id])

  const selectedType = activeTypes.find((type) => type.id === selectedTypeId) ?? null
  const selectedChargeable = getInvoiceReadyChargeable(selectedType?.chargeables ?? null)
  const recommendedExpiry = React.useMemo(() => {
    if (!selectedType) return null
    return computeMembershipExpiryDefault(startDate, selectedType.duration_months, membershipYear)
  }, [selectedType, startDate, membershipYear])
  const minExpiryDate = React.useMemo(() => addDays(startDate, 1), [startDate])
  const hasLinkedChargeable = Boolean(selectedType?.chargeable_id)

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
        gracePeriodDays: currentMembership.grace_period_days ?? 30,
        mode: "renew",
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
                      {expiryDate ? formatDate(expiryDate, timeZone) : "N/A"}
                    </span>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <div className="flex min-h-7 items-center justify-between">
                  <label className="text-sm font-medium text-slate-800">Start Date</label>
                  <span aria-hidden="true" className="h-7 w-7" />
                </div>
                <DatePicker
                  id="renew-membership-start-date"
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
                  id="renew-membership-expiry-date"
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

            {selectedType ? (
              <div className="space-y-4 border-t border-slate-200 pt-3">
                <div className="flex items-center justify-between rounded-lg bg-slate-50 p-3">
                  <div className="flex-1">
                    <label htmlFor="create-invoice" className="cursor-pointer text-sm font-medium">
                      Create invoice
                    </label>
                    <p className="text-xs text-slate-600">Generate invoice for payment</p>
                  </div>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span>
                          <Switch
                            id="create-invoice"
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
                disabled={loading}
                className="px-6"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={loading || !selectedType}
                className="bg-slate-900 px-6 text-white hover:bg-slate-800"
                size="lg"
              >
                {loading ? (
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
          {error ? <p className="px-6 pb-4 text-sm text-red-600">{error.message}</p> : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
