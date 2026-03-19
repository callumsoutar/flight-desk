"use client"

import * as React from "react"
import {
  IconCashBanknote,
  IconChevronLeft,
  IconChevronRight,
  IconFilter,
  IconLoader2,
  IconPencil,
  IconPlus,
  IconSearch,
} from "@tabler/icons-react"
import { toast } from "sonner"

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
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
  is_taxable: boolean
  is_active: boolean
}

type ChargeablesResponse = {
  chargeables: Chargeable[]
  total: number
  page: number
  pageSize: number
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message
  return "Something went wrong."
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

function normalizeName(value: string) {
  return value.trim().replaceAll(/\s+/g, " ")
}

function normalizeDescription(value: string) {
  return value.trim()
}


function createBlankFormData(): ChargeableFormData {
  return {
    name: "",
    description: "",
    chargeable_type_id: "",
    rate_inclusive: "",
    is_taxable: true,
    is_active: true,
  }
}

async function fetchChargeables(params: {
  page: number
  pageSize: number
  searchTerm: string
  filterTypeId: string
}): Promise<ChargeablesResponse> {
  const query = new URLSearchParams({
    include_inactive: "true",
    exclude_type_code: "landing_fees",
    page: String(params.page),
    page_size: String(params.pageSize),
  })
  if (params.searchTerm.trim()) query.set("search", params.searchTerm.trim())
  if (params.filterTypeId !== "all") query.set("type_id", params.filterTypeId)

  const response = await fetch(`/api/chargeables?${query.toString()}`, {
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

  const data = (await response.json().catch(() => null)) as {
    chargeables?: unknown
    total?: unknown
    page?: unknown
    page_size?: unknown
  } | null
  return {
    chargeables: Array.isArray(data?.chargeables) ? (data?.chargeables as Chargeable[]) : [],
    total: typeof data?.total === "number" && Number.isFinite(data.total) ? data.total : 0,
    page: typeof data?.page === "number" && Number.isFinite(data.page) ? data.page : params.page,
    pageSize:
      typeof data?.page_size === "number" && Number.isFinite(data.page_size) ? data.page_size : params.pageSize,
  }
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
    is_taxable: chargeable.is_taxable ?? true,
    is_active: chargeable.is_active ?? true,
  }
}

export function ChargeablesConfig() {
  const PAGE_SIZE = 25
  const [chargeables, setChargeables] = React.useState<Chargeable[]>([])
  const [totalChargeables, setTotalChargeables] = React.useState(0)
  const [chargeableTypes, setChargeableTypes] = React.useState<ChargeableTypeLite[]>([])
  const [taxRate, setTaxRate] = React.useState(0.15)

  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const [searchTerm, setSearchTerm] = React.useState("")
  const [debouncedSearchTerm, setDebouncedSearchTerm] = React.useState("")
  const [filterTypeId, setFilterTypeId] = React.useState<string>("all")
  const [page, setPage] = React.useState(1)

  const [addOpen, setAddOpen] = React.useState(false)
  const [editOpen, setEditOpen] = React.useState(false)
  const [editingId, setEditingId] = React.useState<string | null>(null)

  const [form, setForm] = React.useState<ChargeableFormData>(() => createBlankFormData())

  const editingChargeable = React.useMemo(
    () => (editingId ? chargeables.find((item) => item.id === editingId) ?? null : null),
    [chargeables, editingId]
  )

  React.useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 250)
    return () => window.clearTimeout(timeoutId)
  }, [searchTerm])

  React.useEffect(() => {
    setPage(1)
  }, [debouncedSearchTerm, filterTypeId])

  const load = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [itemsResponse, types, nextTaxRate] = await Promise.all([
        fetchChargeables({
          page,
          pageSize: PAGE_SIZE,
          searchTerm: debouncedSearchTerm,
          filterTypeId,
        }),
        fetchChargeableTypes(),
        fetchDefaultTaxRate(),
      ])
      setChargeables(itemsResponse.chargeables)
      setTotalChargeables(itemsResponse.total)
      setChargeableTypes(types)
      setTaxRate(nextTaxRate)
      return { items: itemsResponse.chargeables, total: itemsResponse.total, types, taxRate: nextTaxRate }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load chargeables")
      return null
    } finally {
      setLoading(false)
    }
  }, [debouncedSearchTerm, filterTypeId, page, PAGE_SIZE])

  React.useEffect(() => {
    void load()
  }, [load])

  const applyTaxableToggle = React.useCallback(
    (current: ChargeableFormData, nextIsTaxable: boolean) => {
      const currentTaxRate = current.is_taxable ? taxRate : 0
      const nextTaxRateVal = nextIsTaxable ? taxRate : 0

      const rateInclusive = parseOptionalNumber(current.rate_inclusive)
      const rateExclusive = rateInclusive == null ? null : inclusiveToExclusive(rateInclusive, currentTaxRate)
      const nextInclusive =
        rateExclusive == null ? "" : roundToTwoDecimals(exclusiveToInclusive(rateExclusive, nextTaxRateVal)).toFixed(2)

      return { ...current, is_taxable: nextIsTaxable, rate_inclusive: nextInclusive }
    },
    [taxRate]
  )

  const canSave = React.useMemo(() => {
    if (saving) return false
    if (!normalizeName(form.name).length) return false
    if (!form.chargeable_type_id) return false
    const rateInclusive = parseOptionalNumber(form.rate_inclusive)
    if (rateInclusive == null || rateInclusive < 0) return false
    return true
  }, [form.chargeable_type_id, form.name, form.rate_inclusive, saving])

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
        await load()
        setEditOpen(false)
        setEditingId(null)
        toast.success("Chargeable deactivated")
      } catch (err) {
        toast.error(getErrorMessage(err))
        setError(getErrorMessage(err))
      } finally {
        setSaving(false)
      }
    },
    [load]
  )

  const handleCreate = async () => {
    if (!normalizeName(form.name).length || !form.chargeable_type_id) return

    const rateInclusive = parseOptionalNumber(form.rate_inclusive)
    if (rateInclusive == null || rateInclusive < 0) {
      setError("Rate is required.")
      return
    }

    setSaving(true)
    setError(null)
    try {
      const itemTaxRate = form.is_taxable ? taxRate : 0
      const rateExclusive = roundToStoragePrecision(inclusiveToExclusive(rateInclusive, itemTaxRate))

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
          xero_tax_type: null,
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

      await load()
      setAddOpen(false)
      setForm(createBlankFormData())
      toast.success("Chargeable created")
    } catch (err) {
      toast.error(getErrorMessage(err))
      setError(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const handleUpdate = async () => {
    if (!editingChargeable) return
    if (!normalizeName(form.name).length || !form.chargeable_type_id) return

    const rateInclusive = parseOptionalNumber(form.rate_inclusive)
    if (rateInclusive == null || rateInclusive < 0) {
      setError("Rate is required.")
      return
    }

    setSaving(true)
    setError(null)
    try {
      const itemTaxRate = form.is_taxable ? taxRate : 0
      const rateExclusive = roundToStoragePrecision(inclusiveToExclusive(rateInclusive, itemTaxRate))

      const response = await fetch("/api/chargeables", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: editingChargeable.id,
          name: normalizeName(form.name),
          description: normalizeDescription(form.description),
          chargeable_type_id: form.chargeable_type_id,
          is_taxable: form.is_taxable,
          is_active: form.is_active,
          rate: rateExclusive,
          xero_tax_type: null,
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

      await load()
      setEditOpen(false)
      setEditingId(null)
      setForm(createBlankFormData())
      toast.success("Chargeable updated")
    } catch (err) {
      toast.error(getErrorMessage(err))
      setError(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const totalPages = Math.max(1, Math.ceil(totalChargeables / PAGE_SIZE))
  const pageStart = totalChargeables === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const pageEnd = Math.min(page * PAGE_SIZE, totalChargeables)

  React.useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages)
    }
  }, [page, totalPages])

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

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative w-full sm:max-w-xs">
            <IconSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search chargeables..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-10 rounded-xl border-slate-200 bg-white pl-9 shadow-none focus-visible:ring-0"
              disabled={loading}
            />
          </div>

          <Select value={filterTypeId} onValueChange={setFilterTypeId}>
            <SelectTrigger className="h-10 w-full rounded-xl border-slate-200 bg-white shadow-none focus:ring-0 sm:w-48">
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
            Add chargeable
          </Button>

          <DialogContent
            className={cn(
              "p-0 border-none shadow-2xl rounded-[24px] overflow-hidden",
              "w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] sm:w-full sm:max-w-[540px]",
              "top-[calc(env(safe-area-inset-top)+1rem)] sm:top-[50%] translate-y-0 sm:translate-y-[-50%]",
              "h-[calc(100dvh-2rem)] sm:flex sm:flex-col sm:h-auto sm:max-h-[calc(100dvh-4rem)]"
            )}
          >
            <div className="flex flex-col flex-1 min-h-0 bg-white">
              <DialogHeader className="px-6 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-4 text-left sm:pt-6 shrink-0">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
                    <IconCashBanknote className="h-5 w-5" />
                  </div>
                  <div>
                    <DialogTitle className="text-xl font-bold tracking-tight text-slate-900">
                      Add Chargeable
                    </DialogTitle>
                    <DialogDescription className="mt-0.5 text-sm text-slate-500">
                      Create a chargeable with a default rate. Required fields are marked with{" "}
                      <span className="text-destructive">*</span>.
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-6 pb-6">
                <ChargeableFormFields
                  form={form}
                  setForm={setForm}
                  chargeableTypes={chargeableTypes}
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
                    className="h-10 flex-1 rounded-xl border-slate-200 text-xs font-bold shadow-none hover:bg-slate-50"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => void handleCreate()}
                    disabled={saving || !canSave}
                    className="h-10 flex-[1.4] rounded-xl bg-slate-900 text-xs font-bold text-white shadow-lg shadow-slate-900/10 hover:bg-slate-800"
                  >
                    {saving ? <IconLoader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
                    Create Chargeable
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
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Rate (incl.)</TableHead>
              <TableHead>Tax</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                  Loading chargeables…
                </TableCell>
              </TableRow>
            ) : chargeables.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                  {searchTerm || filterTypeId !== "all"
                    ? "No chargeables match your filters."
                    : "No chargeables configured. Add one to get started."}
                </TableCell>
              </TableRow>
            ) : (
              chargeables.map((item) => {
                const itemTaxRate = item.is_taxable ? taxRate : 0
                const rateExclusive = Number.isFinite(item.rate) ? Number(item.rate) : 0
                const rateInclusive = roundToTwoDecimals(exclusiveToInclusive(rateExclusive, itemTaxRate)).toFixed(2)

                return (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{item.name}</p>
                        {item.description ? (
                          <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{item.description}</p>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-slate-700">
                        {item.chargeable_type?.name ?? "—"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-sm font-semibold tabular-nums text-slate-900">${rateInclusive}</span>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs",
                          item.is_taxable
                            ? "border-blue-200 bg-blue-50 text-blue-700"
                            : "border-slate-200 bg-white text-slate-600"
                        )}
                      >
                        {item.is_taxable ? "Taxable" : "Non-taxable"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs",
                          item.is_active
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-slate-200 bg-white text-slate-600"
                        )}
                      >
                        {item.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => {
                          setEditingId(item.id)
                          setForm(createEditFormData(item, taxRate))
                          setError(null)
                          setEditOpen(true)
                        }}
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

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          Showing {pageStart}-{pageEnd} of {totalChargeables}
        </p>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 px-2.5"
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            disabled={loading || page <= 1}
          >
            <IconChevronLeft className="mr-1 h-4 w-4" />
            Previous
          </Button>
          <span className="min-w-20 text-center text-xs text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 px-2.5"
            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={loading || page >= totalPages}
          >
            Next
            <IconChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
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
            "w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] sm:w-full sm:max-w-[540px]",
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
                    Edit Chargeable
                  </DialogTitle>
                  <DialogDescription className="mt-0.5 text-sm text-slate-500">
                    Update details and default rate. Required fields are marked with{" "}
                    <span className="text-destructive">*</span>.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-6 pb-6">
              <ChargeableFormFields
                form={form}
                setForm={setForm}
                chargeableTypes={chargeableTypes}
                taxRate={taxRate}
                saving={saving}
                applyTaxableToggle={applyTaxableToggle}
              />
            </div>

            <div className="shrink-0 border-t bg-white px-6 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-[0_-4px_12px_rgba(0,0,0,0.05)] sm:pb-4">
              <div className="flex items-center justify-between gap-3">
                {editingChargeable?.is_active ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => editingChargeable && void handleDeactivate(editingChargeable)}
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
                    className="h-10 rounded-xl border-slate-200 text-xs font-bold shadow-none hover:bg-slate-50"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => void handleUpdate()}
                    disabled={saving || !canSave}
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

type ChargeableFormFieldsProps = {
  form: ChargeableFormData
  setForm: React.Dispatch<React.SetStateAction<ChargeableFormData>>
  chargeableTypes: ChargeableTypeLite[]
  taxRate: number
  saving: boolean
  applyTaxableToggle: (current: ChargeableFormData, nextIsTaxable: boolean) => ChargeableFormData
}

function ChargeableFormFields({
  form,
  setForm,
  chargeableTypes,
  taxRate,
  saving,
  applyTaxableToggle,
}: ChargeableFormFieldsProps) {
  const [descriptionOpen, setDescriptionOpen] = React.useState(false)

  return (
    <div className="space-y-5">
      <div>
        <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Name <span className="text-destructive">*</span>
        </label>
        <Input
          value={form.name}
          onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
          placeholder="e.g. Airways Fee"
          className="h-11 rounded-xl border-slate-200 bg-white px-3 text-[15px] shadow-none transition-colors focus-visible:ring-0"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Category <span className="text-destructive">*</span>
        </label>
        <Select
          value={form.chargeable_type_id}
          onValueChange={(value) => setForm((prev) => ({ ...prev, chargeable_type_id: value }))}
        >
          <SelectTrigger className="h-11 w-full rounded-xl border-slate-200 bg-white shadow-none focus:ring-0">
            <SelectValue placeholder="Select category" />
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

      <div>
        <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Price <span className="text-destructive">*</span>
        </label>
        <Input
          value={form.rate_inclusive}
          onChange={(e) => setForm((prev) => ({ ...prev, rate_inclusive: e.target.value }))}
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

      <div className="rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Label className="text-sm font-semibold text-slate-900 leading-none">Includes tax</Label>
            <p className="mt-1 text-xs text-slate-600 leading-snug">
              Applies the default tax rate to this chargeable.
            </p>
          </div>
          <Switch
            checked={form.is_taxable}
            onCheckedChange={(checked) => setForm((prev) => applyTaxableToggle(prev, checked))}
            disabled={saving}
          />
        </div>
      </div>

      <Collapsible open={descriptionOpen} onOpenChange={setDescriptionOpen}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 transition-colors hover:text-blue-700"
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
              placeholder="Optional notes shown to staff."
              rows={3}
              className="rounded-xl border-slate-200 bg-white px-3 py-2 text-[15px] shadow-none transition-colors focus-visible:ring-0"
            />
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}
