"use client"

import { useQuery } from "@tanstack/react-query"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type XeroTaxRate = {
  id: string
  xero_tax_type: string
  name: string
  status: string
  effective_rate: number | null
  display_rate: string | null
}

function formatRate(rate: XeroTaxRate) {
  if (typeof rate.display_rate === "string" && rate.display_rate.trim().length) return rate.display_rate
  if (typeof rate.effective_rate === "number") return `${(rate.effective_rate * 100).toFixed(2)}%`
  return null
}

export function XeroTaxTypeSelect({
  value,
  onValueChange,
  disabled = false,
}: {
  value: string
  onValueChange: (value: string) => void
  disabled?: boolean
}) {
  const { data: taxRates = [] } = useQuery({
    queryKey: ["xero", "tax-rates", "active"],
    queryFn: async () => {
      const response = await fetch("/api/xero/tax-rates", { cache: "no-store" })
      if (!response.ok) return [] as XeroTaxRate[]
      const body = (await response.json().catch(() => null)) as { taxRates?: XeroTaxRate[] } | null
      return (body?.taxRates ?? []).filter((taxRate) => taxRate.status === "ACTIVE")
    },
    staleTime: 60_000,
  })

  return (
    <Select
      value={value || "__none__"}
      onValueChange={(next) => onValueChange(next === "__none__" ? "" : next)}
      disabled={disabled}
    >
      <SelectTrigger>
        <SelectValue placeholder="Select default tax type" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__none__">None</SelectItem>
        {taxRates.map((taxRate) => {
          const rate = formatRate(taxRate)
          const label = rate
            ? `${taxRate.name} (${taxRate.xero_tax_type}, ${rate})`
            : `${taxRate.name} (${taxRate.xero_tax_type})`
          return (
            <SelectItem key={taxRate.id} value={taxRate.xero_tax_type}>
              {label}
            </SelectItem>
          )
        })}
      </SelectContent>
    </Select>
  )
}
