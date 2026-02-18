"use client"

import * as React from "react"
import {
  IconAlertTriangle,
  IconClock,
  IconPlane,
  IconTool,
  IconTrendingUp,
} from "@tabler/icons-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import type { AircraftWithType } from "@/lib/types/aircraft"
import type { FlightEntry, ObservationWithUsers } from "@/lib/types/aircraft-detail"
import type { AircraftComponentsRow } from "@/lib/types/tables"

type Props = {
  aircraft: AircraftWithType
  flights: FlightEntry[]
  observations: ObservationWithUsers[]
  components: AircraftComponentsRow[]
  activeObservations: number
  overdueComponents: number
}

function formatTotalHours(hours: number | null | undefined): string {
  if (hours === null || hours === undefined) return "0.0h"
  return `${hours.toFixed(1)}h`
}

function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return "—"
  const parsed = new Date(dateString)
  if (Number.isNaN(parsed.getTime())) return "—"
  return parsed.toLocaleDateString("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

function getUserName(user: FlightEntry["student"]): string {
  if (!user) return "—"
  const name = [user.first_name, user.last_name].filter(Boolean).join(" ")
  return name || user.email || "—"
}

export function AircraftOverviewTab({
  aircraft,
  flights,
  observations,
  activeObservations,
  overdueComponents,
}: Props) {
  const nowTime = new Date().getTime()
  const totalHours = aircraft.total_time_in_service || 0
  const currentHobbs = aircraft.current_hobbs || 0
  const currentTach = aircraft.current_tach || 0
  const recentFlights = flights.slice(0, 5)
  const recentObservations = observations.filter((o) => !o.resolved_at).slice(0, 3)

  const lastFlight = flights[0]
  const hoursSinceLastFlight = lastFlight?.created_at
    ? Math.round(
        (nowTime - new Date(lastFlight.created_at).getTime()) / (1000 * 60 * 60)
      )
    : null

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border border-border/50 shadow-sm transition-shadow hover:shadow-md">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-muted-foreground text-sm font-medium">Total Hours</p>
                <p className="text-2xl font-semibold tracking-tight">{formatTotalHours(totalHours)}</p>
              </div>
              <div className="bg-muted/50 flex h-10 w-10 items-center justify-center rounded-lg">
                <IconPlane className="text-muted-foreground h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/50 shadow-sm transition-shadow hover:shadow-md">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-muted-foreground text-sm font-medium">Flights</p>
                <p className="text-2xl font-semibold tracking-tight">{flights.length}</p>
              </div>
              <div className="bg-muted/50 flex h-10 w-10 items-center justify-center rounded-lg">
                <IconClock className="text-muted-foreground h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/50 shadow-sm transition-shadow hover:shadow-md">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-muted-foreground text-sm font-medium">Active Observations</p>
                <p
                  className={`text-2xl font-semibold tracking-tight ${activeObservations > 0 ? "text-orange-600" : ""}`}
                >
                  {activeObservations}
                </p>
              </div>
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-lg ${activeObservations > 0 ? "bg-orange-50" : "bg-muted/50"}`}
              >
                <IconAlertTriangle
                  className={`h-5 w-5 ${activeObservations > 0 ? "text-orange-600" : "text-muted-foreground"}`}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/50 shadow-sm transition-shadow hover:shadow-md">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-muted-foreground text-sm font-medium">Overdue Components</p>
                <p
                  className={`text-2xl font-semibold tracking-tight ${overdueComponents > 0 ? "text-red-600" : ""}`}
                >
                  {overdueComponents}
                </p>
              </div>
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-lg ${overdueComponents > 0 ? "bg-red-50" : "bg-muted/50"}`}
              >
                <IconTool
                  className={`h-5 w-5 ${overdueComponents > 0 ? "text-red-600" : "text-muted-foreground"}`}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="border border-border/50 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg font-semibold">
              <div className="bg-muted/50 flex h-8 w-8 items-center justify-center rounded-lg">
                <IconPlane className="text-muted-foreground h-4 w-4" />
              </div>
              Aircraft Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Registration</p>
                <p className="text-sm font-semibold">{aircraft.registration}</p>
              </div>
              <div className="space-y-1.5">
                <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Type</p>
                <p className="text-sm font-semibold">{aircraft.type}</p>
              </div>
              <div className="space-y-1.5">
                <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Model</p>
                <p className="text-sm font-semibold">{aircraft.model || "—"}</p>
              </div>
              <div className="space-y-1.5">
                <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Status</p>
                <Badge
                  variant={aircraft.status === "active" ? "default" : "secondary"}
                  className={`font-medium ${
                    aircraft.status === "active"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {aircraft.status || "Unknown"}
                </Badge>
              </div>
              {aircraft.year_manufactured ? (
                <div className="space-y-1.5">
                  <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                    Year Manufactured
                  </p>
                  <p className="text-sm font-semibold">{aircraft.year_manufactured}</p>
                </div>
              ) : null}
              {aircraft.manufacturer ? (
                <div className="space-y-1.5">
                  <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                    Manufacturer
                  </p>
                  <p className="text-sm font-semibold">{aircraft.manufacturer}</p>
                </div>
              ) : null}
            </div>

            <Separator className="my-4" />

            <div className="grid grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Current Hobbs</p>
                <p className="text-sm font-semibold">{formatTotalHours(currentHobbs)}</p>
              </div>
              <div className="space-y-1.5">
                <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Current Tach</p>
                <p className="text-sm font-semibold">{formatTotalHours(currentTach)}</p>
              </div>
            </div>

            {hoursSinceLastFlight !== null ? (
              <>
                <Separator className="my-4" />
                <div className="space-y-1.5">
                  <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                    Hours Since Last Flight
                  </p>
                  <p className="text-sm font-semibold">{hoursSinceLastFlight}h</p>
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>

        <Card className="border border-border/50 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg font-semibold">
              <div className="bg-muted/50 flex h-8 w-8 items-center justify-center rounded-lg">
                <IconTrendingUp className="text-muted-foreground h-4 w-4" />
              </div>
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {recentFlights.length > 0 ? (
              <div className="space-y-1">
                <p className="text-muted-foreground mb-3 text-xs font-medium tracking-wide uppercase">
                  Recent Flights
                </p>
                {recentFlights.map((flight, index) => (
                  <React.Fragment key={flight.id}>
                    <div className="hover:bg-muted/50 flex items-center justify-between rounded-lg px-2 py-2.5 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="bg-muted/50 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md">
                          <IconPlane className="text-muted-foreground h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{getUserName(flight.student)}</p>
                          <p className="text-muted-foreground text-xs">
                            {flight.created_at ? formatDate(flight.created_at) : "—"}
                          </p>
                        </div>
                      </div>
                      <p className="text-muted-foreground text-sm font-semibold">
                        {formatTotalHours(flight.flight_time)}
                      </p>
                    </div>
                    {index < recentFlights.length - 1 ? <Separator className="my-1" /> : null}
                  </React.Fragment>
                ))}
              </div>
            ) : (
              <div className="text-muted-foreground py-4 text-sm">No recent flights</div>
            )}

            {recentObservations.length > 0 ? (
              <>
                <Separator className="my-4" />
                <div className="space-y-1">
                  <p className="text-muted-foreground mb-3 text-xs font-medium tracking-wide uppercase">
                    Recent Observations
                  </p>
                  {recentObservations.map((observation, index) => (
                    <React.Fragment key={observation.id}>
                      <div className="hover:bg-muted/50 flex items-start gap-3 rounded-lg px-2 py-2.5 transition-colors">
                        <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-orange-50">
                          <IconAlertTriangle className="h-4 w-4 text-orange-600" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">{observation.name}</p>
                          {observation.description ? (
                            <p className="text-muted-foreground mt-0.5 line-clamp-1 text-xs">
                              {observation.description}
                            </p>
                          ) : null}
                          <Badge
                            variant="outline"
                            className="mt-2 border-orange-200 bg-orange-50 text-xs text-orange-700"
                          >
                            {observation.priority || "Normal"}
                          </Badge>
                        </div>
                      </div>
                      {index < recentObservations.length - 1 ? <Separator className="my-1" /> : null}
                    </React.Fragment>
                  ))}
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
