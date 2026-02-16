"use client"

import Link from "next/link"
import { IconArrowLeft } from "@tabler/icons-react"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { BookingStatus } from "@/lib/types/bookings"

function getStatusBadgeStyles(status: BookingStatus): string {
  switch (status) {
    case "complete":
      return "bg-green-600 text-white border-green-700 hover:bg-green-700"
    case "flying":
      return "bg-orange-500 text-white border-orange-600 hover:bg-orange-600"
    case "confirmed":
      return "bg-blue-600 text-white border-blue-700 hover:bg-blue-700"
    case "unconfirmed":
      return "bg-amber-500 text-white border-amber-600 hover:bg-amber-600"
    case "briefing":
      return "bg-violet-600 text-white border-violet-700 hover:bg-violet-700"
    case "cancelled":
      return "bg-red-600 text-white border-red-700 hover:bg-red-700"
  }
}

function getStatusLabel(status: BookingStatus) {
  switch (status) {
    case "confirmed":
      return "Confirmed"
    case "flying":
      return "Flying"
    case "briefing":
      return "Briefing"
    case "unconfirmed":
      return "Unconfirmed"
    case "complete":
      return "Complete"
    case "cancelled":
      return "Cancelled"
  }
}

export function BookingHeader({
  title,
  status,
  subtitle,
  backHref,
  actions,
}: {
  title: string
  status: BookingStatus
  subtitle: string
  backHref: string
  actions?: React.ReactNode
}) {
  return (
    <div className="border-b border-border/40 bg-background">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <div className="min-w-0">
          <Link
            href={backHref}
            className="mb-2 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <IconArrowLeft className="h-3.5 w-3.5" />
            Back to Bookings
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="truncate text-xl font-semibold">{title}</h1>
            <Badge
              className={cn(
                "text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border-none shadow-sm",
                getStatusBadgeStyles(status)
              )}
            >
              {getStatusLabel(status)}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
    </div>
  )
}

