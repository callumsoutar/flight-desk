"use client"

import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { roundToTwoDecimals } from "@/lib/invoices/invoice-calculations"
import { cn } from "@/lib/utils"
import type { InvoiceCreateChargeable } from "@/lib/types/invoice-create"

interface ChargeableSearchDropdownProps {
  chargeables: InvoiceCreateChargeable[]
  value: string
  onSelect: (chargeable: InvoiceCreateChargeable | null) => void
  taxRate?: number
  resolveInclusiveRate?: (chargeable: InvoiceCreateChargeable) => number | null
  disabled?: boolean
  placeholder?: string
}

export default function ChargeableSearchDropdown({
  chargeables,
  value,
  onSelect,
  taxRate = 0,
  resolveInclusiveRate,
  disabled = false,
  placeholder = "Select item...",
}: ChargeableSearchDropdownProps) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")

  const selectedChargeable = React.useMemo(
    () => chargeables.find((chargeable) => chargeable.id === value) ?? null,
    [chargeables, value]
  )

  const filteredChargeables = React.useMemo(() => {
    const normalized = search.trim().toLowerCase()
    if (!normalized) return chargeables

    return chargeables.filter((chargeable) => {
      const nameMatch = chargeable.name.toLowerCase().includes(normalized)
      const descriptionMatch = (chargeable.description ?? "").toLowerCase().includes(normalized)
      return nameMatch || descriptionMatch
    })
  }, [chargeables, search])

  const getInclusiveRate = React.useCallback(
    (chargeable: InvoiceCreateChargeable) => {
      if (resolveInclusiveRate) {
        const resolvedRate = resolveInclusiveRate(chargeable)
        return typeof resolvedRate === "number" && Number.isFinite(resolvedRate)
          ? roundToTwoDecimals(resolvedRate)
          : null
      }

      if (chargeable.rate == null) return null
      return roundToTwoDecimals(chargeable.is_taxable ? chargeable.rate * (1 + taxRate) : chargeable.rate)
    },
    [resolveInclusiveRate, taxRate]
  )

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setSearch("")
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "h-10 w-full justify-between px-3 font-normal",
            !selectedChargeable && "text-muted-foreground"
          )}
        >
          <span className="truncate">{selectedChargeable?.name ?? placeholder}</span>
          <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[var(--radix-popover-trigger-width)] min-w-[220px] max-w-sm p-2"
      >
        {chargeables.length > 5 ? (
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search..."
            className="mb-2 h-8"
          />
        ) : null}
        <div className="max-h-60 overflow-y-auto">
          <button
            type="button"
            className={cn(
              "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted",
              !selectedChargeable && "text-foreground"
            )}
            onClick={() => {
              onSelect(null)
              setOpen(false)
            }}
          >
            <span className="text-muted-foreground">None</span>
            {!selectedChargeable ? <Check className="h-4 w-4 text-primary" /> : null}
          </button>

          {filteredChargeables.length === 0 ? (
            <div className="px-2 py-3 text-center text-sm text-muted-foreground">No items found.</div>
          ) : (
            filteredChargeables.map((chargeable) => {
              const isSelected = selectedChargeable?.id === chargeable.id
              const inclusiveRate = getInclusiveRate(chargeable)

              return (
                <button
                  type="button"
                  key={chargeable.id}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted",
                    isSelected && "bg-muted"
                  )}
                  onClick={() => {
                    onSelect(chargeable)
                    setOpen(false)
                  }}
                >
                  <span className="truncate font-medium">{chargeable.name}</span>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="tabular-nums text-muted-foreground">
                      {inclusiveRate === null ? "" : `$${inclusiveRate.toFixed(2)}`}
                    </span>
                    {isSelected ? <Check className="h-4 w-4 text-primary" /> : null}
                  </div>
                </button>
              )
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
