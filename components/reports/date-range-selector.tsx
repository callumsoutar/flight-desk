"use client"

import * as React from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { IconCalendar } from "@tabler/icons-react"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import type { DateRange, DateRangePreset } from "@/lib/reports/fetch-report-data"

const PRESET_LABELS: Record<DateRangePreset, string> = {
  last30d: "Last 30 days",
  last3m: "Last 3 months",
  last6m: "Last 6 months",
  last12m: "Last 12 months",
  thisMonth: "This month",
  thisYear: "This year",
  custom: "Custom range",
}

const QUICK_PRESETS: { value: DateRangePreset; label: string }[] = [
  { value: "last30d", label: "30d" },
  { value: "last3m", label: "3m" },
  { value: "last6m", label: "6m" },
  { value: "last12m", label: "12m" },
]

export function DateRangeSelector({ dateRange }: { dateRange: DateRange }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [customFrom, setCustomFrom] = React.useState(
    dateRange.preset === "custom" ? dateRange.startDate : ""
  )
  const [customTo, setCustomTo] = React.useState(
    dateRange.preset === "custom" ? dateRange.endDate : ""
  )
  const [showCustom, setShowCustom] = React.useState(
    dateRange.preset === "custom"
  )

  function navigate(preset: DateRangePreset, from?: string, to?: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set("range", preset)
    if (preset === "custom" && from && to) {
      params.set("from", from)
      params.set("to", to)
    } else {
      params.delete("from")
      params.delete("to")
    }
    router.push(`${pathname}?${params.toString()}`)
  }

  function handlePresetChange(value: string) {
    const preset = value as DateRangePreset
    if (preset === "custom") {
      setShowCustom(true)
    } else {
      setShowCustom(false)
      navigate(preset)
    }
  }

  function handleCustomApply() {
    if (customFrom && customTo && customFrom <= customTo) {
      navigate("custom", customFrom, customTo)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <IconCalendar className="h-4 w-4" />
        <span className="hidden sm:inline">Period:</span>
      </div>

      <Select value={dateRange.preset} onValueChange={handlePresetChange}>
        <SelectTrigger className="h-9 w-auto min-w-[160px] border-slate-200 bg-white text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(Object.keys(PRESET_LABELS) as DateRangePreset[]).map((preset) => (
            <SelectItem key={preset} value={preset}>
              {PRESET_LABELS[preset]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="hidden items-center gap-1 md:flex">
        {QUICK_PRESETS.map((preset) => (
          <Button
            key={preset.value}
            type="button"
            variant={dateRange.preset === preset.value ? "default" : "outline"}
            size="sm"
            className="h-8 px-2.5"
            onClick={() => {
              setShowCustom(false)
              navigate(preset.value)
            }}
          >
            {preset.label}
          </Button>
        ))}
      </div>

      {showCustom && (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="date"
            value={customFrom}
            onChange={(e) => setCustomFrom(e.target.value)}
            className="h-9 w-[140px] border-slate-200 bg-white text-sm"
            max={customTo || undefined}
          />
          <span className="text-sm text-muted-foreground">to</span>
          <Input
            type="date"
            value={customTo}
            onChange={(e) => setCustomTo(e.target.value)}
            className="h-9 w-[140px] border-slate-200 bg-white text-sm"
            min={customFrom || undefined}
          />
          <Button
            size="sm"
            className="h-9"
            onClick={handleCustomApply}
            disabled={!customFrom || !customTo || customFrom > customTo}
          >
            Apply
          </Button>
        </div>
      )}

      {!showCustom && (
        <span className="hidden text-xs text-muted-foreground sm:inline">
          {formatDateRangeLabel(dateRange)}
        </span>
      )}
    </div>
  )
}

function formatDateRangeLabel(dateRange: DateRange): string {
  const fmt = (d: string) => {
    const date = new Date(d)
    return date.toLocaleDateString("en-NZ", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })
  }
  return `${fmt(dateRange.startDate)} – ${fmt(dateRange.endDate)}`
}
