"use client"

import * as React from "react"

import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export function DatePicker({
  date,
  onChange,
  placeholder,
  className,
  disabled,
}: {
  date: string | null | undefined
  onChange: (value: string | null) => void
  placeholder?: string
  className?: string
  disabled?: boolean
}) {
  return (
    <Input
      type="date"
      value={date ?? ""}
      onChange={(event) => onChange(event.target.value || null)}
      placeholder={placeholder}
      className={cn("bg-white", className)}
      disabled={disabled}
    />
  )
}
