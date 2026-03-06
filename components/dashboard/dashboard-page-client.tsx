"use client"

import * as React from "react"

import { BookingRequestsCard } from "@/components/dashboard/booking-requests-card"
import { DashboardStatCards } from "@/components/dashboard/dashboard-stat-cards"
import { FlyingNowCard } from "@/components/dashboard/flying-now-card"
import { UpcomingTodayCard } from "@/components/dashboard/upcoming-today-card"
import type { DashboardData } from "@/lib/types/dashboard"

function formatLongDate(nowIso: string, timeZone: string) {
  const date = new Date(nowIso)
  if (Number.isNaN(date.getTime())) return "Today"
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "long",
    month: "long",
    day: "2-digit",
    year: "numeric",
  }).format(date)
}

export function DashboardPageClient({ data }: { data: DashboardData }) {
  const dateLabel = React.useMemo(() => formatLongDate(data.nowIso, data.timeZone), [data.nowIso, data.timeZone])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {data.tenantName} • {dateLabel}
          </p>
        </div>

        <div />
      </div>

      <DashboardStatCards metrics={data.metrics} />

      <div className="space-y-6">
        <UpcomingTodayCard bookings={data.upcomingTodayBookings} timeZone={data.timeZone} />

        <div className="grid gap-6 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <FlyingNowCard bookings={data.flyingNowBookings} timeZone={data.timeZone} nowIso={data.nowIso} />
          </div>
          <div className="lg:col-span-5">
            <BookingRequestsCard bookings={data.bookingRequests} timeZone={data.timeZone} />
          </div>
        </div>
      </div>
    </div>
  )
}
