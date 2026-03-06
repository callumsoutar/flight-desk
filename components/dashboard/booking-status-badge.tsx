"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import type { BookingStatus } from "@/lib/types/bookings"

function labelForStatus(status: BookingStatus) {
  if (status === "unconfirmed") return "Unconfirmed"
  if (status === "confirmed") return "Confirmed"
  if (status === "briefing") return "Briefing"
  if (status === "flying") return "Flying"
  if (status === "complete") return "Complete"
  if (status === "cancelled") return "Cancelled"
  return status
}

function classForStatus(status: BookingStatus) {
  if (status === "confirmed") return "border-emerald-200 bg-emerald-50 text-emerald-700"
  if (status === "briefing") return "border-amber-200 bg-amber-50 text-amber-800"
  if (status === "flying") return "border-indigo-200 bg-indigo-50 text-indigo-700"
  if (status === "complete") return "border-slate-200 bg-slate-50 text-slate-700"
  if (status === "cancelled") return "border-red-200 bg-red-50 text-red-700"
  return "border-slate-200 bg-slate-50 text-slate-700"
}

export function BookingStatusBadge({ status, className }: { status: BookingStatus; className?: string }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "h-6 rounded-full px-2 text-[11px] font-semibold tracking-wide shadow-none",
        classForStatus(status),
        "dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200",
        className
      )}
    >
      {labelForStatus(status)}
    </Badge>
  )
}

