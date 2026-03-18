"use client"

import * as React from "react"

import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export function DatePicker({
  id,
  date,
  onChange,
  placeholder,
  className,
  disabled,
  min,
  max,
}: {
  id?: string
  date: string | null | undefined
  onChange: (value: string | null) => void
  placeholder?: string
  className?: string
  disabled?: boolean
  min?: string
  max?: string
}) {
  return (
    <Input
      id={id}
      type="date"
      value={date ?? ""}
      onChange={(event) => onChange(event.target.value || null)}
      placeholder={placeholder}
      className={cn("bg-white", className)}
      disabled={disabled}
      min={min}
      max={max}
    />
  )
}
