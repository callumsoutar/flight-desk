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
import type { ReportData, DateRange } from "@/lib/reports/fetch-report-data"
import type { FlyingActivityDashboard } from "@/lib/types/reports"

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

const aircraftConfig = {
  hours: { label: "Hours Flown", color: C1 },
} satisfies ChartConfig

const trainingConfig = {
  pass:             { label: "Pass",              color: C1 },
  notYetCompetent:  { label: "Not Yet Competent", color: C4 },
} satisfies ChartConfig

const syllabusConfig = {
  inProgress: { label: "In Progress", color: C1 },
  completed:  { label: "Completed",   color: C3 },
} satisfies ChartConfig

const observationTrendsConfig = {
  count: { label: "Observations", color: C2 },
} satisfies ChartConfig

const observationStageConfig = {
  open:          { label: "Open",          color: C1 },
  investigation: { label: "Investigation", color: C2 },
  resolution:    { label: "Resolution",    color: C3 },
  closed:        { label: "Closed",        color: C5 },
} satisfies ChartConfig

const flyingHoursByMonthConfig = {
  hours: { label: "Hours", color: C1 },
} satisfies ChartConfig

const weekendWeekdayConfig = {
  weekend: { label: "Weekend", color: C1 },
  weekday: { label: "Weekday", color: C3 },
} satisfies ChartConfig

const flightTypeConfig = {
  hours: { label: "Hours", color: C2 },
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

function SummaryItem({
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
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2 text-slate-500 mb-2">
        <Icon className="h-4 w-4" />
        <span className="text-sm font-medium">{title}</span>
      </div>
      <div className="text-3xl font-semibold tracking-tight text-slate-900">{value}</div>
      <p className="text-xs font-medium text-slate-500">{description}</p>
    </div>
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
  { id: "overview",   label: "Overview"   },
  { id: "aircraft",   label: "Aircraft"   },
  { id: "training",   label: "Training"   },
  { id: "operations", label: "Operations" },
] as const

type TabId = (typeof TABS)[number]["id"]

function TabBar({
  active,
  onChange,
}: {
  active: TabId
  onChange: (id: TabId) => void
}) {
  return (
    <div className="relative -mx-4 px-4 md:mx-0 md:px-0">
      <div className="scrollbar-hide flex items-center gap-1 overflow-x-auto border-b border-slate-200">
        {TABS.map((tab) => {
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
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5 text-slate-500 mb-1">
        <span className="text-xs font-medium uppercase tracking-wider">{title}</span>
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
}: {
  data: ReportData
  dateRange: DateRange
  flyingActivity: FlyingActivityDashboard | null
}) {
  const [activeTab, setActiveTab] = React.useState<TabId>("overview")

  const totalObservations = data.observationsByStage.reduce(
    (sum, s) => sum + s.count,
    0
  )

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
      <TabBar active={activeTab} onChange={setActiveTab} />

      {/* ---- OVERVIEW PANEL ---- */}
      {activeTab === "overview" && (
        <div className="flex flex-col gap-4">
          {/* Unified Metrics Card */}
          <Card className="overflow-hidden border-slate-200/60 bg-white shadow-sm">
            <div className="p-6 sm:p-8">
              <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:divide-x lg:divide-slate-200/60">
                <SummaryItem
                  title="Total Bookings"
                  value={data.summary.totalBookings.toLocaleString()}
                  description={`${data.summary.completedBookings} completed · ${data.summary.cancelledBookings} cancelled`}
                  icon={IconCalendarEvent}
                />
                <div className="lg:pl-8">
                  <SummaryItem
                    title="Flight Hours"
                    value={data.summary.totalFlightHours.toLocaleString()}
                    description="Hours from completed bookings"
                    icon={IconClock}
                  />
                </div>
                <div className="lg:pl-8">
                  <SummaryItem
                    title="Active Aircraft"
                    value={data.summary.activeAircraft}
                    description="Currently on-line"
                    icon={IconPlane}
                  />
                </div>
                <div className="lg:pl-8">
                  <SummaryItem
                    title="Open Observations"
                    value={data.summary.openObservations}
                    description={`${data.summary.activeStudents} active students`}
                    icon={IconAlertTriangle}
                  />
                </div>
              </div>
            </div>
            
            <div className="border-t border-slate-100 bg-slate-50/50 p-6 sm:px-8 sm:py-6">
              <div className="mb-6 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900">Flying Activity</h3>
              </div>
              <div className="grid grid-cols-2 gap-y-8 gap-x-6 sm:grid-cols-3 lg:grid-cols-6 lg:divide-x lg:divide-slate-200/60">
                <FlyingMetricItem title="Total Hours" value={formatHours(flyingActivity?.total_flying_hours)} />
                <div className="lg:pl-6">
                  <FlyingMetricItem title="Dual Hours" value={formatHours(flyingActivity?.dual_hours)} />
                </div>
                <div className="lg:pl-6">
                  <FlyingMetricItem title="Solo Hours" value={formatHours(flyingActivity?.solo_hours)} />
                </div>
                <div className="lg:pl-6">
                  <FlyingMetricItem title="Trial Hours" value={formatHours(flyingActivity?.trial_flight_hours)} />
                </div>
                <div className="lg:pl-6">
                  <FlyingMetricItem
                    title="Avg Flight Duration"
                    value={formatHours(flyingActivity?.avg_flight_duration_hours)}
                  />
                </div>
                <div className="lg:pl-6">
                  <FlyingMetricItem 
                    title="Conversion Rate" 
                    value={formatPercent(flyingActivity?.conversion_rate)} 
                    helpText="Percentage of trial flights that resulted in a student enrollment."
                  />
                </div>
              </div>
            </div>
          </Card>

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

            <Card className="relative overflow-hidden border-slate-200/60 bg-white shadow-sm transition-all hover:shadow-md">
              <CardHeader className="px-4 pt-4 pb-0">
                <CardTitle className="text-sm font-semibold text-slate-900">Hours by Flight Type</CardTitle>
                <CardDescription className="text-xs">Distribution of flight types</CardDescription>
              </CardHeader>
              <CardContent className="px-2 pb-4">
                {(!flyingActivity || flyingActivity.hours_by_flight_type.length === 0) ? (
                  <EmptyChart message="No flight type data in this period." />
                ) : (
                  <ChartContainer
                    config={flightTypeConfig}
                    className="aspect-auto w-full"
                    style={{ height: `${Math.max(180, flyingActivity.hours_by_flight_type.length * 32)}px` }}
                  >
                    <BarChart
                      data={flyingActivity.hours_by_flight_type}
                      layout="vertical"
                      margin={{ top: 8, right: 32, left: 8, bottom: 0 }}
                    >
                      <CartesianGrid horizontal={false} />
                      <YAxis dataKey="flight_type" type="category" tickLine={false} axisLine={false} tickMargin={8} width={90} />
                      <XAxis type="number" tickLine={false} axisLine={false} tickMargin={8} />
                      <ChartTooltip content={<ChartTooltipContent formatter={(value, _name, item) => [`${value} hrs`, item.payload.flight_type]} />} />
                      <Bar dataKey="hours" fill="var(--color-hours)" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>

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

      {/* ---- AIRCRAFT PANEL ---- */}
      {activeTab === "aircraft" && (
        <div className="flex flex-col gap-4">
          <Card className="relative overflow-hidden border-slate-200/60 bg-white shadow-sm transition-all hover:shadow-md">
            <CardHeader className="px-5 pt-5 pb-0">
              <CardTitle className="text-sm font-semibold text-slate-900">Hours Flown per Aircraft</CardTitle>
              <CardDescription className="text-xs">
                Total hours from completed bookings in this period
              </CardDescription>
            </CardHeader>
            <CardContent className="px-3 pb-5">
              {data.aircraftHours.every((a) => a.hours === 0) ? (
                <EmptyChart message="No completed flights for this period" />
              ) : (
                <ChartContainer
                  config={aircraftConfig}
                  className="aspect-auto w-full"
                  style={{
                    height: `${Math.max(250, data.aircraftHours.length * 44)}px`,
                  }}
                >
                  <BarChart
                    data={data.aircraftHours}
                    layout="vertical"
                    margin={{ top: 8, right: 48, left: 8, bottom: 0 }}
                  >
                    <CartesianGrid horizontal={false} />
                    <YAxis
                      dataKey="registration"
                      type="category"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      width={100}
                    />
                    <XAxis
                      type="number"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                    />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          formatter={(value, _name, item) => [
                            `${value} hrs · ${item.payload.bookings} flights`,
                            item.payload.type,
                          ]}
                        />
                      }
                    />
                    <Bar dataKey="hours" fill="var(--color-hours)" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ---- TRAINING PANEL ---- */}
      {activeTab === "training" && (
        <div className="flex flex-col gap-4">
          {/* Training Activity */}
          <Card className="relative overflow-hidden border-slate-200/60 bg-white shadow-sm transition-all hover:shadow-md">
            <CardHeader className="px-5 pt-5 pb-0">
              <CardTitle className="text-sm font-semibold text-slate-900">Training Activity</CardTitle>
              <CardDescription className="text-xs">Monthly lesson sessions and outcomes</CardDescription>
            </CardHeader>
            <CardContent className="px-3 pb-5">
              {data.trainingActivity.every((m) => m.sessions === 0) ? (
                <EmptyChart message="No training sessions in this period" />
              ) : (
                <ChartContainer
                  config={trainingConfig}
                  className="aspect-auto h-[300px] w-full"
                >
                  <BarChart
                    data={data.trainingActivity}
                    margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid vertical={false} />
                    <XAxis
                      dataKey="label"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      allowDecimals={false}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <ChartLegend content={<ChartLegendContent />} />
                    <Bar dataKey="pass"            stackId="a" fill="var(--color-pass)"            radius={[0, 0, 0, 0]} />
                    <Bar dataKey="notYetCompetent" stackId="a" fill="var(--color-notYetCompetent)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>

          {/* Syllabus Progress */}
          <Card className="relative overflow-hidden border-slate-200/60 bg-white shadow-sm transition-all hover:shadow-md">
            <CardHeader className="px-5 pt-5 pb-0">
              <CardTitle className="text-sm font-semibold text-slate-900">Syllabus Progress</CardTitle>
              <CardDescription className="text-xs">
                Student enrollment and completion by syllabus
              </CardDescription>
            </CardHeader>
            <CardContent className="px-3 pb-5">
              {data.syllabusProgress.length === 0 ? (
                <EmptyChart message="No syllabus enrollment data" />
              ) : (
                <ChartContainer
                  config={syllabusConfig}
                  className="aspect-auto w-full"
                  style={{
                    height: `${Math.max(200, data.syllabusProgress.length * 52)}px`,
                  }}
                >
                  <BarChart
                    data={data.syllabusProgress}
                    layout="vertical"
                    margin={{ top: 8, right: 48, left: 8, bottom: 0 }}
                  >
                    <CartesianGrid horizontal={false} />
                    <YAxis
                      dataKey="name"
                      type="category"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      width={140}
                    />
                    <XAxis
                      type="number"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      allowDecimals={false}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <ChartLegend content={<ChartLegendContent />} />
                    <Bar dataKey="inProgress" stackId="a" fill="var(--color-inProgress)" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="completed"  stackId="a" fill="var(--color-completed)"  radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ---- OPERATIONS PANEL ---- */}
      {activeTab === "operations" && (
        <div className="flex flex-col gap-4">
          <div className="grid gap-4 lg:grid-cols-7">
            {/* Observation Trends */}
            <Card className="relative overflow-hidden border-slate-200/60 bg-white shadow-sm lg:col-span-4 transition-all hover:shadow-md">
              <CardHeader className="px-5 pt-5 pb-0">
                <CardTitle className="text-sm font-semibold text-slate-900">Observation Trends</CardTitle>
                <CardDescription className="text-xs">
                  Monthly observations reported
                </CardDescription>
              </CardHeader>
              <CardContent className="px-3 pb-5">
                {data.observationTrends.every((m) => m.count === 0) ? (
                  <EmptyChart message="No observations in this period" />
                ) : (
                  <ChartContainer
                    config={observationTrendsConfig}
                    className="aspect-auto h-[250px] w-full"
                  >
                    <AreaChart
                      data={data.observationTrends}
                      margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid vertical={false} />
                      <XAxis
                        dataKey="label"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                        allowDecimals={false}
                      />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <defs>
                        <linearGradient id="fillObservations" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="var(--color-count)" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="var(--color-count)" stopOpacity={0.05} />
                        </linearGradient>
                      </defs>
                      <Area
                        dataKey="count"
                        type="monotone"
                        fill="url(#fillObservations)"
                        stroke="var(--color-count)"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>

            {/* Observations by Stage */}
            <Card className="relative overflow-hidden border-slate-200/60 bg-white shadow-sm lg:col-span-3 transition-all hover:shadow-md">
              <CardHeader className="px-5 pt-5 pb-0">
                <CardTitle className="text-sm font-semibold text-slate-900">Observations by Stage</CardTitle>
                <CardDescription className="text-xs">
                  Current breakdown across all observations
                </CardDescription>
              </CardHeader>
              <CardContent className="px-3 pb-5">
                {data.observationsByStage.length === 0 ? (
                  <EmptyChart message="No observations recorded" />
                ) : (
                  <ChartContainer
                    config={observationStageConfig}
                    className="mx-auto aspect-square max-h-[250px]"
                  >
                    <PieChart>
                      <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                      <Pie
                        data={data.observationsByStage}
                        dataKey="count"
                        nameKey="stage"
                        innerRadius={60}
                        strokeWidth={5}
                      >
                        <Label
                          content={({ viewBox }) => {
                            if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                              return (
                                <text
                                  x={viewBox.cx}
                                  y={viewBox.cy}
                                  textAnchor="middle"
                                  dominantBaseline="middle"
                                >
                                  <tspan
                                    x={viewBox.cx}
                                    y={viewBox.cy}
                                    className="fill-foreground text-3xl font-bold"
                                  >
                                    {totalObservations}
                                  </tspan>
                                  <tspan
                                    x={viewBox.cx}
                                    y={(viewBox.cy ?? 0) + 24}
                                    className="fill-muted-foreground"
                                  >
                                    Total
                                  </tspan>
                                </text>
                              )
                            }
                            return null
                          }}
                        />
                      </Pie>
                      <ChartLegend content={<ChartLegendContent nameKey="stage" />} />
                    </PieChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}
