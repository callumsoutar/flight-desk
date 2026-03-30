"use client"

import * as React from "react"

import { BookingRequestsCard } from "@/components/dashboard/booking-requests-card"
import { DashboardStatCards } from "@/components/dashboard/dashboard-stat-cards"
import { FlyingNowCard } from "@/components/dashboard/flying-now-card"
import { MemberDashboard } from "@/components/dashboard/member-dashboard"
import { UpcomingTodayCard } from "@/components/dashboard/upcoming-today-card"
import type { DashboardData } from "@/lib/types/dashboard"

function formatLongDate(nowIso: string, timeZone: string) {
  const date = new Date(nowIso)
  if (Number.isNaN(date.getTime())) return "Today"
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date)
}

export function DashboardPageClient({ data }: { data: DashboardData }) {
  const dateLabel = React.useMemo(
    () => formatLongDate(data.nowIso, data.timeZone),
    [data.nowIso, data.timeZone]
  )

  const isMember = data.viewerKind === "member"

  if (isMember) {
    return <MemberDashboard data={data} />
  }

  return (
    <div className="w-full space-y-8">
      <div className="flex flex-col gap-1 sm:gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Dashboard</h1>
          <p className="mt-1 text-sm leading-snug text-muted-foreground">
            {data.tenantName} &mdash; {dateLabel}
          </p>
        </div>
      </div>

      <DashboardStatCards metrics={data.metrics} viewerKind={data.viewerKind} />

      <div className="grid grid-cols-1 gap-5 sm:gap-6 lg:grid-cols-12 lg:gap-6">
        <div className="space-y-6 lg:col-span-7">
          <UpcomingTodayCard
            bookings={data.upcomingBookings}
            timeZone={data.timeZone}
            viewerKind={data.viewerKind}
            nowIso={data.nowIso}
          />
          <FlyingNowCard
            bookings={data.flyingNowBookings}
            timeZone={data.timeZone}
            nowIso={data.nowIso}
            viewerKind={data.viewerKind}
          />
        </div>
        <div className="lg:col-span-5">
          <BookingRequestsCard
            bookings={data.bookingRequests}
            timeZone={data.timeZone}
            allowConfirmActions
          />
        </div>
      </div>
    </div>
  )
}
