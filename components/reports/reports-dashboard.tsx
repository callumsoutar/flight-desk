"use client"

import * as React from "react"
import {
  Bar,
  BarChart,
  Area,
  AreaChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Label,
} from "recharts"
import {
  IconCalendarEvent,
  IconClock,
  IconPlane,
  IconAlertTriangle,
  IconInfoCircle,
} from "@tabler/icons-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { cn } from "@/lib/utils"
import { DateRangeSelector } from "@/components/reports/date-range-selector"
import { AircraftUtilisationTable } from "@/components/reports/aircraft-utilisation-table"
import { AircraftUtilisationTrendChart } from "@/components/reports/aircraft-utilisation-trend-chart"
import { HoursByFlightTypeChart } from "@/components/reports/hours-by-flight-type-chart"
import { InstructorRevenueRanking } from "@/components/reports/instructor-revenue-ranking"
import { StaffDualHoursCards } from "@/components/reports/staff-dual-hours-cards"
import { StudentsPerInstructor } from "@/components/reports/students-per-instructor"
import type { ReportData, DateRange } from "@/lib/reports/fetch-report-data"
import type {
  AircraftUtilisationDashboard,
  FlyingActivityDashboard,
  HoursByFlightTypeRow,
  StaffDashboard,
} from "@/lib/types/reports"

// ---------------------------------------------------------------------------
// Soft, muted palette — stays within the navy/blue brand family but
// is easy on the eyes.  Saturation capped ~45 %, lightness kept 58-78 %.
// ---------------------------------------------------------------------------

const C1 = "hsl(217, 55%, 58%)"   // Soft brand blue
const C2 = "hsl(232, 38%, 62%)"   // Muted indigo
const C3 = "hsl(207, 38%, 68%)"   // Dusty sky
const C4 = "hsl(248, 32%, 70%)"   // Soft lavender
const C5 = "hsl(215, 22%, 78%)"   // Light slate

// ---------------------------------------------------------------------------
// Chart configs
// ---------------------------------------------------------------------------

const bookingVolumeConfig = {
  flight:      { label: "Flight",      color: C1 },
  groundwork:  { label: "Groundwork",  color: C2 },
  maintenance: { label: "Maintenance", color: C3 },
  other:       { label: "Other",       color: C5 },
} satisfies ChartConfig

const cancellationRateConfig = {
  rate: { label: "Cancellation %", color: C2 },
} satisfies ChartConfig

const instructorConfig = {
  hours: { label: "Hours", color: C1 },
} satisfies ChartConfig

const flyingHoursByMonthConfig = {
  hours: { label: "Hours", color: C1 },
} satisfies ChartConfig

const weekendWeekdayConfig = {
  weekend: { label: "Weekend", color: C1 },
  weekday: { label: "Weekday", color: C3 },
} satisfies ChartConfig

const stageConfig = {
  hours: { label: "Hours", color: C4 },
} satisfies ChartConfig

const cancellationsConfig = {
  count: { label: "Cancellations", color: C2 },
} satisfies ChartConfig

// ---------------------------------------------------------------------------
// Summary card
// ---------------------------------------------------------------------------

function SummaryCard({
  title,
  value,
  description,
  icon: Icon,
}: {
  title: string
  value: string | number
  description: string
  icon: React.ComponentType<{ className?: string }>
}) {
  return (
    <Card className="relative overflow-hidden border-slate-200/60 bg-white shadow-sm transition-all hover:shadow-md">
      <div className="absolute inset-0 bg-gradient-to-br from-slate-50/50 to-transparent" />
      <CardContent className="relative flex flex-col p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-slate-600">{title}</h3>
          <div className="rounded-md bg-slate-100/80 p-1.5 ring-1 ring-slate-200/50">
            <Icon className="h-4 w-4 text-slate-600" />
          </div>
        </div>
        <div>
          <div className="text-3xl font-bold tracking-tight text-slate-900">{value}</div>
          <p className="mt-1 text-xs font-medium text-slate-500">{description}</p>
        </div>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-[200px] items-center justify-center">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Bookings-style tab bar
// ---------------------------------------------------------------------------

const TABS = [
  { id: "flying-activity", label: "Flying Activity" },
  { id: "staff", label: "Staff" },
  { id: "aircraft", label: "Aircraft" },
] as const

type TabId = (typeof TABS)[number]["id"]

function TabBar({
  active,
  onChange,
  canViewStaffAndAircraft,
}: {
  active: TabId
  onChange: (id: TabId) => void
  canViewStaffAndAircraft: boolean
}) {
  const visibleTabs = canViewStaffAndAircraft ? TABS : TABS.filter((tab) => tab.id === "flying-activity")

  return (
    <div className="relative -mx-4 px-4 md:mx-0 md:px-0">
      <div className="scrollbar-hide flex items-center gap-1 overflow-x-auto border-b border-slate-200">
        {visibleTabs.map((tab) => {
          const isActive = active === tab.id
          return (
            <button
              type="button"
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={cn(
                "flex shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-semibold transition-all active:scale-95",
                isActive
                  ? "border-slate-900 text-slate-900"
                  : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
              )}
            >
              {tab.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Flying activity section
// ---------------------------------------------------------------------------

function formatHours(value: number | null | undefined): string {
  if (!Number.isFinite(value ?? NaN)) return "0.0h"
  return `${(value ?? 0).toFixed(1)}h`
}

function formatPercent(value: number | null | undefined): string {
  if (!Number.isFinite(value ?? NaN)) return "0.0%"
  return `${(value ?? 0).toFixed(1)}%`
}

function formatMonthLabel(yearMonth: string): string {
  const [year, month] = yearMonth.split("-")
  const date = new Date(Number(year), Number(month) - 1, 1)
  return date.toLocaleDateString("en-NZ", { month: "short", year: "2-digit" })
}

function FlyingMetricItem({
  title,
  value,
  helpText,
}: {
  title: string
  value: string
  helpText?: string
}) {
  return (
    <div className="flex flex-col gap-1 p-4 sm:p-5 transition-colors hover:bg-slate-50/50">
      <div className="flex items-center gap-1.5 text-slate-500 mb-1">
        <span className="text-[11px] font-semibold uppercase tracking-wider">{title}</span>
        {helpText && (
          <div className="group relative flex cursor-help items-center justify-center">
            <IconInfoCircle className="h-3.5 w-3.5 text-slate-400" />
            <div className="absolute bottom-full left-1/2 z-50 mb-2 hidden w-48 -translate-x-1/2 rounded-md bg-slate-800 px-2 py-1.5 text-xs text-slate-100 opacity-0 shadow-lg group-hover:block group-hover:opacity-100">
              {helpText}
              <div className="absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 bg-slate-800" />
            </div>
          </div>
        )}
      </div>
      <p className="text-2xl font-semibold tracking-tight text-slate-900">{value}</p>
    </div>
  )
}


// ---------------------------------------------------------------------------
// Main dashboard
// ---------------------------------------------------------------------------

export function ReportsDashboard({
  data,
  dateRange,
  flyingActivity,
  staffDashboard,
  aircraftUtilisation,
  hoursByFlightType,
  role,
}: {
  data: ReportData
  dateRange: DateRange
  flyingActivity: FlyingActivityDashboard | null
  staffDashboard: StaffDashboard | null
  aircraftUtilisation: AircraftUtilisationDashboard | null
  hoursByFlightType: HoursByFlightTypeRow[]
  role: string | null
}) {
  const [activeTab, setActiveTab] = React.useState<TabId>("flying-activity")
  const canViewStaffAndAircraft = role === "owner" || role === "admin" || role === "instructor"

  React.useEffect(() => {
    if (!canViewStaffAndAircraft && activeTab !== "flying-activity") {
      setActiveTab("flying-activity")
    }
  }, [activeTab, canViewStaffAndAircraft])

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Reports</h1>
          <p className="mt-1 text-slate-600">
            Flight school analytics and insights.
          </p>
        </div>
        <DateRangeSelector dateRange={dateRange} />
      </div>

      {/* Bookings-style tab bar */}
      <TabBar
        active={activeTab}
        onChange={setActiveTab}
        canViewStaffAndAircraft={canViewStaffAndAircraft}
      />

      {/* ---- OVERVIEW PANEL ---- */}
      {activeTab === "flying-activity" && (
        <div className="flex flex-col gap-4">
          {/* Summary cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard
              title="Total Bookings"
              value={data.summary.totalBookings.toLocaleString()}
              description={`${data.summary.completedBookings} completed · ${data.summary.cancelledBookings} cancelled`}
              icon={IconCalendarEvent}
            />
            <SummaryCard
              title="Flight Hours"
              value={data.summary.totalFlightHours.toLocaleString()}
              description="Hours from completed bookings"
              icon={IconClock}
            />
            <SummaryCard
              title="Active Aircraft"
              value={data.summary.activeAircraft}
              description="Currently on-line"
              icon={IconPlane}
            />
            <SummaryCard
              title="Open Observations"
              value={data.summary.openObservations}
              description={`${data.summary.activeStudents} active students`}
              icon={IconAlertTriangle}
            />
          </div>

          {/* Flying Activity Bar */}
          <div className="flex flex-col gap-3">
            <h3 className="px-1 text-sm font-semibold text-slate-900">Flying Activity</h3>
            <Card className="overflow-hidden border-slate-200/60 bg-white shadow-sm">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
                <FlyingMetricItem title="Total Hours" value={formatHours(flyingActivity?.total_flying_hours)} />
                <FlyingMetricItem title="Dual Hours" value={formatHours(flyingActivity?.dual_hours)} />
                <FlyingMetricItem title="Solo Hours" value={formatHours(flyingActivity?.solo_hours)} />
                <FlyingMetricItem title="Trial Hours" value={formatHours(flyingActivity?.trial_flight_hours)} />
                <FlyingMetricItem
                  title="Avg Flight Duration"
                  value={formatHours(flyingActivity?.avg_flight_duration_hours)}
                />
                <FlyingMetricItem 
                  title="Conversion Rate" 
                  value={formatPercent(flyingActivity?.conversion_rate)} 
                  helpText="Percentage of trial flights that resulted in a student enrollment."
                />
              </div>
            </Card>
          </div>

          {/* Timelines */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="relative overflow-hidden border-slate-200/60 bg-white shadow-sm transition-all hover:shadow-md">
              <CardHeader className="px-4 pt-4 pb-0">
                <CardTitle className="text-sm font-semibold text-slate-900">Hours by Month</CardTitle>
                <CardDescription className="text-xs">Completed flight hours</CardDescription>
              </CardHeader>
              <CardContent className="px-2 pb-4">
                {(!flyingActivity || flyingActivity.hours_by_month.length === 0) ? (
                  <EmptyChart message="No monthly flying hours in this period" />
                ) : (
                  <ChartContainer
                    config={flyingHoursByMonthConfig}
                    className="aspect-auto h-[220px] w-full"
                  >
                    <BarChart data={flyingActivity.hours_by_month.map((item) => ({ ...item, label: formatMonthLabel(item.month) }))}>
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
                      <YAxis tickLine={false} axisLine={false} tickMargin={8} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="hours" fill="var(--color-hours)" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>

            <Card className="relative overflow-hidden border-slate-200/60 bg-white shadow-sm transition-all hover:shadow-md">
              <CardHeader className="px-4 pt-4 pb-0">
                <CardTitle className="text-sm font-semibold text-slate-900">Booking Volume</CardTitle>
                <CardDescription className="text-xs">Monthly bookings by type</CardDescription>
              </CardHeader>
              <CardContent className="px-2 pb-4">
                {data.bookingVolume.every((m) => m.total === 0) ? (
                  <EmptyChart message="No booking data available for this period" />
                ) : (
                  <ChartContainer
                    config={bookingVolumeConfig}
                    className="aspect-auto h-[220px] w-full"
                  >
                    <BarChart
                      data={data.bookingVolume}
                      margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
                      <YAxis tickLine={false} axisLine={false} tickMargin={8} allowDecimals={false} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <ChartLegend content={<ChartLegendContent />} />
                      <Bar dataKey="flight" stackId="a" fill="var(--color-flight)" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="groundwork" stackId="a" fill="var(--color-groundwork)" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="maintenance" stackId="a" fill="var(--color-maintenance)" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="other" stackId="a" fill="var(--color-other)" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Breakdowns */}
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="relative overflow-hidden border-slate-200/60 bg-white shadow-sm transition-all hover:shadow-md">
              <CardHeader className="px-4 pt-4 pb-0">
                <CardTitle className="text-sm font-semibold text-slate-900">Weekend vs Weekday</CardTitle>
                <CardDescription className="text-xs">Share of total flight hours</CardDescription>
              </CardHeader>
              <CardContent className="px-2 pb-4">
                {(!flyingActivity || (flyingActivity.weekend_hours + flyingActivity.weekday_hours) === 0) ? (
                  <EmptyChart message="No flight hours in this period" />
                ) : (
                  <ChartContainer
                    config={weekendWeekdayConfig}
                    className="mx-auto aspect-square max-h-[200px]"
                  >
                    <PieChart>
                      <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                      <Pie
                        data={[
                          { name: "Weekend", hours: flyingActivity.weekend_hours, fill: "var(--color-weekend)" },
                          { name: "Weekday", hours: flyingActivity.weekday_hours, fill: "var(--color-weekday)" },
                        ]}
                        dataKey="hours"
                        nameKey="name"
                        innerRadius={50}
                        strokeWidth={4}
                      >
                        <Label
                          content={({ viewBox }) => {
                            if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                              const total = flyingActivity.weekend_hours + flyingActivity.weekday_hours
                              const pct = total > 0 ? Math.round((flyingActivity.weekend_hours / total) * 100) : 0
                              return (
                                <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                                  <tspan x={viewBox.cx} y={viewBox.cy} className="fill-foreground text-2xl font-bold">
                                    {pct}%
                                  </tspan>
                                  <tspan x={viewBox.cx} y={(viewBox.cy ?? 0) + 20} className="fill-muted-foreground text-xs">
                                    Weekend
                                  </tspan>
                                </text>
                              )
                            }
                            return null
                          }}
                        />
                      </Pie>
                      <ChartLegend content={<ChartLegendContent nameKey="name" />} />
                    </PieChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>

            <HoursByFlightTypeChart rows={hoursByFlightType} />

            <Card className="relative overflow-hidden border-slate-200/60 bg-white shadow-sm transition-all hover:shadow-md">
              <CardHeader className="px-4 pt-4 pb-0">
                <CardTitle className="text-sm font-semibold text-slate-900">Hours by Stage</CardTitle>
                <CardDescription className="text-xs">Distribution across training stages</CardDescription>
              </CardHeader>
              <CardContent className="px-2 pb-4">
                {(!flyingActivity || flyingActivity.hours_by_stage.length === 0) ? (
                  <EmptyChart message="No stage data in this period." />
                ) : (
                  <ChartContainer
                    config={stageConfig}
                    className="aspect-auto w-full"
                    style={{ height: `${Math.max(180, flyingActivity.hours_by_stage.length * 32)}px` }}
                  >
                    <BarChart
                      data={flyingActivity.hours_by_stage}
                      layout="vertical"
                      margin={{ top: 8, right: 32, left: 8, bottom: 0 }}
                    >
                      <CartesianGrid horizontal={false} />
                      <YAxis dataKey="stage" type="category" tickLine={false} axisLine={false} tickMargin={8} width={100} />
                      <XAxis type="number" tickLine={false} axisLine={false} tickMargin={8} />
                      <ChartTooltip content={<ChartTooltipContent formatter={(value, _name, item) => [`${value} hrs`, item.payload.stage]} />} />
                      <Bar dataKey="hours" fill="var(--color-hours)" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Operations & Instructors */}
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="relative overflow-hidden border-slate-200/60 bg-white shadow-sm lg:col-span-1 transition-all hover:shadow-md">
              <CardHeader className="px-4 pt-4 pb-0">
                <CardTitle className="text-sm font-semibold text-slate-900">Instructor Utilisation</CardTitle>
                <CardDescription className="text-xs">Hours flown per instructor</CardDescription>
              </CardHeader>
              <CardContent className="px-2 pb-4">
                {data.instructorUtilisation.length === 0 ? (
                  <EmptyChart message="No instructor bookings in this period" />
                ) : (
                  <ChartContainer
                    config={instructorConfig}
                    className="aspect-auto w-full"
                    style={{ height: `${Math.max(220, data.instructorUtilisation.length * 32)}px` }}
                  >
                    <BarChart
                      data={data.instructorUtilisation}
                      layout="vertical"
                      margin={{ top: 8, right: 32, left: 8, bottom: 0 }}
                    >
                      <CartesianGrid horizontal={false} />
                      <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} tickMargin={8} width={90} />
                      <XAxis type="number" tickLine={false} axisLine={false} tickMargin={8} />
                      <ChartTooltip content={<ChartTooltipContent formatter={(value, _name, item) => [`${value} hrs · ${item.payload.bookings} bookings`, "Utilisation"]} />} />
                      <Bar dataKey="hours" fill="var(--color-hours)" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>

            <Card className="relative overflow-hidden border-slate-200/60 bg-white shadow-sm lg:col-span-2 transition-all hover:shadow-md">
              <CardHeader className="px-4 pt-4 pb-0">
                <CardTitle className="text-sm font-semibold text-slate-900">Cancellation Rate</CardTitle>
                <CardDescription className="text-xs">Percentage of bookings cancelled each month</CardDescription>
              </CardHeader>
              <CardContent className="px-2 pb-4">
                {data.cancellationRate.every((m) => m.total === 0) ? (
                  <EmptyChart message="No booking data available for this period" />
                ) : (
                  <ChartContainer
                    config={cancellationRateConfig}
                    className="aspect-auto h-[220px] w-full"
                  >
                    <AreaChart
                      data={data.cancellationRate}
                      margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
                      <YAxis tickLine={false} axisLine={false} tickMargin={8} unit="%" domain={[0, "auto"]} />
                      <ChartTooltip content={<ChartTooltipContent formatter={(value) => [`${value}%`, "Cancellation Rate"]} />} />
                      <defs>
                        <linearGradient id="fillRate" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--color-rate)" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="var(--color-rate)" stopOpacity={0.05} />
                        </linearGradient>
                      </defs>
                      <Area dataKey="rate" type="monotone" fill="url(#fillRate)" stroke="var(--color-rate)" strokeWidth={2} />
                    </AreaChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Cancellation Details */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="relative overflow-hidden border-slate-200/60 bg-white shadow-sm transition-all hover:shadow-md">
              <CardHeader className="px-4 pt-4 pb-2">
                <CardTitle className="text-sm font-semibold text-slate-900">Top Cancellation Reasons</CardTitle>
                <CardDescription className="text-xs">Most frequent reasons in this period</CardDescription>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                {data.cancellationReasons.length === 0 ? (
                  <EmptyChart message="No cancellations in this period" />
                ) : (
                  <div className="space-y-3">
                    {data.cancellationReasons.map((reason) => {
                      const total = data.summary.cancelledBookings || 1
                      const pct = Math.round((reason.count / total) * 100)
                      return (
                        <div key={reason.name} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="truncate font-medium">{reason.name}</span>
                            <span className="ml-2 shrink-0 text-muted-foreground">{reason.count} ({pct}%)</span>
                          </div>
                          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: C2, opacity: 0.6 }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="relative overflow-hidden border-slate-200/60 bg-white shadow-sm transition-all hover:shadow-md">
              <CardHeader className="px-4 pt-4 pb-0">
                <CardTitle className="text-sm font-semibold text-slate-900">Cancellations by Category</CardTitle>
                <CardDescription className="text-xs">Breakdown of cancelled flights</CardDescription>
              </CardHeader>
              <CardContent className="px-2 pb-4">
                {(!flyingActivity || (flyingActivity.cancellations_by_category ?? []).length === 0) ? (
                  <EmptyChart message="No cancellations in this period." />
                ) : (
                  <ChartContainer
                    config={cancellationsConfig}
                    className="aspect-auto w-full"
                    style={{ height: `${Math.max(180, (flyingActivity.cancellations_by_category ?? []).length * 32)}px` }}
                  >
                    <BarChart
                      data={flyingActivity.cancellations_by_category ?? []}
                      layout="vertical"
                      margin={{ top: 8, right: 32, left: 8, bottom: 0 }}
                    >
                      <CartesianGrid horizontal={false} />
                      <YAxis dataKey="category" type="category" tickLine={false} axisLine={false} tickMargin={8} width={120} />
                      <XAxis type="number" tickLine={false} axisLine={false} tickMargin={8} />
                      <ChartTooltip
                        content={
                          <ChartTooltipContent
                            formatter={(value, _name, item) => {
                              const totalCancellations = (flyingActivity.cancellations_by_category ?? []).reduce((sum, i) => sum + i.count, 0)
                              const pct = totalCancellations > 0 ? Math.round((Number(value) / totalCancellations) * 100) : 0
                              return [`${value} (${pct}%)`, item.payload.category]
                            }}
                          />
                        }
                      />
                      <Bar dataKey="count" fill="var(--color-count)" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ---- STAFF PANEL ---- */}
      {activeTab === "staff" && canViewStaffAndAircraft && (
        <div className="flex flex-col gap-4">
          <StaffDualHoursCards
            dualHoursSalary={staffDashboard?.dual_hours_salary ?? 0}
            dualHoursContractor={staffDashboard?.dual_hours_contractor ?? 0}
          />
          <InstructorRevenueRanking instructors={staffDashboard?.instructors ?? []} />
          <StudentsPerInstructor rows={staffDashboard?.students_per_instructor ?? []} />
        </div>
      )}

      {/* ---- AIRCRAFT PANEL ---- */}
      {activeTab === "aircraft" && canViewStaffAndAircraft && (
        <div className="flex flex-col gap-4">
          <AircraftUtilisationTable
            rows={aircraftUtilisation?.aircraft ?? []}
            dailyAvailableHours={aircraftUtilisation?.daily_available_hours ?? 10}
          />
          <AircraftUtilisationTrendChart rows={aircraftUtilisation?.monthly_by_aircraft ?? []} />
        </div>
      )}

    </div>
  )
}
