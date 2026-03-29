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
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2">
        <Select value={dateRange.preset} onValueChange={handlePresetChange}>
          <SelectTrigger className="h-9 w-[180px] bg-white font-medium shadow-sm">
            <div className="flex items-center gap-2">
              <IconCalendar className="h-4 w-4 text-muted-foreground" />
              <SelectValue />
            </div>
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(PRESET_LABELS) as DateRangePreset[]).map((preset) => (
              <SelectItem key={preset} value={preset}>
                {PRESET_LABELS[preset]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {showCustom ? (
        <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2">
          <Input
            type="date"
            value={customFrom}
            onChange={(e) => setCustomFrom(e.target.value)}
            className="h-9 w-[140px] bg-white text-sm shadow-sm"
            max={customTo || undefined}
          />
          <span className="text-sm text-muted-foreground">to</span>
          <Input
            type="date"
            value={customTo}
            onChange={(e) => setCustomTo(e.target.value)}
            className="h-9 w-[140px] bg-white text-sm shadow-sm"
            min={customFrom || undefined}
          />
          <Button
            size="sm"
            className="h-9 px-4 shadow-sm"
            onClick={handleCustomApply}
            disabled={!customFrom || !customTo || customFrom > customTo}
          >
            Apply
          </Button>
        </div>
      ) : (
        <span className="text-sm font-medium text-slate-500">
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
