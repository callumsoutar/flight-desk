"use client"

import * as React from "react"
import {
  IconCashBanknote,
  IconFilter,
  IconLoader2,
  IconPlus,
  IconSearch,
} from "@tabler/icons-react"
import { toast } from "sonner"

import { XeroTaxTypeSelect } from "@/components/settings/xero-tax-type-select"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import type { ChargeablesRow, ChargeableTypesRow } from "@/lib/types/tables"
import { cn } from "@/lib/utils"

type ChargeableTypeLite = Pick<ChargeableTypesRow, "id" | "code" | "name" | "gl_code">

type Chargeable = Pick<
  ChargeablesRow,
  | "id"
  | "name"
  | "description"
  | "rate"
  | "xero_tax_type"
  | "is_taxable"
  | "is_active"
  | "chargeable_type_id"
  | "updated_at"
> & {
  chargeable_type: ChargeableTypeLite | null
}

type ChargeableFormData = {
  name: string
  description: string
  chargeable_type_id: string
  rate_inclusive: string
  xero_tax_type: string
  is_taxable: boolean
  is_active: boolean
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

function createBlankFormData(): ChargeableFormData {
  return {
    name: "",
    description: "",
    chargeable_type_id: "",
    rate_inclusive: "",
    xero_tax_type: "",
    is_taxable: true,
    is_active: true,
  }
}

async function fetchChargeables(): Promise<Chargeable[]> {
  const response = await fetch("/api/chargeables?include_inactive=true&exclude_type_code=landing_fees", {
    cache: "no-store",
  })
  if (!response.ok) {
    const data = await response.json().catch(() => null)
    const message =
      data && typeof data === "object" && typeof data.error === "string"
        ? data.error
        : "Failed to load chargeables"
    throw new Error(message)
  }

  const data = (await response.json().catch(() => null)) as { chargeables?: unknown } | null
  return Array.isArray(data?.chargeables) ? (data?.chargeables as Chargeable[]) : []
}

async function fetchChargeableTypes(): Promise<ChargeableTypeLite[]> {
  const response = await fetch("/api/chargeable_types?is_active=true&exclude_code=landing_fees", {
    cache: "no-store",
  })
  if (!response.ok) return []
  const data = (await response.json().catch(() => null)) as { chargeable_types?: unknown } | null
  return Array.isArray(data?.chargeable_types) ? (data?.chargeable_types as ChargeableTypeLite[]) : []
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

function createEditFormData(chargeable: Chargeable, taxRate: number): ChargeableFormData {
  const itemTaxRate = chargeable.is_taxable ? taxRate : 0
  const rateExclusive = Number.isFinite(chargeable.rate) ? Number(chargeable.rate) : 0
  const rateInclusive = exclusiveToInclusive(rateExclusive, itemTaxRate)
  return {
    name: chargeable.name ?? "",
    description: chargeable.description ?? "",
    chargeable_type_id: chargeable.chargeable_type_id ?? "",
    rate_inclusive: roundToTwoDecimals(rateInclusive).toFixed(2),
    xero_tax_type: chargeable.xero_tax_type ?? "",
    is_taxable: chargeable.is_taxable ?? true,
    is_active: chargeable.is_active ?? true,
  }
}

export function ChargeablesConfig() {
  const [chargeables, setChargeables] = React.useState<Chargeable[]>([])
  const [chargeableTypes, setChargeableTypes] = React.useState<ChargeableTypeLite[]>([])
  const [taxRate, setTaxRate] = React.useState(0.15)

  const [loading, setLoading] = React.useState(true)
  const [xeroEnabled, setXeroEnabled] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const [searchTerm, setSearchTerm] = React.useState("")
  const [filterTypeId, setFilterTypeId] = React.useState<string>("all")

  const [selectedChargeableId, setSelectedChargeableId] = React.useState<string | null>(null)
  const [createMode, setCreateMode] = React.useState(false)
  const [descriptionOpen, setDescriptionOpen] = React.useState(false)

  const [baseForm, setBaseForm] = React.useState<ChargeableFormData | null>(null)
  const [form, setForm] = React.useState<ChargeableFormData>(() => createBlankFormData())

  const selectedChargeable = React.useMemo(
    () => (selectedChargeableId ? chargeables.find((item) => item.id === selectedChargeableId) ?? null : null),
    [chargeables, selectedChargeableId]
  )

  const load = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [items, types, nextTaxRate] = await Promise.all([
        fetchChargeables(),
        fetchChargeableTypes(),
        fetchDefaultTaxRate(),
      ])
      setChargeables(items)
      setChargeableTypes(types)
      setTaxRate(nextTaxRate)
      return { items, types, taxRate: nextTaxRate }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load chargeables")
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void load()
  }, [load])

  React.useEffect(() => {
    void (async () => {
      const response = await fetch("/api/xero/status", { cache: "no-store" })
      if (!response.ok) return
      const body = (await response.json().catch(() => null)) as { enabled?: boolean } | null
      setXeroEnabled(Boolean(body?.enabled))
    })()
  }, [])

  const resetEditorToBlank = React.useCallback(() => {
    const blank = createBlankFormData()
    setBaseForm(blank)
    setForm(blank)
    setDescriptionOpen(false)
  }, [])

  const hydrateEditorForChargeable = React.useCallback(
    (item: Chargeable) => {
      const next = createEditFormData(item, taxRate)
      setSelectedChargeableId(item.id)
      setCreateMode(false)
      setBaseForm(next)
      setForm(next)
      setDescriptionOpen(Boolean(normalizeDescription(next.description)))
    },
    [taxRate]
  )

  const hydrateEditorFromFreshLoad = React.useCallback((id: string, items: Chargeable[], nextTaxRate: number) => {
    const found = items.find((candidate) => candidate.id === id) ?? null
    if (!found) {
      setSelectedChargeableId(null)
      setCreateMode(false)
      setBaseForm(null)
      return
    }
    const next = createEditFormData(found, nextTaxRate)
    setSelectedChargeableId(found.id)
    setCreateMode(false)
    setBaseForm(next)
    setForm(next)
    setDescriptionOpen(Boolean(normalizeDescription(next.description)))
  }, [])

  const isDirty = React.useMemo(() => {
    if (!baseForm) return false
    if (normalizeName(form.name) !== normalizeName(baseForm.name)) return true
    if (normalizeDescription(form.description) !== normalizeDescription(baseForm.description)) return true
    if (form.chargeable_type_id !== baseForm.chargeable_type_id) return true
    if (form.is_taxable !== baseForm.is_taxable) return true
    if (form.is_active !== baseForm.is_active) return true
    if (xeroEnabled && form.xero_tax_type.trim() !== baseForm.xero_tax_type.trim()) return true
    if (normalizeRateInput(form.rate_inclusive) !== normalizeRateInput(baseForm.rate_inclusive)) return true
    return false
  }, [baseForm, form, xeroEnabled])

  const confirmDiscardIfNeeded = React.useCallback(() => {
    if (!isDirty) return true
    return window.confirm("Discard your unsaved changes?")
  }, [isDirty])

  const startCreate = React.useCallback(() => {
    setSelectedChargeableId(null)
    setCreateMode(true)
    resetEditorToBlank()
  }, [resetEditorToBlank])

  const onStartCreate = React.useCallback(() => {
    if (!confirmDiscardIfNeeded()) return
    startCreate()
  }, [confirmDiscardIfNeeded, startCreate])

  const onSelectChargeable = React.useCallback(
    (item: Chargeable) => {
      if (!confirmDiscardIfNeeded()) return
      hydrateEditorForChargeable(item)
    },
    [confirmDiscardIfNeeded, hydrateEditorForChargeable]
  )

  const applyTaxableToggle = React.useCallback(
    (current: ChargeableFormData, nextIsTaxable: boolean) => {
      const currentTaxRate = current.is_taxable ? taxRate : 0
      const nextTaxRate = nextIsTaxable ? taxRate : 0

      const rateInclusive = parseOptionalNumber(current.rate_inclusive)
      const rateExclusive = rateInclusive == null ? null : inclusiveToExclusive(rateInclusive, currentTaxRate)
      const nextInclusive =
        rateExclusive == null ? "" : roundToTwoDecimals(exclusiveToInclusive(rateExclusive, nextTaxRate)).toFixed(2)

      return { ...current, is_taxable: nextIsTaxable, rate_inclusive: nextInclusive }
    },
    [taxRate]
  )

  const onUndo = React.useCallback(() => {
    if (!baseForm) return
    setForm(baseForm)
    setError(null)
  }, [baseForm])

  const canSave = React.useMemo(() => {
    if (saving) return false
    if (!isDirty) return false
    if (!normalizeName(form.name).length) return false
    if (!form.chargeable_type_id) return false
    const rateInclusive = parseOptionalNumber(form.rate_inclusive)
    if (rateInclusive == null || rateInclusive < 0) return false
    return true
  }, [form.chargeable_type_id, form.name, form.rate_inclusive, isDirty, saving])

  const handleDeactivate = React.useCallback(
    async (item: Chargeable) => {
      if (!item.is_active) return
      const confirmed = window.confirm(`Deactivate "${item.name}"? It will no longer be available for new use.`)
      if (!confirmed) return

      setSaving(true)
      setError(null)
      try {
        const response = await fetch(`/api/chargeables?id=${encodeURIComponent(item.id)}`, {
          method: "DELETE",
        })
        if (!response.ok) {
          const data = await response.json().catch(() => null)
          const message =
            data && typeof data === "object" && typeof data.error === "string"
              ? data.error
              : "Failed to deactivate chargeable"
          throw new Error(message)
        }

        const loaded = await load()
        if (loaded) {
          hydrateEditorFromFreshLoad(item.id, loaded.items, loaded.taxRate)
        }
        toast.success("Chargeable deactivated")
      } catch (err) {
        toast.error(getErrorMessage(err))
        setError(getErrorMessage(err))
      } finally {
        setSaving(false)
      }
    },
    [hydrateEditorFromFreshLoad, load]
  )

  const handleSave = async () => {
    if (!normalizeName(form.name).length) return
    if (!form.chargeable_type_id) return

    const rateInclusive = parseOptionalNumber(form.rate_inclusive)
    if (rateInclusive == null || rateInclusive < 0) {
      setError("Rate is required.")
      return
    }

    setSaving(true)
    setError(null)
    try {
      const itemTaxRate = form.is_taxable ? taxRate : 0
      const rateExclusive = roundToTwoDecimals(inclusiveToExclusive(rateInclusive, itemTaxRate))

      if (createMode) {
        const response = await fetch("/api/chargeables", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name: normalizeName(form.name),
            description: normalizeDescription(form.description),
            chargeable_type_id: form.chargeable_type_id,
            is_taxable: form.is_taxable,
            is_active: form.is_active,
            rate: rateExclusive,
            xero_tax_type: xeroEnabled ? form.xero_tax_type.trim() || null : null,
          }),
        })
        if (!response.ok) {
          const data = await response.json().catch(() => null)
          const message =
            data && typeof data === "object" && typeof data.error === "string"
              ? data.error
              : "Failed to create chargeable"
          throw new Error(message)
        }

        const result = (await response.json().catch(() => null)) as { chargeable?: { id?: unknown } } | null
        const createdId =
          result && typeof result.chargeable?.id === "string" ? result.chargeable.id : null

        const loaded = await load()
        if (loaded && createdId) {
          hydrateEditorFromFreshLoad(createdId, loaded.items, loaded.taxRate)
        }
        toast.success("Chargeable created")
        return
      }

      if (!selectedChargeable) return

      const response = await fetch("/api/chargeables", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: selectedChargeable.id,
          name: normalizeName(form.name),
          description: normalizeDescription(form.description),
          chargeable_type_id: form.chargeable_type_id,
          is_taxable: form.is_taxable,
          is_active: form.is_active,
          rate: rateExclusive,
          xero_tax_type: xeroEnabled ? form.xero_tax_type.trim() || null : null,
        }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => null)
        const message =
          data && typeof data === "object" && typeof data.error === "string"
            ? data.error
            : "Failed to update chargeable"
        throw new Error(message)
      }

      const loaded = await load()
      if (loaded) {
        hydrateEditorFromFreshLoad(selectedChargeable.id, loaded.items, loaded.taxRate)
      } else {
        hydrateEditorForChargeable(selectedChargeable)
      }
      toast.success("Chargeable updated")
    } catch (err) {
      toast.error(getErrorMessage(err))
      setError(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const filteredChargeables = React.useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    const matchesSearch = (item: Chargeable) => {
      const typeName = item.chargeable_type?.name ?? ""
      const haystack = [item.name, item.description ?? "", typeName].join(" ").toLowerCase()
      return !term || haystack.includes(term)
    }

    const matchesType = (item: Chargeable) => {
      if (filterTypeId === "all") return true
      return item.chargeable_type_id === filterTypeId
    }

    return chargeables.filter((item) => matchesSearch(item) && matchesType(item))
  }, [chargeables, filterTypeId, searchTerm])

  const groupedChargeables = React.useMemo(() => {
    const groups = new Map<string, Chargeable[]>()
    for (const item of filteredChargeables) {
      const key = item.chargeable_type?.name ?? "Uncategorized"
      const existing = groups.get(key) ?? []
      existing.push(item)
      groups.set(key, existing)
    }
    return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  }, [filteredChargeables])

  const showEditor = createMode || Boolean(selectedChargeable) || Boolean(selectedChargeableId && baseForm)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
        <IconCashBanknote className="h-5 w-5 text-indigo-600" />
        <h3 className="text-lg font-semibold text-slate-900">Additional charges</h3>
      </div>
      <p className="text-sm text-slate-600">
        Configure reusable chargeables (excludes landing fees). Rates are shown tax inclusive.
      </p>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="rounded-2xl border border-slate-200 bg-white flex flex-col lg:h-[640px] lg:col-span-2">
          <div className="border-b border-border/40 p-4">
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative w-full">
                  <IconSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    placeholder="Search chargeables..."
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

              <Select value={filterTypeId} onValueChange={setFilterTypeId}>
                <SelectTrigger className="h-10 w-full rounded-xl border-slate-200 bg-white shadow-none focus:ring-0">
                  <div className="flex items-center gap-2">
                    <IconFilter className="h-4 w-4 text-slate-400" />
                    <SelectValue placeholder="Filter by type" />
                  </div>
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="all">All types</SelectItem>
                  {chargeableTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {loading ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-muted-foreground">
                Loading chargeables…
              </div>
            ) : filteredChargeables.length === 0 ? (
              <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/60 p-10 text-center">
                <p className="text-sm font-semibold text-slate-900">
                  {searchTerm ? "No matching chargeables" : "No chargeables configured"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Add a chargeable to create reusable invoice/check-in items.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {groupedChargeables.map(([groupName, groupItems]) => (
                  <div key={groupName} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                    <div className="border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
                      {groupName}
                    </div>
                    {groupItems.map((item, index) => {
                      const isSelected = selectedChargeableId === item.id && !createMode
                      const itemTaxRate = item.is_taxable ? taxRate : 0
                      const rateExclusive = Number.isFinite(item.rate) ? Number(item.rate) : 0
                      const rateInclusive = roundToTwoDecimals(exclusiveToInclusive(rateExclusive, itemTaxRate)).toFixed(2)
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => onSelectChargeable(item)}
                          className={cn(
                            "w-full px-4 py-3 text-left transition-colors",
                            index === 0 ? "" : "border-t border-slate-200",
                            isSelected ? "bg-slate-50" : "bg-white hover:bg-slate-50"
                          )}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="truncate text-sm font-semibold text-slate-900">{item.name}</p>
                                {item.is_active ? null : (
                                  <Badge variant="outline" className="border-slate-200 bg-white text-slate-600">
                                    Inactive
                                  </Badge>
                                )}
                              </div>
                              {item.description ? (
                                <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{item.description}</p>
                              ) : null}
                            </div>

                            <div className="flex shrink-0 flex-col items-end gap-0.5 text-right">
                              <p className="text-sm font-semibold tabular-nums text-slate-900">{rateInclusive}</p>
                              <p className="text-xs text-muted-foreground">
                                {item.is_taxable ? "Taxable" : "Non-taxable"}
                              </p>
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white lg:h-[640px] lg:col-span-3">
          {!showEditor ? (
            <div className="flex h-full items-center justify-center p-10">
              <div className="text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50">
                  <IconCashBanknote className="h-6 w-6 text-slate-600" />
                </div>
                <p className="mt-4 text-sm font-semibold text-slate-900">
                  {chargeables.length ? "Select a chargeable to edit" : "No chargeables yet"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {chargeables.length
                    ? "Choose an item from the list to update details and pricing."
                    : "Create your first additional chargeable to get started."}
                </p>
                <Button
                  className="mt-5 h-10 rounded-xl bg-slate-900 font-semibold text-white hover:bg-slate-800"
                  onClick={onStartCreate}
                  disabled={loading || saving}
                >
                  <IconPlus className="mr-2 h-4 w-4" />
                  Add chargeable
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex h-full flex-col">
              <div className="border-b border-border/40 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-lg font-semibold text-slate-900">
                        {createMode ? "New chargeable" : "Chargeable details"}
                      </h4>
                      {createMode ? (
                        <Badge className="border-indigo-200 bg-indigo-50 text-indigo-700" variant="outline">
                          New
                        </Badge>
                      ) : selectedChargeable?.is_active ? (
                        <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700" variant="outline">
                          Active
                        </Badge>
                      ) : (
                        <Badge className="border-slate-200 bg-white text-slate-600" variant="outline">
                          Inactive
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {createMode ? "Create a chargeable with a default rate." : "Update details and default rate."}
                    </p>
                    <p className="text-[11px] font-medium text-slate-500">
                      Default tax rate: {(taxRate * 100).toFixed(0)}%
                    </p>
                  </div>

                  {!createMode && selectedChargeable ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9 rounded-xl text-orange-600 hover:bg-orange-50 hover:text-orange-700"
                      onClick={() => void handleDeactivate(selectedChargeable)}
                      disabled={saving || !selectedChargeable.is_active}
                      title="Deactivate"
                    >
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
                        setSelectedChargeableId(null)
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
                      placeholder="e.g. Airways Fee"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Type <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={form.chargeable_type_id}
                      onValueChange={(value) => setForm((prev) => ({ ...prev, chargeable_type_id: value }))}
                    >
                      <SelectTrigger className="h-10 w-full rounded-xl border-slate-200 bg-white shadow-none focus:ring-0">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        {chargeableTypes.map((type) => (
                          <SelectItem key={type.id} value={type.id}>
                            {type.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {xeroEnabled ? (
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Chargeable type GL code
                    </Label>
                    <Input
                      value={
                        chargeableTypes.find((type) => type.id === form.chargeable_type_id)?.gl_code ?? ""
                      }
                      readOnly
                      className="h-10 rounded-xl border-slate-200 bg-slate-50 text-slate-600"
                      placeholder="Configure on chargeable type"
                    />
                    <p className="text-xs text-muted-foreground">
                      GL code is inherited from the selected chargeable type.
                    </p>
                  </div>
                ) : null}

                {xeroEnabled ? (
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Xero tax type
                    </Label>
                    <XeroTaxTypeSelect
                      value={form.xero_tax_type}
                      onChange={(taxType) =>
                        setForm((prev) => ({ ...prev, xero_tax_type: taxType }))
                      }
                      placeholder="Select tax type (optional)"
                      disabled={saving}
                      includeNoneOption={true}
                      className="h-10 rounded-xl border-slate-200 bg-white"
                    />
                    <p className="text-xs text-muted-foreground">
                      Leave blank to use the default from Settings → Integrations.
                    </p>
                  </div>
                ) : null}

                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Default rate (tax inclusive) <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    value={form.rate_inclusive}
                    onChange={(e) => setForm((prev) => ({ ...prev, rate_inclusive: e.target.value }))}
                    type="number"
                    min={0}
                    step="0.01"
                    className="h-10 rounded-xl border-slate-200 bg-white tabular-nums"
                    placeholder="0.00"
                  />
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
                      <p className="mt-1 text-xs text-muted-foreground">Available for use.</p>
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
