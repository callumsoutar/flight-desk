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
    <Card className="border border-border/50 bg-card py-0 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 px-4 pt-4 pb-2 sm:px-6 sm:pt-6">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent className="px-4 pb-4 sm:px-6 sm:pb-6">
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">{description}</p>
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
  { id: "bookings",   label: "Bookings"   },
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
// Main dashboard
// ---------------------------------------------------------------------------

export function ReportsDashboard({
  data,
  dateRange,
}: {
  data: ReportData
  dateRange: DateRange
}) {
  const [activeTab, setActiveTab] = React.useState<TabId>("bookings")

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

      {/* Bookings-style tab bar */}
      <TabBar active={activeTab} onChange={setActiveTab} />

      {/* ---- BOOKINGS PANEL ---- */}
      {activeTab === "bookings" && (
        <div className="flex flex-col gap-4">
          {/* Booking Volume */}
          <Card className="border border-border/50 bg-card py-0 shadow-sm">
            <CardHeader className="px-4 pt-4 pb-0 sm:px-6 sm:pt-6">
              <CardTitle>Booking Volume</CardTitle>
              <CardDescription>
                Monthly bookings by type
              </CardDescription>
            </CardHeader>
            <CardContent className="px-2 pb-4 sm:px-6 sm:pb-6">
              {data.bookingVolume.every((m) => m.total === 0) ? (
                <EmptyChart message="No booking data available for this period" />
              ) : (
                <ChartContainer
                  config={bookingVolumeConfig}
                  className="aspect-auto h-[300px] w-full"
                >
                  <BarChart
                    data={data.bookingVolume}
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
                    <Bar dataKey="flight"      stackId="a" fill="var(--color-flight)"      radius={[0, 0, 0, 0]} />
                    <Bar dataKey="groundwork"  stackId="a" fill="var(--color-groundwork)"  radius={[0, 0, 0, 0]} />
                    <Bar dataKey="maintenance" stackId="a" fill="var(--color-maintenance)" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="other"       stackId="a" fill="var(--color-other)"       radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-7">
            {/* Cancellation Rate */}
            <Card className="border border-border/50 bg-card py-0 shadow-sm lg:col-span-4">
              <CardHeader className="px-4 pt-4 pb-0 sm:px-6 sm:pt-6">
                <CardTitle>Cancellation Rate</CardTitle>
                <CardDescription>
                  Percentage of bookings cancelled each month
                </CardDescription>
              </CardHeader>
              <CardContent className="px-2 pb-4 sm:px-6 sm:pb-6">
                {data.cancellationRate.every((m) => m.total === 0) ? (
                  <EmptyChart message="No booking data available for this period" />
                ) : (
                  <ChartContainer
                    config={cancellationRateConfig}
                    className="aspect-auto h-[250px] w-full"
                  >
                    <AreaChart
                      data={data.cancellationRate}
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
                        unit="%"
                        domain={[0, "auto"]}
                      />
                      <ChartTooltip
                        content={
                          <ChartTooltipContent
                            formatter={(value) => [`${value}%`, "Cancellation Rate"]}
                          />
                        }
                      />
                      <defs>
                        <linearGradient id="fillRate" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="var(--color-rate)" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="var(--color-rate)" stopOpacity={0.05} />
                        </linearGradient>
                      </defs>
                      <Area
                        dataKey="rate"
                        type="monotone"
                        fill="url(#fillRate)"
                        stroke="var(--color-rate)"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>

            {/* Top Cancellation Reasons */}
            <Card className="border border-border/50 bg-card py-0 shadow-sm lg:col-span-3">
              <CardHeader className="px-4 pt-4 pb-2 sm:px-6 sm:pt-6">
                <CardTitle>Top Cancellation Reasons</CardTitle>
                <CardDescription>
                  Most frequent reasons in this period
                </CardDescription>
              </CardHeader>
              <CardContent className="px-4 pb-4 sm:px-6 sm:pb-6">
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
                            <span className="ml-2 shrink-0 text-muted-foreground">
                              {reason.count} ({pct}%)
                            </span>
                          </div>
                          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${pct}%`,
                              backgroundColor: C2,
                              opacity: 0.6,
                            }}
                          />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Instructor Utilisation */}
          <Card className="border border-border/50 bg-card py-0 shadow-sm">
            <CardHeader className="px-4 pt-4 pb-0 sm:px-6 sm:pt-6">
              <CardTitle>Instructor Utilisation</CardTitle>
              <CardDescription>
                Hours flown per instructor (completed bookings)
              </CardDescription>
            </CardHeader>
            <CardContent className="px-2 pb-4 sm:px-6 sm:pb-6">
              {data.instructorUtilisation.length === 0 ? (
                <EmptyChart message="No completed instructor bookings in this period" />
              ) : (
                <ChartContainer
                  config={instructorConfig}
                  className="aspect-auto w-full"
                  style={{
                    height: `${Math.max(200, data.instructorUtilisation.length * 44)}px`,
                  }}
                >
                  <BarChart
                    data={data.instructorUtilisation}
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
                      width={120}
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
                            `${value} hrs · ${item.payload.bookings} bookings`,
                            "Utilisation",
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

      {/* ---- AIRCRAFT PANEL ---- */}
      {activeTab === "aircraft" && (
        <div className="flex flex-col gap-4">
          <Card className="border border-border/50 bg-card py-0 shadow-sm">
            <CardHeader className="px-4 pt-4 pb-0 sm:px-6 sm:pt-6">
              <CardTitle>Hours Flown per Aircraft</CardTitle>
              <CardDescription>
                Total hours from completed bookings in this period
              </CardDescription>
            </CardHeader>
            <CardContent className="px-2 pb-4 sm:px-6 sm:pb-6">
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
          <Card className="border border-border/50 bg-card py-0 shadow-sm">
            <CardHeader className="px-4 pt-4 pb-0 sm:px-6 sm:pt-6">
              <CardTitle>Training Activity</CardTitle>
              <CardDescription>Monthly lesson sessions and outcomes</CardDescription>
            </CardHeader>
            <CardContent className="px-2 pb-4 sm:px-6 sm:pb-6">
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
          <Card className="border border-border/50 bg-card py-0 shadow-sm">
            <CardHeader className="px-4 pt-4 pb-0 sm:px-6 sm:pt-6">
              <CardTitle>Syllabus Progress</CardTitle>
              <CardDescription>
                Student enrollment and completion by syllabus
              </CardDescription>
            </CardHeader>
            <CardContent className="px-2 pb-4 sm:px-6 sm:pb-6">
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
            <Card className="border border-border/50 bg-card py-0 shadow-sm lg:col-span-4">
              <CardHeader className="px-4 pt-4 pb-0 sm:px-6 sm:pt-6">
                <CardTitle>Observation Trends</CardTitle>
                <CardDescription>
                  Monthly observations reported
                </CardDescription>
              </CardHeader>
              <CardContent className="px-2 pb-4 sm:px-6 sm:pb-6">
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
            <Card className="border border-border/50 bg-card py-0 shadow-sm lg:col-span-3">
              <CardHeader className="px-4 pt-4 pb-0 sm:px-6 sm:pt-6">
                <CardTitle>Observations by Stage</CardTitle>
                <CardDescription>
                  Current breakdown across all observations
                </CardDescription>
              </CardHeader>
              <CardContent className="px-2 pb-4 sm:px-6 sm:pb-6">
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
