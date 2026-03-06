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
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Badge } from "@/components/ui/badge"
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
      <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon
          return (
            <Card key={card.title} className="@container/card">
              <CardHeader>
                <div className="flex items-center gap-1.5">
                  <CardDescription className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    {card.title}
                  </CardDescription>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button className="outline-hidden">
                        <IconInfoCircle className="h-3 w-3 text-slate-300 hover:text-slate-400 transition-colors" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-[220px] text-[11px] font-medium leading-tight bg-slate-900 text-white border-slate-800 shadow-xl rounded-lg px-3 py-2">
                      {card.description}
                    </TooltipContent>
                  </Tooltip>
                </div>
                <CardTitle className="text-3xl font-semibold tabular-nums @[250px]/card:text-4xl">
                  {card.value}
              </CardTitle>
              <div className="ml-auto -mt-8">
                <Badge
                  variant="outline"
                  className="h-8 w-8 justify-center p-0 text-slate-700"
                  aria-label={card.title}
                >
                  <Icon className={cn("h-4 w-4", card.iconColor)} />
                </Badge>
              </div>
            </CardHeader>
            <CardFooter className="flex-col items-start gap-1.5 text-sm">
              <div className="line-clamp-1 flex gap-2 font-medium">{card.sub}</div>
            </CardFooter>
          </Card>
          )
        })}
      </div>
    </TooltipProvider>
  )
}
