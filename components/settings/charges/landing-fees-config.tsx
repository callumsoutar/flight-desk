"use client"

import * as React from "react"
import {
  IconArchive,
  IconLoader2,
  IconPlus,
  IconReceiptTax,
  IconSearch,
} from "@tabler/icons-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import type { AircraftTypesRow, ChargeablesRow, LandingFeeRatesRow } from "@/lib/types/tables"
import { cn } from "@/lib/utils"

type LandingFeeRate = Pick<LandingFeeRatesRow, "id" | "chargeable_id" | "aircraft_type_id" | "rate">

type LandingFee = Pick<
  ChargeablesRow,
  "id" | "name" | "description" | "rate" | "is_taxable" | "is_active" | "updated_at"
> & {
  landing_fee_rates: LandingFeeRate[]
}

type LandingFeeFormData = {
  name: string
  description: string
  is_taxable: boolean
  is_active: boolean
  default_rate_inclusive: string
  aircraft_rates_inclusive: Record<string, string>
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message
  return "Something went wrong."
}

function roundToTwoDecimals(value: number) {
  return Math.round(value * 100) / 100
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

function normalizeName(value: string) {
  return value.trim().replaceAll(/\s+/g, " ")
}

function normalizeDescription(value: string) {
  return value.trim()
}

function normalizeRateInput(value: string) {
  const parsed = parseOptionalNumber(value)
  if (parsed == null) return ""
  return roundToTwoDecimals(parsed).toFixed(2)
}

function createBlankFormData(): LandingFeeFormData {
  return {
    name: "",
    description: "",
    is_taxable: true,
    is_active: true,
    default_rate_inclusive: "",
    aircraft_rates_inclusive: {},
  }
}

async function fetchLandingFees(): Promise<LandingFee[]> {
  const response = await fetch("/api/landing-fees?include_inactive=true", { cache: "no-store" })
  if (!response.ok) {
    const data = await response.json().catch(() => null)
    const message =
      data && typeof data === "object" && typeof data.error === "string"
        ? data.error
        : "Failed to load landing fees"
    throw new Error(message)
  }

  const data = (await response.json().catch(() => null)) as { landing_fees?: unknown } | null
  return Array.isArray(data?.landing_fees) ? (data?.landing_fees as LandingFee[]) : []
}

async function fetchAircraftTypes(): Promise<AircraftTypesRow[]> {
  const response = await fetch("/api/aircraft-types", { cache: "no-store" })
  if (!response.ok) return []
  const data = (await response.json().catch(() => null)) as { aircraft_types?: unknown } | null
  return Array.isArray(data?.aircraft_types) ? (data?.aircraft_types as AircraftTypesRow[]) : []
}

async function fetchDefaultTaxRate(): Promise<number> {
  try {
    const response = await fetch("/api/tax-rates?is_default=true", { cache: "no-store" })
    if (!response.ok) return 0.15
    const data = (await response.json().catch(() => null)) as { tax_rates?: unknown } | null
    const first = Array.isArray(data?.tax_rates)
      ? (data?.tax_rates[0] as { rate?: unknown } | undefined)
      : undefined
    return typeof first?.rate === "number" && Number.isFinite(first.rate) ? first.rate : 0.15
  } catch {
    return 0.15
  }
}

function formatRateInclusive(valueExclusive: number | null, taxRate: number, isTaxable: boolean | null) {
  const base = Number.isFinite(valueExclusive) ? Number(valueExclusive) : 0
  const rate = exclusiveToInclusive(base, isTaxable ? taxRate : 0)
  return roundToTwoDecimals(rate).toFixed(2)
}

function createEditFormData(
  fee: LandingFee,
  aircraftTypes: AircraftTypesRow[],
  taxRate: number
): LandingFeeFormData {
  const aircraftRatesInclusive: Record<string, string> = {}
  for (const aircraftType of aircraftTypes) {
    const override = fee.landing_fee_rates.find((rate) => rate.aircraft_type_id === aircraftType.id)
    aircraftRatesInclusive[aircraftType.id] = override
      ? formatRateInclusive(override.rate, taxRate, fee.is_taxable)
      : ""
  }

  return {
    name: fee.name ?? "",
    description: fee.description ?? "",
    is_taxable: fee.is_taxable ?? true,
    is_active: fee.is_active ?? true,
    default_rate_inclusive: formatRateInclusive(fee.rate, taxRate, fee.is_taxable),
    aircraft_rates_inclusive: aircraftRatesInclusive,
  }
}

export function LandingFeesConfig() {
  const [landingFees, setLandingFees] = React.useState<LandingFee[]>([])
  const [aircraftTypes, setAircraftTypes] = React.useState<AircraftTypesRow[]>([])
  const [taxRate, setTaxRate] = React.useState(0.15)

  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [searchTerm, setSearchTerm] = React.useState("")

  const [selectedFeeId, setSelectedFeeId] = React.useState<string | null>(null)
  const [createMode, setCreateMode] = React.useState(false)
  const [descriptionOpen, setDescriptionOpen] = React.useState(false)
  const [overridesOpen, setOverridesOpen] = React.useState(false)

  const [baseForm, setBaseForm] = React.useState<LandingFeeFormData | null>(null)
  const [form, setForm] = React.useState<LandingFeeFormData>(() => createBlankFormData())

  const selectedFee = React.useMemo(
    () => (selectedFeeId ? landingFees.find((fee) => fee.id === selectedFeeId) ?? null : null),
    [landingFees, selectedFeeId]
  )

  const filteredFees = React.useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    if (!term) return landingFees
    return landingFees.filter((fee) => {
      const haystack = [fee.name, fee.description ?? ""].join(" ").toLowerCase()
      return haystack.includes(term)
    })
  }, [landingFees, searchTerm])

  const isDirty = React.useMemo(() => {
    if (!baseForm) return false

    if (normalizeName(form.name) !== normalizeName(baseForm.name)) return true
    if (normalizeDescription(form.description) !== normalizeDescription(baseForm.description)) return true
    if (form.is_taxable !== baseForm.is_taxable) return true
    if (form.is_active !== baseForm.is_active) return true
    if (normalizeRateInput(form.default_rate_inclusive) !== normalizeRateInput(baseForm.default_rate_inclusive)) {
      return true
    }

    for (const aircraftType of aircraftTypes) {
      const current = normalizeRateInput(form.aircraft_rates_inclusive[aircraftType.id] ?? "")
      const base = normalizeRateInput(baseForm.aircraft_rates_inclusive[aircraftType.id] ?? "")
      if (current !== base) return true
    }

    return false
  }, [aircraftTypes, baseForm, form])

  const resetEditorToBlank = React.useCallback(() => {
    const blank = createBlankFormData()
    setBaseForm(blank)
    setForm(blank)
    setDescriptionOpen(false)
    setOverridesOpen(false)
  }, [])

  const load = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [fees, types, nextTaxRate] = await Promise.all([
        fetchLandingFees(),
        fetchAircraftTypes(),
        fetchDefaultTaxRate(),
      ])
      setLandingFees(fees)
      setAircraftTypes(types)
      setTaxRate(nextTaxRate)
      return { fees, types, taxRate: nextTaxRate }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load landing fees")
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void load()
  }, [load])

  const hydrateEditorForFee = React.useCallback(
    (fee: LandingFee) => {
      const next = createEditFormData(fee, aircraftTypes, taxRate)
      setSelectedFeeId(fee.id)
      setCreateMode(false)
      setBaseForm(next)
      setForm(next)
      setDescriptionOpen(Boolean(normalizeDescription(next.description)))
      setOverridesOpen(Object.values(next.aircraft_rates_inclusive).some((value) => Boolean(value?.trim())))
    },
    [aircraftTypes, taxRate]
  )

  const hydrateEditorFromFreshLoad = React.useCallback(
    (feeId: string, fees: LandingFee[], types: AircraftTypesRow[], nextTaxRate: number) => {
      const fee = fees.find((candidate) => candidate.id === feeId) ?? null
      if (!fee) {
        setSelectedFeeId(null)
        setCreateMode(false)
        setBaseForm(null)
        return
      }

      const next = createEditFormData(fee, types, nextTaxRate)
      setSelectedFeeId(fee.id)
      setCreateMode(false)
      setBaseForm(next)
      setForm(next)
      setDescriptionOpen(Boolean(normalizeDescription(next.description)))
      setOverridesOpen(Object.values(next.aircraft_rates_inclusive).some((value) => Boolean(value?.trim())))
    },
    []
  )

  const startCreate = React.useCallback(() => {
    setSelectedFeeId(null)
    setCreateMode(true)
    resetEditorToBlank()
  }, [resetEditorToBlank])

  const confirmDiscardIfNeeded = React.useCallback(() => {
    if (!isDirty) return true
    return window.confirm("Discard your unsaved changes?")
  }, [isDirty])

  const onSelectFee = React.useCallback(
    (fee: LandingFee) => {
      if (!confirmDiscardIfNeeded()) return
      hydrateEditorForFee(fee)
    },
    [confirmDiscardIfNeeded, hydrateEditorForFee]
  )

  const onStartCreate = React.useCallback(() => {
    if (!confirmDiscardIfNeeded()) return
    startCreate()
  }, [confirmDiscardIfNeeded, startCreate])

  React.useEffect(() => {
    if (!selectedFee || !baseForm) return
    if (!aircraftTypes.length) return

    const missing = aircraftTypes.some((type) => baseForm.aircraft_rates_inclusive[type.id] === undefined)
    if (!missing) return

    const nextBase = createEditFormData(selectedFee, aircraftTypes, taxRate)
    setBaseForm(nextBase)
    setForm((prev) => {
      const nextRates = { ...prev.aircraft_rates_inclusive }
      for (const type of aircraftTypes) {
        if (nextRates[type.id] === undefined) nextRates[type.id] = nextBase.aircraft_rates_inclusive[type.id] ?? ""
      }
      return { ...prev, aircraft_rates_inclusive: nextRates }
    })
  }, [aircraftTypes, baseForm, selectedFee, taxRate])

  const applyTaxableToggle = React.useCallback(
    (current: LandingFeeFormData, nextIsTaxable: boolean) => {
      const currentTaxRate = current.is_taxable ? taxRate : 0
      const nextTaxRate = nextIsTaxable ? taxRate : 0

      const nextDefault = parseOptionalNumber(current.default_rate_inclusive)
      const defaultExclusive =
        nextDefault == null ? null : inclusiveToExclusive(nextDefault, currentTaxRate)
      const recalculatedDefault =
        defaultExclusive == null
          ? ""
          : roundToTwoDecimals(exclusiveToInclusive(defaultExclusive, nextTaxRate)).toFixed(2)

      const nextAircraftRates: Record<string, string> = {}
      for (const [aircraftTypeId, valueInclusive] of Object.entries(current.aircraft_rates_inclusive)) {
        const parsed = parseOptionalNumber(valueInclusive)
        if (parsed == null) {
          nextAircraftRates[aircraftTypeId] = ""
          continue
        }
        const exclusive = inclusiveToExclusive(parsed, currentTaxRate)
        nextAircraftRates[aircraftTypeId] = roundToTwoDecimals(exclusiveToInclusive(exclusive, nextTaxRate)).toFixed(2)
      }

      return {
        ...current,
        is_taxable: nextIsTaxable,
        default_rate_inclusive: recalculatedDefault,
        aircraft_rates_inclusive: nextAircraftRates,
      }
    },
    [taxRate]
  )

  const onUndo = React.useCallback(() => {
    if (!baseForm) return
    setForm(baseForm)
    setError(null)
  }, [baseForm])

  const saveLandingFeeRates = React.useCallback(
    async ({
      chargeableId,
      existingRates,
      formData,
    }: {
      chargeableId: string
      existingRates: LandingFeeRate[]
      formData: LandingFeeFormData
    }) => {
      if (!aircraftTypes.length) return

      const itemTaxRate = formData.is_taxable ? taxRate : 0
      const existingRatesByAircraft = new Map<string, LandingFeeRate>()
      for (const rate of existingRates) {
        existingRatesByAircraft.set(rate.aircraft_type_id, rate)
      }

      const operations: Array<Promise<Response>> = []

      for (const aircraftType of aircraftTypes) {
        const valueInclusive = formData.aircraft_rates_inclusive[aircraftType.id] ?? ""
        const parsed = parseOptionalNumber(valueInclusive)
        const existing = existingRatesByAircraft.get(aircraftType.id)

        if (parsed == null) {
          if (existing) {
            operations.push(
              fetch(
                `/api/landing-fee-rates?chargeable_id=${encodeURIComponent(chargeableId)}&aircraft_type_id=${encodeURIComponent(aircraftType.id)}`,
                { method: "DELETE" }
              )
            )
          }
          continue
        }

        const rateExclusive = roundToTwoDecimals(inclusiveToExclusive(parsed, itemTaxRate))
        if (existing) {
          operations.push(
            fetch("/api/landing-fee-rates", {
              method: "PATCH",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                chargeable_id: chargeableId,
                aircraft_type_id: aircraftType.id,
                rate: rateExclusive,
              }),
            })
          )
        } else {
          operations.push(
            fetch("/api/landing-fee-rates", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                chargeable_id: chargeableId,
                aircraft_type_id: aircraftType.id,
                rate: rateExclusive,
              }),
            })
          )
        }
      }

      const results = await Promise.all(operations)
      const failed = results.find((res) => !res.ok)
      if (failed) {
        const data = await failed.json().catch(() => null)
        const message =
          data && typeof data === "object" && typeof data.error === "string"
            ? data.error
            : "Failed to save landing fee rates"
        throw new Error(message)
      }
    },
    [aircraftTypes, taxRate]
  )

  const canSave = React.useMemo(() => {
    if (saving) return false
    if (!isDirty) return false
    if (!normalizeName(form.name).length) return false
    const defaultInclusive = parseOptionalNumber(form.default_rate_inclusive)
    if (defaultInclusive == null || defaultInclusive < 0) return false
    return true
  }, [form.default_rate_inclusive, form.name, isDirty, saving])

  const handleSave = async () => {
    if (!normalizeName(form.name).length) return
    const defaultInclusive = parseOptionalNumber(form.default_rate_inclusive)
    if (defaultInclusive == null || defaultInclusive < 0) {
      setError("Default landing fee rate is required.")
      return
    }

    setSaving(true)
    setError(null)

    try {
      const itemTaxRate = form.is_taxable ? taxRate : 0
      const rateExclusive = roundToTwoDecimals(inclusiveToExclusive(defaultInclusive, itemTaxRate))

      if (createMode) {
        const response = await fetch("/api/landing-fees", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name: normalizeName(form.name),
            description: normalizeDescription(form.description),
            is_taxable: form.is_taxable,
            is_active: form.is_active,
            rate: rateExclusive,
          }),
        })

        if (!response.ok) {
          const data = await response.json().catch(() => null)
          const message =
            data && typeof data === "object" && typeof data.error === "string"
              ? data.error
              : "Failed to create landing fee"
          throw new Error(message)
        }

        const data = (await response.json().catch(() => null)) as { landing_fee?: unknown } | null
        const created =
          data && typeof data.landing_fee === "object" && data.landing_fee
            ? (data.landing_fee as LandingFee)
            : null
        if (!created?.id) throw new Error("Landing fee was created but could not be loaded.")

        await saveLandingFeeRates({
          chargeableId: created.id,
          existingRates: [],
          formData: form,
        })

        const loaded = await load()
        if (loaded) {
          hydrateEditorFromFreshLoad(created.id, loaded.fees, loaded.types, loaded.taxRate)
        } else {
          hydrateEditorForFee({ ...created, landing_fee_rates: [] })
        }
        toast.success("Landing fee created")
        return
      }

      if (!selectedFee) return

      const response = await fetch("/api/landing-fees", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: selectedFee.id,
          name: normalizeName(form.name),
          description: normalizeDescription(form.description),
          is_taxable: form.is_taxable,
          is_active: form.is_active,
          rate: rateExclusive,
        }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        const message =
          data && typeof data === "object" && typeof data.error === "string"
            ? data.error
            : "Failed to update landing fee"
        throw new Error(message)
      }

      await saveLandingFeeRates({
        chargeableId: selectedFee.id,
        existingRates: selectedFee.landing_fee_rates ?? [],
        formData: form,
      })

      const loaded = await load()
      if (loaded) {
        hydrateEditorFromFreshLoad(selectedFee.id, loaded.fees, loaded.types, loaded.taxRate)
      } else {
        hydrateEditorForFee(selectedFee)
      }
      toast.success("Landing fee updated")
    } catch (err) {
      toast.error(getErrorMessage(err))
      setError(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const handleDeactivate = async (fee: LandingFee) => {
    if (!fee.is_active) return
    const confirmed = window.confirm(
      `Deactivate "${fee.name}"? It will no longer be available for new check-ins and invoices.`
    )
    if (!confirmed) return

    setSaving(true)
    setError(null)
    try {
      const response = await fetch(`/api/landing-fees?id=${encodeURIComponent(fee.id)}`, {
        method: "DELETE",
      })
      if (!response.ok) {
        const data = await response.json().catch(() => null)
        const message =
          data && typeof data === "object" && typeof data.error === "string"
            ? data.error
            : "Failed to deactivate landing fee"
        throw new Error(message)
      }
      const loaded = await load()
      if (loaded) {
        hydrateEditorFromFreshLoad(fee.id, loaded.fees, loaded.types, loaded.taxRate)
      }
      toast.success("Landing fee deactivated")
    } catch (err) {
      toast.error(getErrorMessage(err))
      setError(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const emptyState = (
    <div className="flex h-full items-center justify-center p-10">
      <div className="text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50">
          <IconReceiptTax className="h-6 w-6 text-slate-600" />
        </div>
        <p className="mt-4 text-sm font-semibold text-slate-900">
          {landingFees.length ? "Select a landing fee to edit" : "No landing fees yet"}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {landingFees.length
            ? "Choose a location from the list to update rates and overrides."
            : "Create your first landing fee location to get started."}
        </p>
        <Button
          className="mt-5 h-10 rounded-xl bg-slate-900 font-semibold text-white hover:bg-slate-800"
          onClick={onStartCreate}
          disabled={loading || saving}
        >
          <IconPlus className="mr-2 h-4 w-4" />
          Add landing fee
        </Button>
      </div>
    </div>
  )

  const showEditor = createMode || Boolean(selectedFee) || Boolean(selectedFeeId && baseForm)

  const editorTitle = createMode ? "New landing fee" : "Landing fee details"
  const editorSubtitle = createMode
    ? "Create a landing fee location with default + overrides."
    : "Update default + aircraft overrides."

  const editorBadge = createMode ? (
    <Badge className="border-indigo-200 bg-indigo-50 text-indigo-700" variant="outline">
      New
    </Badge>
  ) : !selectedFee ? (
    <Badge className="border-slate-200 bg-white text-slate-600" variant="outline">
      Loading
    </Badge>
  ) : selectedFee.is_active ? (
    <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700" variant="outline">
      Active
    </Badge>
  ) : (
    <Badge className="border-slate-200 bg-white text-slate-600" variant="outline">
      Inactive
    </Badge>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
        <IconReceiptTax className="h-5 w-5 text-indigo-600" />
        <h3 className="text-lg font-semibold text-slate-900">Landing fee locations</h3>
      </div>
      <p className="text-sm text-slate-600">
        Landing fees use a default rate, with optional per-aircraft-type overrides. Rates are shown tax inclusive.
      </p>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="rounded-2xl border border-slate-200 bg-white flex flex-col lg:h-[640px] lg:col-span-2">
          <div className="border-b border-border/40 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative w-full sm:max-w-[420px]">
                <IconSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  placeholder="Search landing fees..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="h-10 rounded-xl border-slate-200 bg-white pl-9 shadow-none focus-visible:ring-0"
                  disabled={loading}
                />
              </div>

              <Button
                onClick={onStartCreate}
                className="h-10 rounded-xl bg-indigo-600 font-semibold text-white hover:bg-indigo-700"
                disabled={loading || saving}
              >
                <IconPlus className="mr-2 h-4 w-4" />
                Add
              </Button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {loading ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-muted-foreground">
                Loading landing fees…
              </div>
            ) : filteredFees.length === 0 ? (
              <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/60 p-10 text-center">
                <p className="text-sm font-semibold text-slate-900">
                  {searchTerm ? "No matching landing fees" : "No landing fees configured"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Create a landing fee location to set default and override rates.
                </p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                {filteredFees.map((fee, index) => {
                  const isSelected = selectedFeeId === fee.id && !createMode
                  const defaultInclusive = formatRateInclusive(fee.rate, taxRate, fee.is_taxable)
                  const overrides = fee.landing_fee_rates?.length ?? 0

                  return (
                    <button
                      key={fee.id}
                      type="button"
                      onClick={() => onSelectFee(fee)}
                      className={cn(
                        "w-full px-4 py-3 text-left transition-colors",
                        index === 0 ? "" : "border-t border-slate-200",
                        isSelected ? "bg-slate-50" : "bg-white hover:bg-slate-50"
                      )}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-sm font-semibold text-slate-900">{fee.name}</p>
                            {fee.is_active ? (
                              <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700" variant="outline">
                                Active
                              </Badge>
                            ) : (
                              <Badge className="border-slate-200 bg-white text-slate-600" variant="outline">
                                Inactive
                              </Badge>
                            )}
                          </div>
                          {fee.description ? (
                            <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{fee.description}</p>
                          ) : null}
                        </div>

                        <div className="flex shrink-0 flex-col items-end gap-0.5 text-right">
                          <p className="text-sm font-semibold tabular-nums text-slate-900">{defaultInclusive}</p>
                          <p className="text-xs text-muted-foreground">
                            {overrides ? `${overrides} override${overrides === 1 ? "" : "s"}` : "—"}
                          </p>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white lg:h-[640px] lg:col-span-3">
          {!showEditor ? (
            emptyState
          ) : (
            <div className="flex h-full flex-col">
              <div className="border-b border-border/40 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-lg font-semibold text-slate-900">{editorTitle}</h4>
                      {editorBadge}
                    </div>
                    <p className="text-sm text-muted-foreground">{editorSubtitle}</p>
                    <p className="text-[11px] font-medium text-slate-500">
                      Default tax rate: {(taxRate * 100).toFixed(0)}%
                    </p>
                  </div>

                  {!createMode && selectedFee ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9 rounded-xl text-orange-600 hover:bg-orange-50 hover:text-orange-700"
                      onClick={() => void handleDeactivate(selectedFee)}
                      disabled={saving || !selectedFee.is_active}
                      title="Deactivate"
                    >
                      <IconArchive className="mr-2 h-4 w-4" />
                      Deactivate
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9 rounded-xl"
                      onClick={() => {
                        if (!confirmDiscardIfNeeded()) return
                        setCreateMode(false)
                        setSelectedFeeId(null)
                        setBaseForm(null)
                        setError(null)
                      }}
                      disabled={saving}
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      value={form.name}
                      onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                      className="h-10 rounded-xl border-slate-200 bg-white"
                      placeholder="e.g. NZPP Landing Fee"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Default rate (tax inclusive) <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      value={form.default_rate_inclusive}
                      onChange={(e) => setForm((prev) => ({ ...prev, default_rate_inclusive: e.target.value }))}
                      type="number"
                      min={0}
                      step="0.01"
                      className="h-10 rounded-xl border-slate-200 bg-white tabular-nums"
                      placeholder="0.00"
                    />
                    <p className="text-[11px] font-medium text-slate-500">Fallback for no override.</p>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-4 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 leading-none">Taxable</p>
                      <p className="mt-1 text-xs text-muted-foreground">Uses default tax rate.</p>
                    </div>
                    <Switch
                      checked={form.is_taxable}
                      onCheckedChange={(checked) => setForm((prev) => applyTaxableToggle(prev, checked))}
                    />
                  </div>

                  <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-4 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 leading-none">Active</p>
                      <p className="mt-1 text-xs text-muted-foreground">Available for check-ins.</p>
                    </div>
                    <Switch
                      checked={form.is_active}
                      onCheckedChange={(checked) => setForm((prev) => ({ ...prev, is_active: checked }))}
                    />
                  </div>
                </div>

                <details
                  className="rounded-2xl border border-slate-200 bg-white"
                  open={descriptionOpen}
                  onToggle={(event) => setDescriptionOpen((event.target as HTMLDetailsElement).open)}
                >
                  <summary className="cursor-pointer list-none px-4 py-2.5">
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900">Description</p>
                        <p className="text-xs text-muted-foreground">Optional internal notes.</p>
                      </div>
                      <Badge variant="outline" className="border-slate-200 text-slate-600">
                        Optional
                      </Badge>
                    </div>
                  </summary>
                  <div className="px-4 pb-4">
                    <Textarea
                      value={form.description}
                      onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                      className="min-h-[72px] resize-none rounded-xl border-slate-200 bg-white"
                      placeholder="Optional notes shown to staff."
                    />
                  </div>
                </details>

                <details
                  className="rounded-2xl border border-slate-200 bg-white"
                  open={overridesOpen}
                  onToggle={(event) => setOverridesOpen((event.target as HTMLDetailsElement).open)}
                >
                  <summary className="cursor-pointer list-none px-4 py-2.5">
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900">Aircraft overrides</p>
                        <p className="text-xs text-muted-foreground">Optional per-aircraft rates.</p>
                      </div>
                      <Badge variant="outline" className="border-slate-200 text-slate-600">
                        {Object.values(form.aircraft_rates_inclusive).filter((value) => Boolean(value?.trim())).length} set
                      </Badge>
                    </div>
                  </summary>

                  <div className="border-t border-border/40 px-4 py-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-xs text-muted-foreground">
                        Leave blank to use the default rate.
                      </p>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          className="h-8 rounded-xl text-xs font-semibold shadow-none"
                          disabled={!aircraftTypes.length}
                          onClick={() => {
                            setOverridesOpen(true)
                            const next: Record<string, string> = {}
                            const normalized = normalizeRateInput(form.default_rate_inclusive)
                            for (const aircraftType of aircraftTypes) {
                              next[aircraftType.id] = normalized
                            }
                            setForm((prev) => ({ ...prev, aircraft_rates_inclusive: next }))
                          }}
                        >
                          Fill
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-8 rounded-xl text-xs font-semibold shadow-none"
                          disabled={!aircraftTypes.length}
                          onClick={() => {
                            setOverridesOpen(true)
                            const next: Record<string, string> = {}
                            for (const aircraftType of aircraftTypes) {
                              next[aircraftType.id] = ""
                            }
                            setForm((prev) => ({ ...prev, aircraft_rates_inclusive: next }))
                          }}
                        >
                          Clear
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="px-4 pb-4">
                    {!aircraftTypes.length ? (
                      <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/60 p-6 text-center">
                        <p className="text-sm font-semibold text-slate-900">No aircraft types found</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Add aircraft types first to configure overrides.
                        </p>
                      </div>
                    ) : (
                      <div className="max-h-[260px] overflow-y-auto rounded-xl border border-slate-200">
                        {aircraftTypes.map((aircraftType, index) => {
                          const value = form.aircraft_rates_inclusive[aircraftType.id] ?? ""
                          const isUsingDefault = !value.trim().length
                          return (
                            <div
                              key={aircraftType.id}
                              className={cn(
                                "flex items-center gap-3 px-3 py-2",
                                index === 0 ? "" : "border-t border-slate-200"
                              )}
                            >
                              <p className="flex-1 truncate text-sm font-medium text-slate-900">
                                {aircraftType.name}
                              </p>
                              <Input
                                value={value}
                                onChange={(e) =>
                                  setForm((prev) => ({
                                    ...prev,
                                    aircraft_rates_inclusive: {
                                      ...prev.aircraft_rates_inclusive,
                                      [aircraftType.id]: e.target.value,
                                    },
                                  }))
                                }
                                type="number"
                                min={0}
                                step="0.01"
                                className="h-9 w-[120px] rounded-xl border-slate-200 bg-white tabular-nums shadow-none"
                                placeholder="0.00"
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-9 rounded-xl px-3 text-slate-700 shadow-none disabled:text-slate-400"
                                disabled={isUsingDefault}
                                onClick={() =>
                                  setForm((prev) => ({
                                    ...prev,
                                    aircraft_rates_inclusive: {
                                      ...prev.aircraft_rates_inclusive,
                                      [aircraftType.id]: "",
                                    },
                                  }))
                                }
                                title="Use default"
                              >
                                Reset
                              </Button>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </details>
              </div>

              <div className="border-t border-border/40 bg-white px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  {isDirty ? (
                    <Badge className="border-amber-200 bg-amber-50 text-amber-700" variant="outline">
                      Unsaved changes
                    </Badge>
                  ) : (
                    <Badge className="border-slate-200 bg-white text-slate-600" variant="outline">
                      Saved
                    </Badge>
                  )}

                  <div className="flex items-center justify-end gap-2">
                    {isDirty ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="shadow-none"
                        onClick={onUndo}
                        disabled={saving}
                      >
                        Undo
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      size="sm"
                      className="bg-slate-900 font-semibold text-white shadow-none hover:bg-slate-800"
                      onClick={() => void handleSave()}
                      disabled={!canSave}
                    >
                      {saving ? <IconLoader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
                      {saving ? "Saving…" : createMode ? "Create" : "Save"}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
