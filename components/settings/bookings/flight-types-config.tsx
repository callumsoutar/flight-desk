"use client"

import * as React from "react"
import { useQueryClient } from "@tanstack/react-query"
import {
  IconArchive,
  IconCopy,
  IconGift,
  IconPencil,
  IconPlane,
  IconPlus,
  IconSearch,
} from "@tabler/icons-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  createFlightType,
  deactivateFlightType,
  duplicateFlightType,
  flightTypesBillingSummaryKey,
  flightTypesQueryKey,
  updateFlightType,
  useFlightTypesBillingSummaryQuery,
  useFlightTypesQuery,
  type FlightType,
  type FlightTypeBillingSummary,
} from "@/hooks/use-flight-types-query"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { XeroAccountSelect } from "@/components/settings/xero-account-select"
import type { XeroStatusQueryData } from "@/hooks/use-xero-status-query"
import { useXeroStatusQuery } from "@/hooks/use-xero-status-query"
import { useDefaultTaxRateQuery } from "@/hooks/use-default-tax-rate-query"
import { cn } from "@/lib/utils"

type InstructionType = "dual" | "solo" | "trial"
type BillingMode = "hourly" | "fixed_package"

type FlightTypeFormData = {
  name: string
  description: string
  instruction_type: InstructionType
  billing_mode: BillingMode
  duration_minutes: string
  /** Tax-inclusive package price (fixed-package trials); stored ex-GST on save */
  package_price_inclusive: string
  aircraft_gl_code: string
  instructor_gl_code: string
  is_active: boolean
  is_revenue: boolean
}

const defaultFormData: FlightTypeFormData = {
  name: "",
  description: "",
  instruction_type: "dual",
  billing_mode: "hourly",
  duration_minutes: "",
  package_price_inclusive: "",
  aircraft_gl_code: "",
  instructor_gl_code: "",
  is_active: true,
  is_revenue: true,
}

function roundToTwoDecimals(value: number) {
  return Math.round(value * 100) / 100
}

function roundToStoragePrecision(value: number) {
  return Math.round(value * 1_000_000) / 1_000_000
}

function exclusiveToInclusive(unitPrice: number, taxRate: number): number {
  return unitPrice * (1 + taxRate)
}

function inclusiveToExclusive(rateInclusive: number, taxRate: number): number {
  return rateInclusive / (1 + taxRate)
}

function parseOptionalNumber(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed.length) return null
  const parsed = Number.parseFloat(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}

function defaultBillingModeFor(type: InstructionType): BillingMode {
  return type === "trial" ? "fixed_package" : "hourly"
}

function parseDurationMinutes(raw: string): number | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const n = Number.parseInt(trimmed, 10)
  if (!Number.isFinite(n) || n <= 0 || n > 24 * 60) return null
  return n
}

function formatBillingSummary(
  flightType: Pick<FlightType, "billing_mode" | "fixed_package_price">,
  summary: FlightTypeBillingSummary | undefined,
  taxRate: number
): {
  label: string
  tone: "muted" | "ok" | "warn"
  sub?: string
} {
  if (flightType.billing_mode !== "fixed_package") {
    return { label: "Hourly", tone: "muted" }
  }
  const pkgEx =
    flightType.fixed_package_price == null
      ? null
      : Number(flightType.fixed_package_price)
  if (pkgEx != null && Number.isFinite(pkgEx) && pkgEx > 0) {
    const pkgInc = exclusiveToInclusive(pkgEx, taxRate)
    return {
      label: `$${roundToTwoDecimals(pkgInc).toFixed(2)} package`,
      tone: "ok",
      sub: "Tax inclusive",
    }
  }
  if (!summary) {
    return { label: "Package", tone: "muted", sub: "Loading…" }
  }
  const { aircraft_priced, aircraft_total, min_price, max_price } = summary
  if (aircraft_total === 0) {
    return { label: "Package", tone: "warn", sub: "Set a package price" }
  }
  const missing = aircraft_total - aircraft_priced
  if (missing > 0) {
    return {
      label: "Package",
      tone: "warn",
      sub: `${missing} of ${aircraft_total} aircraft missing price`,
    }
  }
  if (min_price != null && max_price != null) {
    if (min_price === max_price) {
      const inc = exclusiveToInclusive(min_price, taxRate)
      return {
        label: `$${roundToTwoDecimals(inc).toFixed(2)} package`,
        tone: "ok",
        sub: `${aircraft_priced} aircraft (legacy)`,
      }
    }
    const minInc = exclusiveToInclusive(min_price, taxRate)
    const maxInc = exclusiveToInclusive(max_price, taxRate)
    return {
      label: "Package",
      tone: "ok",
      sub: `$${roundToTwoDecimals(minInc).toFixed(2)}–$${roundToTwoDecimals(maxInc).toFixed(2)} · ${aircraft_priced} aircraft (legacy)`,
    }
  }
  return { label: "Package", tone: "muted" }
}

const instructionTypeOptions: Array<{
  value: InstructionType
  label: string
  hint: string
}> = [
  { value: "trial", label: "Trial", hint: "Flat-fee discovery / trial flights" },
  { value: "dual", label: "Dual", hint: "Instructor + student, billed hourly" },
  { value: "solo", label: "Solo", hint: "Student only, billed hourly" },
]

function formatInstructionType(value: string | null) {
  if (!value) return "—"
  const match = instructionTypeOptions.find((option) => option.value === value)
  return match?.label ?? value
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message
  return "Something went wrong."
}

function TypeOptionButton({
  option,
  selected,
  onClick,
  disabled,
}: {
  option: (typeof instructionTypeOptions)[number]
  selected: boolean
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex flex-1 flex-col items-start gap-0.5 rounded-lg border px-3 py-2.5 text-left transition-colors",
        selected
          ? "border-indigo-500 bg-indigo-50/60 ring-1 ring-indigo-400/50"
          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50",
        disabled && "cursor-not-allowed opacity-60"
      )}
    >
      <span
        className={cn(
          "text-sm font-semibold",
          selected ? "text-indigo-900" : "text-slate-800"
        )}
      >
        {option.label}
      </span>
      <span className="text-[11px] text-muted-foreground">{option.hint}</span>
    </button>
  )
}

export type FlightTypesConfigScope = "dual_solo" | "trial"

type FlightTypeDialogProps = {
  mode: "create" | "edit"
  flightType: FlightType | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
  showChartOfAccounts: boolean
  defaultTaxRate: number
  instructionScope: FlightTypesConfigScope
}

function FlightTypeDialog({
  mode,
  flightType,
  open,
  onOpenChange,
  onSaved,
  showChartOfAccounts,
  defaultTaxRate,
  instructionScope,
}: FlightTypeDialogProps) {
  const queryClient = useQueryClient()
  const [formData, setFormData] = React.useState<FlightTypeFormData>(defaultFormData)
  const [showAdvanced, setShowAdvanced] = React.useState(false)
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    if (!open) return
    if (mode === "edit" && flightType) {
      const ex = flightType.fixed_package_price
      const exNum = ex != null && Number.isFinite(Number(ex)) && Number(ex) > 0 ? Number(ex) : null
      const inclusiveStr =
        exNum != null
          ? roundToTwoDecimals(exclusiveToInclusive(exNum, defaultTaxRate)).toFixed(2)
          : ""
      setFormData({
        name: flightType.name ?? "",
        description: flightType.description ?? "",
        instruction_type: (flightType.instruction_type as InstructionType) ?? "dual",
        billing_mode: (flightType.billing_mode as BillingMode) ?? "hourly",
        duration_minutes:
          flightType.duration_minutes != null ? String(flightType.duration_minutes) : "",
        package_price_inclusive: inclusiveStr,
        aircraft_gl_code: flightType.aircraft_gl_code ?? "",
        instructor_gl_code: flightType.instructor_gl_code ?? "",
        is_active: Boolean(flightType.is_active),
        is_revenue:
          typeof flightType.is_revenue === "boolean" ? flightType.is_revenue : true,
      })
    } else if (instructionScope === "trial") {
      setFormData({
        ...defaultFormData,
        instruction_type: "trial",
        billing_mode: defaultBillingModeFor("trial"),
      })
    } else {
      setFormData(defaultFormData)
    }
    setShowAdvanced(false)
  }, [open, mode, flightType, defaultTaxRate, instructionScope])

  const isTrial = formData.instruction_type === "trial"
  const isFixedPackage = isTrial && formData.billing_mode === "fixed_package"
  const showInstructorGl =
    showChartOfAccounts && formData.instruction_type !== "solo" && !isFixedPackage

  const handleInstructionTypeChange = (value: InstructionType) => {
    setFormData((prev) => {
      const next: FlightTypeFormData = { ...prev, instruction_type: value }
      if (value !== "trial") {
        next.billing_mode = "hourly"
        next.duration_minutes = ""
        next.package_price_inclusive = ""
      } else if (mode === "create") {
        next.billing_mode = defaultBillingModeFor(value)
      }
      if (value === "solo") {
        next.instructor_gl_code = ""
      }
      return next
    })
  }

  const handleBillingModeSwitch = (nextPackage: boolean) => {
    const nextMode: BillingMode = nextPackage ? "fixed_package" : "hourly"
    if (formData.billing_mode === "fixed_package" && nextMode === "hourly") {
      const ok = window.confirm(
        "Switch to hourly billing? The fixed package price on this flight type will be cleared when you save."
      )
      if (!ok) return
    }
    setFormData((prev) => ({
      ...prev,
      billing_mode: nextMode,
      duration_minutes: nextMode === "fixed_package" ? prev.duration_minutes : "",
      package_price_inclusive: nextMode === "fixed_package" ? prev.package_price_inclusive : "",
    }))
  }

  const invalidateAllCaches = React.useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: flightTypesQueryKey({ includeInactive: true }) }),
      queryClient.invalidateQueries({ queryKey: flightTypesBillingSummaryKey }),
    ])
  }, [queryClient])

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error("Name is required")
      return
    }

    const pkgInclusive = parseOptionalNumber(formData.package_price_inclusive)
    let fixedPkgExGst: number | null = null
    if (isFixedPackage) {
      if (pkgInclusive == null || pkgInclusive <= 0) {
        toast.error("Enter a valid tax-inclusive package price greater than zero")
        return
      }
      fixedPkgExGst = roundToStoragePrecision(inclusiveToExclusive(pkgInclusive, defaultTaxRate))
    }

    if (
      showChartOfAccounts &&
      formData.instruction_type !== "solo" &&
      !isFixedPackage &&
      !formData.instructor_gl_code.trim()
    ) {
      toast.error("Instructor GL code is required for dual hourly flight types")
      setShowAdvanced(true)
      return
    }

    setSaving(true)
    try {
      const fixedPkgPayload = isFixedPackage ? fixedPkgExGst : null

      if (mode === "edit" && flightType) {
        await updateFlightType({
          id: flightType.id,
          name: formData.name,
          description: formData.description,
          instruction_type: formData.instruction_type,
          billing_mode: formData.billing_mode,
          duration_minutes: isFixedPackage ? parseDurationMinutes(formData.duration_minutes) : null,
          fixed_package_price: fixedPkgPayload,
          aircraft_gl_code: formData.aircraft_gl_code || null,
          instructor_gl_code:
            formData.instruction_type === "solo" || isFixedPackage
              ? null
              : formData.instructor_gl_code || null,
          is_active: formData.is_active,
          is_revenue: formData.is_revenue,
        })
      } else {
        await createFlightType({
          name: formData.name,
          description: formData.description,
          instruction_type: formData.instruction_type,
          billing_mode: formData.billing_mode,
          duration_minutes: isFixedPackage ? parseDurationMinutes(formData.duration_minutes) : null,
          fixed_package_price: fixedPkgPayload,
          aircraft_gl_code: formData.aircraft_gl_code || null,
          instructor_gl_code:
            formData.instruction_type === "solo" || isFixedPackage
              ? null
              : formData.instructor_gl_code || null,
          is_active: formData.is_active,
          is_revenue: formData.is_revenue,
        })
      }

      await invalidateAllCaches()

      toast.success(mode === "edit" ? "Flight type saved" : "Flight type created")
      onSaved()
      onOpenChange(false)
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const disableSave = saving
  const dialogTitle =
    instructionScope === "trial"
      ? mode === "edit"
        ? "Edit trial flight"
        : "Add trial flight"
      : mode === "edit"
        ? "Edit flight type"
        : "Add flight type"
  const dualSoloOptions = instructionTypeOptions.filter((o) => o.value !== "trial")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "overflow-hidden rounded-2xl border border-slate-200 p-0 shadow-lg",
          "w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] sm:w-full sm:max-w-[540px]",
          "h-[calc(100dvh-2rem)] sm:flex sm:flex-col sm:h-auto sm:max-h-[calc(100dvh-4rem)]"
        )}
      >
        <div className="flex flex-col flex-1 min-h-0 bg-white">
          <DialogHeader className="px-6 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-4 text-left sm:pt-6 shrink-0">
            <div className="flex items-center gap-4">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-700"
              >
                {instructionScope === "trial" ? (
                  <IconGift className="h-5 w-5" />
                ) : (
                  <IconPlane className="h-5 w-5" />
                )}
              </div>
              <div>
                <DialogTitle className="text-xl font-bold tracking-tight text-slate-900">
                  {dialogTitle}
                </DialogTitle>
                <DialogDescription className="mt-0.5 text-sm text-slate-500">
                  Configure booking category and pricing. Required fields are marked with{" "}
                  <span className="text-destructive">*</span>.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-6 pb-6 space-y-6">
            {/* Step 1: instruction category */}
            <div>
              <label className="mb-2 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                {instructionScope === "trial" ? "Category" : "Instruction type"}{" "}
                <span className="text-destructive">*</span>
              </label>
              {instructionScope === "trial" ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-sm font-semibold text-slate-900">Trial flight</p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600">
                    Marketed discovery or intro flights — usually a fixed package price and duration.
                  </p>
                </div>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {dualSoloOptions.map((option) => (
                    <TypeOptionButton
                      key={option.value}
                      option={option}
                      selected={formData.instruction_type === option.value}
                      onClick={() => handleInstructionTypeChange(option.value)}
                      disabled={saving}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Step 2: name + duration */}
            <div className="grid gap-4 sm:grid-cols-[1fr,160px]">
              <div>
                <label htmlFor="flight-type-name" className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Name <span className="text-destructive">*</span>
                </label>
                <Input
                  id="flight-type-name"
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  className="h-11 rounded-xl border-slate-200 bg-white px-3 text-[15px] shadow-none transition-colors focus-visible:ring-0"
                  placeholder={
                    formData.instruction_type === "trial"
                      ? "e.g. 30-min Trial Flight"
                      : formData.instruction_type === "solo"
                        ? "e.g. Solo Hire"
                        : "e.g. Dual Instruction"
                  }
                  disabled={saving}
                />
              </div>
              {isFixedPackage ? (
                <div>
                  <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    Duration
                  </label>
                  <div className="relative">
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={24 * 60}
                      step={1}
                      value={formData.duration_minutes}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          duration_minutes: e.target.value.replace(/[^0-9]/g, ""),
                        }))
                      }
                      className="h-11 rounded-xl border-slate-200 bg-white pl-3 pr-12 text-[15px] tabular-nums shadow-none transition-colors focus-visible:ring-0"
                      placeholder="30"
                      disabled={saving}
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">
                      min
                    </span>
                  </div>
                </div>
              ) : null}
            </div>

            {/* Step 3: trial package price or note for hourly types */}
            {isTrial ? (
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <label className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    Package pricing
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-600">Fixed package</span>
                    <Switch
                      checked={isFixedPackage}
                      onCheckedChange={handleBillingModeSwitch}
                      disabled={saving}
                    />
                  </div>
                </div>
                {isFixedPackage ? (
                  <div className="space-y-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
                    <div>
                      <label
                        htmlFor="flight-type-package-price"
                        className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wide text-slate-500"
                      >
                        Package price <span className="text-destructive">*</span>
                      </label>
                      <div className="relative max-w-[220px]">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                        <Input
                          id="flight-type-package-price"
                          type="number"
                          step="0.01"
                          inputMode="decimal"
                          value={formData.package_price_inclusive}
                          onChange={(e) =>
                            setFormData((prev) => ({ ...prev, package_price_inclusive: e.target.value }))
                          }
                          className="h-11 rounded-xl border-slate-200 bg-white pl-7 text-[15px] tabular-nums shadow-none focus-visible:ring-0"
                          placeholder="287.50"
                          disabled={saving}
                          aria-label="Package price tax inclusive"
                        />
                      </div>
                      <p className="mt-1.5 text-[11px] text-muted-foreground">
                        Entered price is tax inclusive (same as chargeables). Default tax rate:{" "}
                        {(defaultTaxRate * 100).toFixed(0)}%.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 text-xs text-slate-600">
                    Hourly aircraft rates for this booking are set per aircraft under{" "}
                    <span className="font-semibold text-slate-800">Settings &rarr; Aircraft</span>.
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 text-xs text-slate-600">
                Hourly aircraft rates are managed per aircraft in{" "}
                <span className="font-semibold text-slate-800">
                  Settings &rarr; Aircraft &rarr; Charge Rates
                </span>
                . Dual and Solo flight types only capture the booking category and GL codes here.
              </div>
            )}

            {/* Advanced */}
            <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 transition-colors hover:text-slate-900"
                >
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                    <IconPlus className={cn("h-3.5 w-3.5 transition-transform", showAdvanced && "rotate-45")} />
                  </span>
                  {showAdvanced ? "Hide advanced options" : "Show advanced options"}
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-5 space-y-5">
                <div>
                  <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    Description
                  </label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, description: e.target.value }))
                    }
                    className="min-h-[64px] resize-y rounded-xl border-slate-200 bg-white px-3 py-2 text-[15px] shadow-none transition-colors focus-visible:ring-0"
                    placeholder="Optional notes shown to staff."
                    disabled={saving}
                  />
                </div>

                {showChartOfAccounts ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                        Aircraft GL code
                      </label>
                      <XeroAccountSelect
                        value={formData.aircraft_gl_code}
                        onChange={(code) =>
                          setFormData((prev) => ({ ...prev, aircraft_gl_code: code }))
                        }
                        accountTypes={["REVENUE"]}
                        placeholder="Select account…"
                        className="h-11 rounded-xl shadow-none"
                      />
                    </div>
                    {showInstructorGl ? (
                      <div>
                        <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                          Instructor GL code
                        </label>
                        <XeroAccountSelect
                          value={formData.instructor_gl_code}
                          onChange={(code) =>
                            setFormData((prev) => ({ ...prev, instructor_gl_code: code }))
                          }
                          accountTypes={["REVENUE"]}
                          placeholder="Select account…"
                          className="h-11 rounded-xl shadow-none"
                        />
                      </div>
                    ) : (
                      <div>
                        <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                          Instructor GL code
                        </label>
                        <div className="flex h-11 items-center rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 text-xs text-slate-500">
                          {isFixedPackage
                            ? "Not used for packages"
                            : "Not required for solo"}
                        </div>
                      </div>
                    )}
                  </div>
                ) : null}

                <div className="rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <Label className="text-sm font-semibold text-slate-900 leading-none">Revenue flying</Label>
                      <p className="mt-1 text-xs text-slate-600 leading-snug">
                        {formData.is_revenue
                          ? "Counts toward revenue flying in reports."
                          : "Treat as non-revenue (e.g. supervision, charity) in reports."}
                      </p>
                    </div>
                    <Switch
                      checked={formData.is_revenue}
                      onCheckedChange={(checked) =>
                        setFormData((prev) => ({ ...prev, is_revenue: checked }))
                      }
                      disabled={saving}
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <Label className="text-sm font-semibold text-slate-900 leading-none">Active status</Label>
                      <p className="mt-1 text-xs text-slate-600 leading-snug">
                        {formData.is_active
                          ? "Available for new bookings."
                          : "Hidden from new bookings."}
                      </p>
                    </div>
                    <Switch
                      checked={formData.is_active}
                      onCheckedChange={(checked) =>
                        setFormData((prev) => ({ ...prev, is_active: checked }))
                      }
                      disabled={saving}
                    />
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>

          <div className="shrink-0 border-t bg-white px-6 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-[0_-4px_12px_rgba(0,0,0,0.05)] sm:pb-4">
            <div className="flex items-center justify-between gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="h-10 flex-1 rounded-xl border-slate-200 text-xs font-bold shadow-none hover:bg-slate-50"
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={disableSave}
                className="h-10 flex-[1.4] rounded-xl bg-slate-900 text-xs font-bold text-white shadow-lg shadow-slate-900/10 hover:bg-slate-800"
              >
                {saving ? "Saving…" : mode === "edit" ? "Save Changes" : "Create Flight Type"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function FlightTypesConfig({
  initialXeroStatus,
  scope,
}: {
  initialXeroStatus: XeroStatusQueryData
  scope: FlightTypesConfigScope
}) {
  const queryClient = useQueryClient()
  const [mutationError, setMutationError] = React.useState<string | null>(null)
  const [searchTerm, setSearchTerm] = React.useState("")
  const [working, setWorking] = React.useState(false)
  const [dialog, setDialog] = React.useState<
    { open: false } | { open: true; mode: "create" } | { open: true; mode: "edit"; flightType: FlightType }
  >({ open: false })

  const {
    data: flightTypes = [],
    isLoading,
    error: flightTypesQueryError,
  } = useFlightTypesQuery({ includeInactive: true })
  const { data: xeroStatus } = useXeroStatusQuery(initialXeroStatus)
  const { data: defaultTaxRate = 0.15 } = useDefaultTaxRateQuery()
  const showChartOfAccounts = Boolean(xeroStatus?.connected)

  const { data: billingSummaries } = useFlightTypesBillingSummaryQuery()
  const billingSummariesById = React.useMemo(() => {
    const map = new Map<string, FlightTypeBillingSummary>()
    for (const s of billingSummaries ?? []) map.set(s.flight_type_id, s)
    return map
  }, [billingSummaries])

  const error = mutationError ?? (flightTypesQueryError ? getErrorMessage(flightTypesQueryError) : null)

  const scopedTypes = React.useMemo(() => {
    return flightTypes.filter((t) => {
      const it = t.instruction_type as InstructionType
      if (scope === "trial") return it === "trial"
      return it === "dual" || it === "solo"
    })
  }, [flightTypes, scope])

  const filteredTypes = React.useMemo(() => {
    if (scope === "trial") return scopedTypes
    const term = searchTerm.trim().toLowerCase()
    if (!term) return scopedTypes
    return scopedTypes.filter((type) => {
      const haystack = [type.name, type.description ?? "", type.instruction_type ?? ""]
        .join(" ")
        .toLowerCase()
      return haystack.includes(term)
    })
  }, [scope, scopedTypes, searchTerm])

  const invalidateFlightTypeCaches = React.useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: flightTypesQueryKey({ includeInactive: true }) }),
      queryClient.invalidateQueries({ queryKey: flightTypesBillingSummaryKey }),
    ])
  }, [queryClient])

  const handleDuplicate = async (source: FlightType) => {
    const suggested = `${source.name} (copy)`
    const input = window.prompt(
      "Name for the duplicated flight type:\n\nInstructor rate rows will be copied when applicable. Legacy per-aircraft charge rows may also be copied.",
      suggested
    )
    if (input == null) return
    const name = input.trim()
    if (!name) {
      toast.error("Name is required")
      return
    }

    setWorking(true)
    setMutationError(null)
    try {
      const result = await duplicateFlightType({ source_id: source.id, name })
      await invalidateFlightTypeCaches()
      toast.success(
        `Duplicated · ${result.aircraft_rates_copied} aircraft rate${result.aircraft_rates_copied === 1 ? "" : "s"} copied` +
          (result.instructor_rates_copied > 0
            ? `, ${result.instructor_rates_copied} instructor rate${result.instructor_rates_copied === 1 ? "" : "s"}`
            : "")
      )
    } catch (err) {
      toast.error(getErrorMessage(err))
      setMutationError(getErrorMessage(err))
    } finally {
      setWorking(false)
    }
  }

  const handleDeactivate = async (flightType: FlightType) => {
    if (!flightType.is_active) return
    const confirmed = window.confirm(
      "Deactivate this flight type? It will no longer be available for new bookings."
    )
    if (!confirmed) return

    setWorking(true)
    setMutationError(null)
    try {
      await deactivateFlightType(flightType.id)
      await queryClient.invalidateQueries({
        queryKey: flightTypesQueryKey({ includeInactive: true }),
      })
      toast.success("Flight type deactivated")
    } catch (err) {
      toast.error(getErrorMessage(err))
      setMutationError(getErrorMessage(err))
    } finally {
      setWorking(false)
    }
  }

  const groupOrder: readonly InstructionType[] =
    scope === "trial" ? (["trial"] as const) : (["dual", "solo"] as const)

  const searchPlaceholder = "Search dual & solo flight types…"
  const addLabel = scope === "trial" ? "Add trial flight" : "Add flight type"

  return (
    <div className="space-y-6">
      {scope === "trial" ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-slate-900 sm:text-xl">Trial flights</h3>
            <p className="max-w-2xl text-sm leading-relaxed text-slate-600">
              Configure intro, discovery, and gift-flight packages with durations, prices, and revenue
              coding for first-time customers.
            </p>
          </div>
        </section>
      ) : (
        <>
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <IconPlane className="h-5 w-5 text-indigo-600" />
            <h3 className="text-lg font-semibold text-slate-900">Flight types</h3>
          </div>
          <p className="text-sm text-slate-600">
            Dual and solo categories for ongoing training and hire. Hourly aircraft rates are set per
            aircraft under{" "}
            <span className="font-medium text-slate-800">Settings &rarr; Aircraft &rarr; Charge rates</span>.
            Trial and intro packages are managed in the{" "}
            <span className="font-medium text-slate-800">Trial flights</span> tab.
          </p>
        </>
      )}

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {scope === "trial" ? (
        <div className="flex justify-end">
          <Button
            onClick={() => setDialog({ open: true, mode: "create" })}
            className="h-10 rounded-xl bg-violet-600 px-4 font-semibold text-white shadow-sm hover:bg-violet-700"
            disabled={working}
          >
            <IconPlus className="mr-2 h-4 w-4" />
            {addLabel}
          </Button>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-3 sm:p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <IconSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder={searchPlaceholder}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-10 rounded-xl border-slate-200 bg-white pl-9 shadow-none focus-visible:ring-0"
              />
            </div>
            <Button
              onClick={() => setDialog({ open: true, mode: "create" })}
              className="h-10 rounded-xl bg-indigo-600 px-4 font-semibold text-white shadow-sm hover:bg-indigo-700 sm:shrink-0"
              disabled={working}
            >
              <IconPlus className="mr-2 h-4 w-4" />
              {addLabel}
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-muted-foreground">
          {scope === "trial" ? "Loading trial flights…" : "Loading flight types…"}
        </div>
      ) : filteredTypes.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/60 p-12 text-center">
          <p className="text-sm font-semibold text-slate-900">
            {scope === "trial"
              ? "No trial flights yet"
              : searchTerm
                ? "No matches"
                : "No dual or solo flight types"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {scope === "trial"
              ? "Create your first trial flight to offer intro experiences at checkout and on the schedule."
              : searchTerm
                ? "Try a different search."
                : "Add dual instruction and solo hire types to categorise bookings."}
          </p>
        </div>
      ) : scope === "trial" ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredTypes.map((flightType) => {
            const summary = billingSummariesById.get(flightType.id)
            const billingDisplay = formatBillingSummary(flightType, summary, defaultTaxRate)
            const isFixedPackage = flightType.billing_mode === "fixed_package"
            const showCardDetails = Boolean(billingDisplay.sub) || showChartOfAccounts
            return (
              <Card
                key={flightType.id}
                className={cn(
                  "flex h-full flex-col gap-0 overflow-hidden rounded-xl border border-slate-200 py-0 shadow-sm",
                  flightType.is_active ? "bg-white" : "bg-slate-50/90"
                )}
              >
                <CardHeader className="space-y-3 px-4 pb-3 pt-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-1">
                      <CardTitle className="text-base leading-snug text-slate-900">
                        {flightType.name}
                      </CardTitle>
                      {flightType.description ? (
                        <CardDescription className="line-clamp-2 text-xs leading-relaxed text-slate-600">
                          {flightType.description}
                        </CardDescription>
                      ) : (
                        <CardDescription className="text-xs italic text-slate-400">
                          No description
                        </CardDescription>
                      )}
                    </div>
                    <span
                      className={cn(
                        "shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold",
                        flightType.is_active
                          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                          : "border-slate-200 bg-slate-100 text-slate-600"
                      )}
                    >
                      {flightType.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {isFixedPackage && flightType.duration_minutes ? (
                      <span className="rounded-full border border-violet-200 bg-violet-50 px-2.5 py-0.5 text-[11px] font-semibold text-violet-900">
                        {flightType.duration_minutes} min
                      </span>
                    ) : null}
                    <span
                      className={cn(
                        "rounded-full border px-2.5 py-0.5 text-[11px] font-semibold",
                        billingDisplay.tone === "ok"
                          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                          : billingDisplay.tone === "warn"
                            ? "border-amber-200 bg-amber-50 text-amber-900"
                            : "border-slate-200 bg-white text-slate-600"
                      )}
                    >
                      {billingDisplay.label}
                    </span>
                    {!isFixedPackage ? (
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">
                        Hourly (aircraft)
                      </span>
                    ) : null}
                  </div>
                </CardHeader>
                {showCardDetails ? (
                  <CardContent className="flex flex-1 flex-col gap-2 border-t border-slate-100 px-4 py-3 text-xs">
                    {billingDisplay.sub ? (
                      <p className="text-slate-600">
                        <span className="mr-1 font-semibold uppercase tracking-wide text-slate-500">
                          Billing:
                        </span>
                        {billingDisplay.sub}
                      </p>
                    ) : null}
                    {showChartOfAccounts ? (
                      <dl className="grid gap-2 sm:grid-cols-2">
                        <div>
                          <dt className="font-semibold uppercase tracking-wide text-slate-500">Aircraft GL</dt>
                          <dd className="mt-1 font-mono text-slate-800">
                            {flightType.aircraft_gl_code || "—"}
                          </dd>
                        </div>
                        <div>
                          <dt className="font-semibold uppercase tracking-wide text-slate-500">Instructor GL</dt>
                          <dd className="mt-1 font-mono text-slate-800">
                            {isFixedPackage || flightType.instruction_type === "solo"
                              ? "—"
                              : flightType.instructor_gl_code || "—"}
                          </dd>
                        </div>
                      </dl>
                    ) : null}
                  </CardContent>
                ) : null}
                <CardFooter className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/70 px-3.5 py-2.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 rounded-lg border-slate-300 bg-white px-3"
                      onClick={() => setDialog({ open: true, mode: "edit", flightType })}
                      disabled={working}
                    >
                      <IconPencil className="mr-1.5 h-3.5 w-3.5" />
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 rounded-lg border-slate-300 bg-white px-3"
                      onClick={() => void handleDuplicate(flightType)}
                      disabled={working}
                    >
                      <IconCopy className="mr-1.5 h-3.5 w-3.5" />
                      Duplicate
                    </Button>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 rounded-lg px-2 text-orange-700 hover:bg-orange-50 hover:text-orange-800"
                    onClick={() => void handleDeactivate(flightType)}
                    disabled={working || !flightType.is_active}
                  >
                    <IconArchive className="mr-1.5 h-3.5 w-3.5" />
                    Deactivate
                  </Button>
                </CardFooter>
              </Card>
            )
          })}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50 hover:bg-slate-50">
                <TableHead className="font-semibold text-slate-700">Name</TableHead>
                <TableHead className="font-semibold text-slate-700">Billing</TableHead>
                {showChartOfAccounts ? (
                  <>
                    <TableHead className="font-semibold text-slate-700">Aircraft GL</TableHead>
                    <TableHead className="font-semibold text-slate-700">Instructor GL</TableHead>
                  </>
                ) : null}
                <TableHead className="font-semibold text-slate-700">Status</TableHead>
                <TableHead className="text-right font-semibold text-slate-700">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groupOrder.flatMap((group) => {
                const rows = filteredTypes.filter(
                  (t) => (t.instruction_type as InstructionType) === group
                )
                if (rows.length === 0) return []
                const groupCols = showChartOfAccounts ? 6 : 4
                return [
                  <TableRow key={`group-${group}`} className="hover:bg-transparent border-t-0">
                    <TableCell
                      colSpan={groupCols}
                      className="bg-slate-50/60 px-4 py-2 text-[11px] font-semibold uppercase tracking-widest text-slate-500"
                    >
                      {formatInstructionType(group)} · {rows.length}
                    </TableCell>
                  </TableRow>,
                  ...rows.map((flightType) => {
                    const summary = billingSummariesById.get(flightType.id)
                    const billingDisplay = formatBillingSummary(flightType, summary, defaultTaxRate)
                    const isFixedPackage = flightType.billing_mode === "fixed_package"
                    return (
                      <TableRow key={flightType.id} className="hover:bg-slate-50/60">
                        <TableCell className="font-medium text-slate-900">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span>{flightType.name}</span>
                              {flightType.is_default_solo ? (
                                <span className="rounded-md border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">
                                  Default solo
                                </span>
                              ) : null}
                              {isFixedPackage && flightType.duration_minutes ? (
                                <span className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                                  {flightType.duration_minutes}m
                                </span>
                              ) : null}
                            </div>
                            {flightType.description ? (
                              <p className="text-xs text-muted-foreground">{flightType.description}</p>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-0.5">
                            <span
                              className={cn(
                                "inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-semibold",
                                billingDisplay.tone === "ok"
                                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                  : billingDisplay.tone === "warn"
                                    ? "border-amber-200 bg-amber-50 text-amber-800"
                                    : "border-slate-200 bg-white text-slate-600"
                              )}
                            >
                              {billingDisplay.label}
                            </span>
                            {billingDisplay.sub ? (
                              <p className="text-[11px] text-muted-foreground">{billingDisplay.sub}</p>
                            ) : null}
                          </div>
                        </TableCell>
                        {showChartOfAccounts ? (
                          <>
                            <TableCell className="text-slate-600">
                              {flightType.aircraft_gl_code || "—"}
                            </TableCell>
                            <TableCell className="text-slate-600">
                              {flightType.instruction_type === "solo" || isFixedPackage
                                ? "—"
                                : flightType.instructor_gl_code || "—"}
                            </TableCell>
                          </>
                        ) : null}
                        <TableCell>
                          <span
                            className={cn(
                              "inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-semibold",
                              flightType.is_active
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : "border-slate-200 bg-slate-100 text-slate-600"
                            )}
                          >
                            {flightType.is_active ? "Active" : "Inactive"}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-9 w-9 rounded-xl p-0"
                              onClick={() => setDialog({ open: true, mode: "edit", flightType })}
                              disabled={working}
                              title="Edit"
                            >
                              <IconPencil className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-9 w-9 rounded-xl p-0 text-slate-600 hover:bg-slate-100"
                              onClick={() => void handleDuplicate(flightType)}
                              disabled={working}
                              title="Duplicate"
                            >
                              <IconCopy className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-9 w-9 rounded-xl p-0 text-orange-600 hover:bg-orange-50 hover:text-orange-700"
                              onClick={() => void handleDeactivate(flightType)}
                              disabled={working || !flightType.is_active}
                              title="Deactivate"
                            >
                              <IconArchive className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  }),
                ]
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <FlightTypeDialog
        mode={dialog.open && dialog.mode === "edit" ? "edit" : "create"}
        flightType={dialog.open && dialog.mode === "edit" ? dialog.flightType : null}
        open={dialog.open}
        onOpenChange={(open) => {
          if (!open) setDialog({ open: false })
        }}
        onSaved={() => {
          setDialog({ open: false })
        }}
        showChartOfAccounts={showChartOfAccounts}
        defaultTaxRate={defaultTaxRate}
        instructionScope={scope}
      />
    </div>
  )
}
