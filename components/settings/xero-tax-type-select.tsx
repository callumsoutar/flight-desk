"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type TaxRateOption = {
  tax_type: string
  name: string
  display_rate: string | null
}

async function fetchTaxRates(): Promise<TaxRateOption[]> {
  const response = await fetch("/api/xero/tax-rates", { cache: "no-store" })
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null
    throw new Error(body?.error ?? "Failed to load tax rates")
  }
  const data = (await response.json().catch(() => null)) as { tax_rates?: TaxRateOption[] } | null
  return data?.tax_rates ?? []
}

function formatLabel(rate: TaxRateOption): string {
  if (rate.display_rate) {
    return `${rate.name} (${rate.display_rate})`
  }
  return rate.name
}

export function XeroTaxTypeSelect({
  value,
  onChange,
  disabled = false,
  placeholder = "Select tax type…",
  includeNoneOption = true,
  className,
}: {
  value: string
  onChange: (taxType: string) => void
  disabled?: boolean
  placeholder?: string
  includeNoneOption?: boolean
  className?: string
}) {
  const {
    data: taxRates = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["xero", "tax-rates"],
    queryFn: fetchTaxRates,
    staleTime: 60_000,
  })

  const selectedRate = taxRates.find((r) => r.tax_type === value)
  const displayValue = selectedRate ? formatLabel(selectedRate) : value || null

  const options = React.useMemo(() => {
    const list = [...taxRates]
    if (value && !list.some((r) => r.tax_type === value)) {
      list.unshift({ tax_type: value, name: value, display_rate: null })
    }
    return list
  }, [taxRates, value])

  if (isLoading) {
    return (
      <div className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Loading tax rates…</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
        {error instanceof Error ? error.message : "Failed to load tax rates"}
      </div>
    )
  }

  return (
    <Select
      value={value || "__none__"}
      onValueChange={(v) => onChange(v === "__none__" ? "" : v)}
      disabled={disabled}
    >
      <SelectTrigger
        className={className ?? "h-10 w-full rounded-xl border-slate-200 bg-white"}
      >
        <SelectValue placeholder={placeholder}>
          {displayValue || (includeNoneOption ? "None" : null)}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="rounded-xl">
        {includeNoneOption ? (
          <SelectItem value="__none__">
            <span className="text-muted-foreground">None</span>
          </SelectItem>
        ) : null}
        {options.map((rate) => (
          <SelectItem key={rate.tax_type} value={rate.tax_type}>
            {formatLabel(rate)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
