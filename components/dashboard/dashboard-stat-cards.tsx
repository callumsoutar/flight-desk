"use client"

import * as React from "react"
import {
  IconAlertTriangle,
  IconClock,
  IconInfoCircle,
  IconPlane,
  IconReceipt,
  IconUsers,
} from "@tabler/icons-react"

import { cn } from "@/lib/utils"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { DashboardMetrics } from "@/lib/types/dashboard"

function formatHours(value: number) {
  if (!Number.isFinite(value)) return "0.0h"
  return `${value.toFixed(1)}h`
}

function formatNumber(value: number) {
  if (!Number.isFinite(value)) return "0"
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value)
}

function formatRate(value: number) {
  if (!Number.isFinite(value)) return "0.0"
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1, minimumFractionDigits: 1 }).format(value)
}

type StatCard = {
  title: string
  value: string
  sub: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  iconColor: string
}

export function DashboardStatCards({ metrics }: { metrics: DashboardMetrics }) {
  const cards: StatCard[] = [
    {
      title: `Hours flown (${metrics.monthLabel})`,
      value: formatHours(metrics.hoursFlownThisMonth),
      sub: `${formatNumber(metrics.flightsThisMonth)} flights • ${formatRate(metrics.avgFlightsPerDayThisMonth)}/day`,
      description: "Logged flight time and cycle totals for this month.",
      icon: IconPlane,
      iconColor: "text-indigo-500",
    },
    {
      title: "Active students",
      value: formatNumber(metrics.activeStudentsThisMonth),
      sub: `Bookings in ${metrics.monthLabel}`,
      description: "Students with at least one flight booking in the current month.",
      icon: IconUsers,
      iconColor: "text-emerald-500",
    },
    {
      title: "Today",
      value: formatNumber(metrics.upcomingToday),
      sub: "Scheduled remaining today",
      description: "Confirmed or awaiting bookings left on today’s roster.",
      icon: IconClock,
      iconColor: "text-slate-500",
    },
    {
      title: "Needs attention",
      value: formatNumber(metrics.fleetAttention + metrics.bookingRequests),
      sub: `${formatNumber(metrics.bookingRequests)} requests • ${formatNumber(metrics.fleetAttention)} aircraft`,
      description: "New booking requests or aircraft with active observations.",
      icon: metrics.fleetAttention + metrics.bookingRequests > 0 ? IconAlertTriangle : IconReceipt,
      iconColor: metrics.fleetAttention + metrics.bookingRequests > 0 ? "text-amber-500" : "text-slate-500",
    },
  ]

  return (
    <TooltipProvider delayDuration={0}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon
          return (
            <Card key={card.title} className="shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="flex items-center gap-1.5">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {card.title}
                  </CardTitle>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button className="outline-hidden">
                        <IconInfoCircle className="h-3.5 w-3.5 text-muted-foreground/50 hover:text-muted-foreground transition-colors" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-[220px] text-xs">
                      {card.description}
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Icon className={cn("h-4 w-4", card.iconColor)} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{card.value}</div>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                  {card.sub}
                </p>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </TooltipProvider>
  )
}
