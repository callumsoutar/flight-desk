"use client"

import * as React from "react"
import { Loader2 } from "lucide-react"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useXeroTaxRatesQuery, type XeroTaxRateOption as TaxRateOption } from "@/hooks/use-xero-tax-rates-query"

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
  const [open, setOpen] = React.useState(false)

  const {
    data: taxRates = [],
    isLoading,
    error,
  } = useXeroTaxRatesQuery(open)

  const selectedRate = taxRates.find((r) => r.tax_type === value)
  const displayValue = selectedRate ? formatLabel(selectedRate) : value || null

  const options = React.useMemo(() => {
    const list = [...taxRates]
    if (value && !list.some((r) => r.tax_type === value)) {
      list.unshift({ tax_type: value, name: value, display_rate: null })
    }
    return list
  }, [taxRates, value])

  return (
    <Select
      open={open}
      onOpenChange={setOpen}
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
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-4 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading tax rates…
          </div>
        ) : error ? (
          <div className="px-3 py-4 text-center text-sm text-destructive">
            {error instanceof Error ? error.message : "Failed to load tax rates"}
          </div>
        ) : (
          <>
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
          </>
        )}
      </SelectContent>
    </Select>
  )
}
