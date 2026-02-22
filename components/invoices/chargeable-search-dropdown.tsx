"use client"

import * as React from "react"
import { Check, ChevronsUpDown, Info } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { roundToTwoDecimals } from "@/lib/invoices/invoice-calculations"
import { cn } from "@/lib/utils"
import type { InvoiceCreateChargeable } from "@/lib/types/invoice-create"

interface ChargeableSearchDropdownProps {
  chargeables: InvoiceCreateChargeable[]
  value: string
  onSelect: (chargeable: InvoiceCreateChargeable | null) => void
  taxRate?: number
  disabled?: boolean
  placeholder?: string
}

export default function ChargeableSearchDropdown({
  chargeables,
  value,
  onSelect,
  taxRate = 0,
  disabled = false,
  placeholder = "Search chargeables...",
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

  const triggerText = selectedChargeable?.name ?? placeholder

  return (
    <TooltipProvider delayDuration={120}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn("h-10 w-full justify-between", !selectedChargeable && "text-muted-foreground")}
          >
            <span className="truncate text-left">{triggerText}</span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[420px] max-w-[calc(100vw-2rem)] p-2">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search chargeables..."
            className="mb-2 h-9"
          />
          <div className="max-h-72 overflow-y-auto rounded-md border border-border/60">
            <button
              type="button"
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted/60"
              onClick={() => {
                onSelect(null)
                setOpen(false)
                setSearch("")
              }}
            >
              <span className="truncate text-muted-foreground">No chargeable selected</span>
              {!selectedChargeable ? <Check className="h-4 w-4" /> : null}
            </button>

            {filteredChargeables.length === 0 ? (
              <div className="px-3 py-3 text-sm text-muted-foreground">No chargeables found.</div>
            ) : (
              filteredChargeables.map((chargeable) => {
                const isSelected = selectedChargeable?.id === chargeable.id
                const inclusiveRate =
                  chargeable.rate === null
                    ? null
                    : roundToTwoDecimals(
                        chargeable.is_taxable ? chargeable.rate * (1 + taxRate) : chargeable.rate
                      )

                return (
                  <button
                    type="button"
                    key={chargeable.id}
                    className={cn(
                      "flex w-full items-start justify-between gap-3 px-3 py-2 text-left hover:bg-muted/60",
                      isSelected && "bg-muted/40"
                    )}
                    onClick={() => {
                      onSelect(chargeable)
                      setOpen(false)
                      setSearch("")
                    }}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-medium">{chargeable.name}</span>
                        {chargeable.description ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span
                                className="inline-flex h-4 w-4 shrink-0 items-center justify-center text-muted-foreground hover:text-foreground"
                                onClick={(event) => event.stopPropagation()}
                                onMouseDown={(event) => event.stopPropagation()}
                                aria-label={`Description for ${chargeable.name}`}
                              >
                                <Info className="h-3.5 w-3.5" />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top" sideOffset={8} className="max-w-xs">
                              {chargeable.description}
                            </TooltipContent>
                          </Tooltip>
                        ) : null}
                      </div>
                    </div>
                    <span className="shrink-0 text-sm font-medium tabular-nums">
                      {inclusiveRate === null ? "—" : `$${inclusiveRate.toFixed(2)}`}
                    </span>
                    {isSelected ? <Check className="mt-0.5 h-4 w-4 shrink-0" /> : null}
                  </button>
                )
              })
            )}
          </div>
        </PopoverContent>
      </Popover>
    </TooltipProvider>
  )
}
