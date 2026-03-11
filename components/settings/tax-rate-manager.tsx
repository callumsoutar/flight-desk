"use client"

import * as React from "react"
import {
  IconAlertCircle,
  IconCheck,
  IconCurrencyDollar,
  IconDeviceFloppy,
  IconEdit,
  IconLoader2,
  IconX,
} from "@tabler/icons-react"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { TaxRate } from "@/lib/types/tax-rates"

export function TaxRateManager() {
  const [taxRates, setTaxRates] = React.useState<TaxRate[]>([])
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState<string | null>(null)
  const [isEditing, setIsEditing] = React.useState(false)
  const [selectedTaxRateId, setSelectedTaxRateId] = React.useState<string>("")

  React.useEffect(() => {
    void fetchTaxRates()
  }, [])

  React.useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [success])

  const fetchTaxRates = async () => {
    try {
      setLoading(true)
      const response = await fetch("/api/tax-rates")
      const data = (await response.json()) as { tax_rates?: TaxRate[]; error?: string }
      if (response.ok) {
        const rates = data.tax_rates ?? []
        setTaxRates(rates)
        const defaultRate = rates.find((r) => r.is_default)
        if (defaultRate) {
          setSelectedTaxRateId(defaultRate.id)
        }
      } else {
        setError(data.error ?? "Failed to fetch tax rates")
      }
    } catch {
      setError("Failed to fetch tax rates")
    } finally {
      setLoading(false)
    }
  }

  const handleSaveDefault = async () => {
    if (!selectedTaxRateId) return

    try {
      setSaving(true)
      setError(null)
      setSuccess(null)

      const response = await fetch("/api/tax-rates", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedTaxRateId, is_default: true }),
      })

      if (response.ok) {
        setSuccess("Tax rate updated successfully")
        await fetchTaxRates()
        setIsEditing(false)
      } else {
        const data = (await response.json()) as { error?: string }
        setError(data.error ?? "Failed to update tax rate")
      }
    } catch {
      setError("Failed to update tax rate")
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
    setError(null)
  }

  if (loading) {
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
    <div className="space-y-4">
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
          <div className="flex items-center justify-between gap-4">
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
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
              Select Default Tax Rate
            </label>
            <Select value={selectedTaxRateId} onValueChange={setSelectedTaxRateId}>
              <SelectTrigger className="h-11 w-full rounded-xl border-slate-200 bg-white">
                <SelectValue placeholder="Choose a tax rate..." />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {taxRates.map((rate) => (
                  <SelectItem key={rate.id} value={rate.id} className="rounded-lg">
                    <div className="flex min-w-[300px] w-full items-center justify-between">
                      <span className="font-bold">
                        {rate.tax_name} ({rate.country_code}
                        {rate.region_code ? ` - ${rate.region_code}` : ""})
                      </span>
                      <span className="ml-auto font-black text-indigo-600">
                        {(Number(rate.rate) * 100).toFixed(2)}%
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
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
    </div>
  )
}
