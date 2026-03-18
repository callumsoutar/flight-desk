"use client"

import * as React from "react"
import {
  IconInfoCircle,
  IconLoader2,
  IconPencil,
  IconPlus,
  IconReceiptTax,
  IconSearch,
} from "@tabler/icons-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
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

  const [addOpen, setAddOpen] = React.useState(false)
  const [editOpen, setEditOpen] = React.useState(false)
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [form, setForm] = React.useState<LandingFeeFormData>(() => createBlankFormData())

  const editingFee = React.useMemo(
    () => (editingId ? landingFees.find((fee) => fee.id === editingId) ?? null : null),
    [editingId, landingFees]
  )

  const filteredFees = React.useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    if (!term) return landingFees
    return landingFees.filter((fee) => {
      const haystack = [fee.name, fee.description ?? ""].join(" ").toLowerCase()
      return haystack.includes(term)
    })
  }, [landingFees, searchTerm])

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

  const canSubmit = React.useMemo(() => {
    if (saving) return false
    if (!normalizeName(form.name).length) return false
    const defaultInclusive = parseOptionalNumber(form.default_rate_inclusive)
    if (defaultInclusive == null || defaultInclusive < 0) return false
    return true
  }, [form.default_rate_inclusive, form.name, saving])

  const handleCreate = async () => {
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

      await load()
      setAddOpen(false)
      setForm(createBlankFormData())
      toast.success("Landing fee created")
    } catch (err) {
      toast.error(getErrorMessage(err))
      setError(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const handleUpdate = async () => {
    if (!editingFee) return
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

      const response = await fetch("/api/landing-fees", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: editingFee.id,
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
        chargeableId: editingFee.id,
        existingRates: editingFee.landing_fee_rates ?? [],
        formData: form,
      })

      await load()
      setEditOpen(false)
      setEditingId(null)
      setForm(createBlankFormData())
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

      await load()
      setEditOpen(false)
      setEditingId(null)
      toast.success("Landing fee deactivated")
    } catch (err) {
      toast.error(getErrorMessage(err))
      setError(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

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

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <IconSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search landing fees..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-10 rounded-xl border-slate-200 bg-white pl-9 shadow-none focus-visible:ring-0"
            disabled={loading}
          />
        </div>

        <Dialog
          open={addOpen}
          onOpenChange={(open) => {
            setAddOpen(open)
            if (open) {
              setForm(createBlankFormData())
              setError(null)
            }
          }}
        >
          <Button
            size="sm"
            onClick={() => setAddOpen(true)}
            disabled={loading || saving}
            className="h-10 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm shadow-indigo-100 transition-all active:scale-[0.98] whitespace-nowrap font-semibold border-none"
          >
            <IconPlus className="mr-1 h-4 w-4" />
            Add landing fee
          </Button>

          <DialogContent
            className={cn(
              "p-0 border-none shadow-2xl rounded-[24px] overflow-hidden",
              "w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] sm:w-full sm:max-w-[620px]",
              "top-[calc(env(safe-area-inset-top)+1rem)] sm:top-[50%] translate-y-0 sm:translate-y-[-50%]",
              "h-[calc(100dvh-2rem)] sm:flex sm:flex-col sm:h-auto sm:max-h-[calc(100dvh-4rem)]"
            )}
          >
            <div className="flex flex-col flex-1 min-h-0 bg-white">
              <DialogHeader className="px-6 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-4 text-left sm:pt-6 shrink-0">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
                    <IconReceiptTax className="h-5 w-5" />
                  </div>
                  <div>
                    <DialogTitle className="text-xl font-bold tracking-tight text-slate-900">
                      Add Landing Fee
                    </DialogTitle>
                    <DialogDescription className="mt-0.5 text-sm text-slate-500">
                      Create a landing fee location with a default rate. Required fields are marked with{" "}
                      <span className="text-destructive">*</span>.
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-6 pb-6">
                <LandingFeeFormFields
                  form={form}
                  setForm={setForm}
                  aircraftTypes={aircraftTypes}
                  taxRate={taxRate}
                  saving={saving}
                  applyTaxableToggle={applyTaxableToggle}
                />
              </div>

              <div className="shrink-0 border-t bg-white px-6 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-[0_-4px_12px_rgba(0,0,0,0.05)] sm:pb-4">
                <div className="flex items-center justify-between gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setAddOpen(false)}
                    className="h-10 flex-1 rounded-xl border-slate-200 bg-white text-xs font-bold text-slate-700 shadow-none hover:bg-slate-50"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => void handleCreate()}
                    disabled={saving || !canSubmit}
                    className="h-10 flex-[1.4] rounded-xl bg-slate-900 text-xs font-bold text-white shadow-lg shadow-slate-900/10 hover:bg-slate-800"
                  >
                    {saving ? <IconLoader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
                    Create Landing Fee
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead className="text-right">Default rate (incl.)</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-10">
                  Loading landing fees…
                </TableCell>
              </TableRow>
            ) : filteredFees.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-10">
                  {searchTerm ? "No landing fees match your search." : "No landing fees configured yet."}
                </TableCell>
              </TableRow>
            ) : (
              filteredFees.map((fee) => {
                const defaultInclusive = formatRateInclusive(fee.rate, taxRate, fee.is_taxable)
                return (
                  <TableRow key={fee.id}>
                    <TableCell>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{fee.name}</p>
                        {fee.description ? (
                          <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{fee.description}</p>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-sm font-semibold tabular-nums text-slate-900">${defaultInclusive}</span>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs",
                          fee.is_active
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-slate-200 bg-white text-slate-600"
                        )}
                      >
                        {fee.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => {
                          setEditingId(fee.id)
                          setForm(createEditFormData(fee, aircraftTypes, taxRate))
                          setError(null)
                          setEditOpen(true)
                        }}
                        className="h-9 w-9 rounded-xl border-slate-200 text-slate-700 shadow-none hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
                      >
                        <IconPencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open)
          if (!open) {
            setEditingId(null)
            setForm(createBlankFormData())
            setError(null)
          }
        }}
      >
        <DialogContent
          className={cn(
            "p-0 border-none shadow-2xl rounded-[24px] overflow-hidden",
            "w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] sm:w-full sm:max-w-[620px]",
            "top-[calc(env(safe-area-inset-top)+1rem)] sm:top-[50%] translate-y-0 sm:translate-y-[-50%]",
            "h-[calc(100dvh-2rem)] sm:flex sm:flex-col sm:h-auto sm:max-h-[calc(100dvh-4rem)]"
          )}
        >
          <div className="flex flex-col flex-1 min-h-0 bg-white">
            <DialogHeader className="px-6 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-4 text-left sm:pt-6 shrink-0">
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
                  <IconPencil className="h-5 w-5" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-bold tracking-tight text-slate-900">
                    Edit Landing Fee
                  </DialogTitle>
                  <DialogDescription className="mt-0.5 text-sm text-slate-500">
                    Update default and per-aircraft rates. Required fields are marked with{" "}
                    <span className="text-destructive">*</span>.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-6 pb-6">
              <LandingFeeFormFields
                form={form}
                setForm={setForm}
                aircraftTypes={aircraftTypes}
                taxRate={taxRate}
                saving={saving}
                applyTaxableToggle={applyTaxableToggle}
              />
            </div>

            <div className="shrink-0 border-t bg-white px-6 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-[0_-4px_12px_rgba(0,0,0,0.05)] sm:pb-4">
              <div className="flex items-center justify-between gap-3">
                {editingFee?.is_active ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => editingFee && void handleDeactivate(editingFee)}
                    disabled={saving}
                    className="h-10 rounded-xl border-orange-200 text-orange-600 text-xs font-bold shadow-none hover:bg-orange-50 hover:text-orange-700"
                  >
                    Deactivate
                  </Button>
                ) : (
                  <div />
                )}
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setEditOpen(false)
                      setEditingId(null)
                      setForm(createBlankFormData())
                      setError(null)
                    }}
                    className="h-10 rounded-xl border-slate-200 bg-white text-xs font-bold text-slate-700 shadow-none hover:bg-slate-50"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => void handleUpdate()}
                    disabled={saving || !canSubmit}
                    className="h-10 rounded-xl bg-slate-900 text-xs font-bold text-white shadow-lg shadow-slate-900/10 hover:bg-slate-800"
                  >
                    {saving ? <IconLoader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
                    Save Changes
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

type LandingFeeFormFieldsProps = {
  form: LandingFeeFormData
  setForm: React.Dispatch<React.SetStateAction<LandingFeeFormData>>
  aircraftTypes: AircraftTypesRow[]
  taxRate: number
  saving: boolean
  applyTaxableToggle: (current: LandingFeeFormData, nextIsTaxable: boolean) => LandingFeeFormData
}

function LandingFeeFormFields({
  form,
  setForm,
  aircraftTypes,
  taxRate,
  saving,
  applyTaxableToggle,
}: LandingFeeFormFieldsProps) {
  const [descriptionOpen, setDescriptionOpen] = React.useState(false)
  const [overridesOpen, setOverridesOpen] = React.useState(true)

  return (
    <div className="space-y-5">
      <div>
        <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Name <span className="text-destructive">*</span>
        </label>
        <Input
          value={form.name}
          onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
          className="h-11 rounded-xl border-slate-200 bg-white px-3 text-[15px] shadow-none transition-colors focus-visible:ring-0"
          placeholder="e.g. NZPP Landing Fee"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Price <span className="text-destructive">*</span>
        </label>
        <Input
          value={form.default_rate_inclusive}
          onChange={(e) => setForm((prev) => ({ ...prev, default_rate_inclusive: e.target.value }))}
          type="number"
          min={0}
          step="0.01"
          className="h-11 rounded-xl border-slate-200 bg-white px-3 text-[15px] tabular-nums shadow-none transition-colors focus-visible:ring-0"
          placeholder="0.00"
        />
        <p className="mt-1 text-[11px] text-slate-500">
          Entered price is tax inclusive. Default tax rate: {(taxRate * 100).toFixed(0)}%
        </p>
      </div>

      <TooltipProvider delayDuration={0}>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="flex items-center justify-between rounded-xl border border-slate-200 px-3.5 py-2.5">
            <div className="flex items-center gap-1.5">
              <Label className="text-sm font-semibold text-slate-900 leading-none">Includes tax</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" className="text-slate-400 transition-colors hover:text-slate-600">
                    <IconInfoCircle className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[240px] text-[11px] leading-tight">
                  Applies the default tax rate to this landing fee and all overrides.
                </TooltipContent>
              </Tooltip>
            </div>
            <Switch
              checked={form.is_taxable}
              onCheckedChange={(checked) => setForm((prev) => applyTaxableToggle(prev, checked))}
              disabled={saving}
            />
          </div>

          <div className="flex items-center justify-between rounded-xl border border-slate-200 px-3.5 py-2.5">
            <div className="flex items-center gap-1.5">
              <Label className="text-sm font-semibold text-slate-900 leading-none">Active</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" className="text-slate-400 transition-colors hover:text-slate-600">
                    <IconInfoCircle className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[220px] text-[11px] leading-tight">
                  Whether this landing fee is available for selection.
                </TooltipContent>
              </Tooltip>
            </div>
            <Switch
              checked={form.is_active}
              onCheckedChange={(checked) => setForm((prev) => ({ ...prev, is_active: checked }))}
              disabled={saving}
            />
          </div>
        </div>
      </TooltipProvider>

      <Collapsible open={overridesOpen} onOpenChange={setOverridesOpen}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg px-1 py-0.5 text-sm font-semibold text-blue-600 transition-colors hover:text-blue-700"
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-blue-600">
              <IconPlus className="h-3.5 w-3.5" />
            </span>
            {overridesOpen ? "Hide aircraft overrides" : "Add aircraft overrides"}
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3">
          <div className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">Leave blank to use the default rate.</p>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  className="h-8 rounded-xl bg-indigo-600 px-3 text-xs font-semibold text-white shadow-sm shadow-indigo-200 hover:bg-indigo-700"
                  disabled={!aircraftTypes.length}
                  onClick={() => {
                    const next: Record<string, string> = {}
                    const normalized = normalizeRateInput(form.default_rate_inclusive)
                    for (const aircraftType of aircraftTypes) {
                      next[aircraftType.id] = normalized
                    }
                    setForm((prev) => ({ ...prev, aircraft_rates_inclusive: next }))
                  }}
                >
                  Fill all
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-8 rounded-xl border-rose-200 bg-rose-50 px-3 text-xs font-semibold text-rose-700 shadow-none hover:bg-rose-100 hover:text-rose-800"
                  disabled={!aircraftTypes.length}
                  onClick={() => {
                    const next: Record<string, string> = {}
                    for (const aircraftType of aircraftTypes) {
                      next[aircraftType.id] = ""
                    }
                    setForm((prev) => ({ ...prev, aircraft_rates_inclusive: next }))
                  }}
                >
                  Clear all
                </Button>
              </div>
            </div>

            {!aircraftTypes.length ? (
              <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/60 p-6 text-center">
                <p className="text-sm font-semibold text-slate-900">No aircraft types found</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Add aircraft types first to configure overrides.
                </p>
              </div>
            ) : (
              <div className="max-h-[260px] overflow-y-auto rounded-xl border border-slate-200 bg-white">
                {aircraftTypes.map((aircraftType, index) => {
                  const value = form.aircraft_rates_inclusive[aircraftType.id] ?? ""
                  const isUsingDefault = !value.trim().length
                  return (
                    <div
                      key={aircraftType.id}
                      className={cn("flex items-center gap-3 px-3 py-2", index === 0 ? "" : "border-t border-slate-200")}
                    >
                      <p className="flex-1 truncate text-sm font-medium text-slate-900">{aircraftType.name}</p>
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
                        variant="ghost"
                        size="sm"
                        className="h-9 rounded-lg px-2.5 text-xs font-semibold text-slate-500 shadow-none hover:bg-slate-100 hover:text-slate-700 disabled:text-slate-300"
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
        </CollapsibleContent>
      </Collapsible>

      <Collapsible open={descriptionOpen} onOpenChange={setDescriptionOpen}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg px-1 py-0.5 text-sm font-semibold text-blue-600 transition-colors hover:text-blue-700"
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-blue-600">
              <IconPlus className="h-3.5 w-3.5" />
            </span>
            {descriptionOpen ? "Hide description" : "Add description"}
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3">
          <div>
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Description
            </label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              className="rounded-xl border-slate-200 bg-white px-3 py-2 text-[15px] shadow-none transition-colors focus-visible:ring-0"
              placeholder="Optional notes shown to staff."
              rows={3}
            />
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}
