"use client"

import * as React from "react"
import { useQueryClient } from "@tanstack/react-query"
import {
  IconAlertCircle,
  IconCheck,
  IconChevronDown,
  IconCurrencyDollar,
  IconDeviceFloppy,
  IconPlus,
  IconEdit,
  IconLoader2,
  IconX,
} from "@tabler/icons-react"

import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { defaultTaxRateQueryKey } from "@/hooks/use-default-tax-rate-query"
import { createTaxRate, setDefaultTaxRate, taxRatesQueryKey, useTaxRatesQuery } from "@/hooks/use-tax-rates-query"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

export function TaxRateManager() {
  const queryClient = useQueryClient()
  const [saving, setSaving] = React.useState(false)
  const [creating, setCreating] = React.useState(false)
  const [mutationError, setMutationError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState<string | null>(null)
  const [isEditing, setIsEditing] = React.useState(false)
  const [selectedTaxRateId, setSelectedTaxRateId] = React.useState<string>("")
  const [isCreateOpen, setIsCreateOpen] = React.useState(false)
  const {
    data: taxRates = [],
    isLoading,
    error: taxRatesQueryError,
  } = useTaxRatesQuery()
  const [createForm, setCreateForm] = React.useState(() => ({
    tax_name: "",
    rate_percent: "",
    effective_from: new Date().toISOString().slice(0, 10),
    description: "",
    region_code: "",
    make_default: false,
  }))

  React.useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [success])

  React.useEffect(() => {
    const defaultRate = taxRates.find((r) => r.is_default)
    if (defaultRate && !isEditing) {
      setSelectedTaxRateId(defaultRate.id)
    }
  }, [isEditing, taxRates])

  const error = mutationError ?? (taxRatesQueryError instanceof Error ? taxRatesQueryError.message : null)

  const handleSaveDefault = async () => {
    if (!selectedTaxRateId) return

    try {
      setSaving(true)
      setMutationError(null)
      setSuccess(null)

      await setDefaultTaxRate(selectedTaxRateId)
      setSuccess("Tax rate updated successfully")
      await queryClient.invalidateQueries({ queryKey: taxRatesQueryKey })
      await queryClient.invalidateQueries({ queryKey: defaultTaxRateQueryKey })
      setIsEditing(false)
    } catch (error) {
      setMutationError(error instanceof Error ? error.message : "Failed to update tax rate")
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    const defaultRate = taxRates.find((r) => r.is_default)
    if (defaultRate) {
      setSelectedTaxRateId(defaultRate.id)
    }
    setIsEditing(false)
    setMutationError(null)
  }

  const handleCreateRate = async () => {
    const taxName = createForm.tax_name.trim()
    const rateValue = Number.parseFloat(createForm.rate_percent)

    if (!taxName || Number.isNaN(rateValue)) {
      setMutationError("Enter a tax name and a valid percentage rate.")
      return
    }

    if (rateValue < 0 || rateValue > 100) {
      setMutationError("Rate must be between 0% and 100%.")
      return
    }

    try {
      setCreating(true)
      setMutationError(null)
      setSuccess(null)

      await createTaxRate({
        tax_name: taxName,
        rate_percent: rateValue,
        effective_from: createForm.effective_from || undefined,
        description: createForm.description.trim() || undefined,
        region_code: createForm.region_code.trim() || undefined,
        make_default: createForm.make_default,
      })
      setSuccess("Tax rate created successfully")
      setCreateForm((prev) => ({
        ...prev,
        tax_name: "",
        rate_percent: "",
        description: "",
        region_code: "",
        make_default: false,
      }))
      await queryClient.invalidateQueries({ queryKey: taxRatesQueryKey })
      await queryClient.invalidateQueries({ queryKey: defaultTaxRateQueryKey })
    } catch (error) {
      setMutationError(error instanceof Error ? error.message : "Failed to create tax rate")
    } finally {
      setCreating(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <IconLoader2 className="h-8 w-8 animate-spin text-slate-400" />
        <span className="ml-2 mt-2 font-medium text-slate-500">Loading tax rates...</span>
      </div>
    )
  }

  if (taxRates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-[20px] border border-dashed border-slate-200 bg-slate-50 py-16 text-center">
        <IconCurrencyDollar className="mb-4 h-12 w-12 text-slate-300" />
        <h3 className="mb-2 text-lg font-bold text-slate-900">No Tax Rates Found</h3>
        <p className="max-w-md text-sm font-medium text-slate-500">
          Contact your administrator to set up tax rates in the system.
        </p>
      </div>
    )
  }

  const currentDefault = taxRates.find((r) => r.is_default)

  return (
    <div className="space-y-6">
      {error ? (
        <div className="flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-xs font-bold uppercase tracking-tight text-red-700">
          <IconAlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {success ? (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-xs font-bold uppercase tracking-tight text-emerald-700">
          <IconCheck className="h-4 w-4 flex-shrink-0" />
          {success}
        </div>
      ) : null}

      {!isEditing && currentDefault ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                <IconCurrencyDollar className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-slate-900">{currentDefault.tax_name}</h3>
                  <div className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                    {currentDefault.country_code}
                    {currentDefault.region_code ? ` - ${currentDefault.region_code}` : ""}
                  </div>
                </div>
                <p className="mt-0.5 text-sm font-medium text-slate-500">
                  Applied to all new invoices by default
                </p>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-2xl font-black tracking-tight text-slate-900">
                {(Number(currentDefault.rate) * 100).toFixed(2)}%
              </div>
              <Button
                onClick={() => setIsEditing(true)}
                variant="outline"
                size="sm"
                className="h-9 rounded-xl border-slate-200 font-bold uppercase tracking-wider text-xs"
              >
                <IconEdit className="mr-1.5 h-3.5 w-3.5" />
                Change
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6 rounded-2xl border border-slate-200 bg-slate-50 p-6">
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Select Default Tax Rate
            </p>
            <div className="grid gap-3">
              {taxRates.map((rate) => {
                const isSelected = rate.id === selectedTaxRateId
                return (
                  <button
                    key={rate.id}
                    type="button"
                    onClick={() => setSelectedTaxRateId(rate.id)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition",
                      isSelected
                        ? "border-indigo-500 bg-white shadow-sm"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    )}
                    aria-pressed={isSelected}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-900">{rate.tax_name}</span>
                        {rate.is_default ? (
                          <span className="rounded bg-indigo-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-700">
                            Current default
                          </span>
                        ) : null}
                      </div>
                      <span className="text-xs text-slate-500">
                        {rate.country_code}
                        {rate.region_code ? ` · ${rate.region_code}` : ""} · Effective{" "}
                        {rate.effective_from}
                      </span>
                    </div>
                    <span className="text-sm font-black text-indigo-600">
                      {(Number(rate.rate) * 100).toFixed(2)}%
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={handleSaveDefault}
              disabled={saving || !selectedTaxRateId}
              className="flex h-11 items-center gap-2 rounded-xl border-none bg-indigo-600 px-6 font-semibold text-white shadow-sm shadow-indigo-100 transition-all hover:bg-indigo-700 active:scale-[0.98]"
            >
              {saving ? (
                <IconLoader2 className="h-4 w-4 animate-spin" />
              ) : (
                <IconDeviceFloppy className="h-4 w-4" />
              )}
              Save as Default
            </Button>
            <Button
              onClick={handleCancel}
              variant="outline"
              disabled={saving}
              className="h-11 rounded-xl border-slate-200 px-6 font-bold text-slate-600"
            >
              <IconX className="mr-2 h-4 w-4" />
              Cancel
            </Button>
          </div>
        </div>
      )}

      <Collapsible
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        className="rounded-2xl border border-slate-200 bg-white shadow-sm"
      >
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-start justify-between gap-4 rounded-2xl p-6 text-left"
          >
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-slate-900">Add custom tax rate</h3>
              <p className="text-sm text-muted-foreground">
                Create a tenant-specific tax rate. New rates are limited to New Zealand for now.
              </p>
            </div>
            <IconChevronDown
              className={cn(
                "mt-1 h-5 w-5 flex-shrink-0 text-slate-500 transition-transform",
                isCreateOpen ? "rotate-180" : "rotate-0"
              )}
            />
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent className="px-6 pb-6">
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="tax-name" className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Tax name
              </Label>
              <Input
                id="tax-name"
                value={createForm.tax_name}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, tax_name: event.target.value }))}
                placeholder="GST"
                className="h-11 rounded-xl border-slate-200 bg-white"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tax-rate" className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Rate (%)
              </Label>
              <Input
                id="tax-rate"
                inputMode="decimal"
                value={createForm.rate_percent}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, rate_percent: event.target.value }))}
                placeholder="15"
                className="h-11 rounded-xl border-slate-200 bg-white"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tax-effective" className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Effective from
              </Label>
              <Input
                id="tax-effective"
                type="date"
                value={createForm.effective_from}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, effective_from: event.target.value }))}
                className="h-11 rounded-xl border-slate-200 bg-white"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tax-region" className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Region (optional)
              </Label>
              <Input
                id="tax-region"
                value={createForm.region_code}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, region_code: event.target.value }))}
                placeholder="NZ-AKL"
                className="h-11 rounded-xl border-slate-200 bg-white"
              />
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <Label htmlFor="tax-description" className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Description (optional)
            </Label>
            <Textarea
              id="tax-description"
              value={createForm.description}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, description: event.target.value }))}
              placeholder="Short internal note"
              className="min-h-[80px] resize-none rounded-xl border-slate-200 bg-white"
            />
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">Make this the default rate</p>
              <p className="text-xs text-muted-foreground">This will apply to new invoices automatically.</p>
            </div>
            <Switch
              checked={createForm.make_default}
              onCheckedChange={(checked) => setCreateForm((prev) => ({ ...prev, make_default: checked }))}
            />
          </div>

          <div className="mt-5">
            <Button
              onClick={handleCreateRate}
              disabled={creating}
              className="flex h-11 items-center gap-2 rounded-xl border-none bg-slate-900 px-6 font-semibold text-white shadow-sm shadow-slate-200 transition-all hover:bg-slate-800 active:scale-[0.98]"
            >
              {creating ? <IconLoader2 className="h-4 w-4 animate-spin" /> : <IconPlus className="h-4 w-4" />}
              Add tax rate
            </Button>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}
