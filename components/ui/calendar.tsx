"use client"

import * as React from "react"

import { Input } from "@/components/ui/input"

function toDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function fromDateKey(value: string) {
  if (!value) return undefined
  const [year, month, day] = value.split("-").map(Number)
  if (!year || !month || !day) return undefined
  return new Date(year, month - 1, day, 0, 0, 0, 0)
}

export function Calendar({
  selected,
  onSelect,
}: {
  mode?: "single"
  selected?: Date
  onSelect?: (date: Date | undefined) => void
  initialFocus?: boolean
}) {
  return (
    <div className="p-3">
      <Input
        type="date"
        value={selected ? toDateKey(selected) : ""}
        onChange={(event) => onSelect?.(fromDateKey(event.currentTarget.value))}
      />
    </div>
  )
}
