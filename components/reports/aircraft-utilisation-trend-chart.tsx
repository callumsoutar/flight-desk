"use client"

import * as React from "react"
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import type { AircraftMonthlyHours } from "@/lib/types/reports"
import { cn } from "@/lib/utils"

const palette = [
  "hsl(217, 55%, 45%)",
  "hsl(235, 45%, 55%)",
  "hsl(199, 45%, 52%)",
  "hsl(260, 35%, 58%)",
  "hsl(170, 35%, 42%)",
  "hsl(42, 88%, 53%)",
]

function formatMonthLabel(yearMonth: string): string {
  const [year, month] = yearMonth.split("-")
  const date = new Date(Number(year), Number(month) - 1, 1)
  return date.toLocaleDateString("en-NZ", { month: "short", year: "2-digit" })
}

export function AircraftUtilisationTrendChart({ rows }: { rows: AircraftMonthlyHours[] }) {
  const registrations = React.useMemo(() => Array.from(new Set(rows.map((row) => row.registration))).sort(), [rows])
  const months = React.useMemo(() => Array.from(new Set(rows.map((row) => row.month))).sort(), [rows])

  const [visible, setVisible] = React.useState<Record<string, boolean>>(() =>
    registrations.reduce<Record<string, boolean>>((acc, registration) => {
      acc[registration] = true
      return acc
    }, {})
  )

  React.useEffect(() => {
    setVisible((prev) =>
      registrations.reduce<Record<string, boolean>>((acc, registration) => {
        acc[registration] = prev[registration] ?? true
        return acc
      }, {})
    )
  }, [registrations])

  const seriesColor = React.useMemo(
    () =>
      registrations.reduce<Record<string, string>>((acc, registration, index) => {
        acc[registration] = palette[index % palette.length]
        return acc
      }, {}),
    [registrations]
  )

  const chartData = React.useMemo(() => {
    const lookup = new Map(rows.map((row) => [`${row.month}-${row.registration}`, row.hours_flown]))
    return months.map((month) => {
      const entry: Record<string, string | number> = {
        month,
        label: formatMonthLabel(month),
      }
      for (const registration of registrations) {
        entry[registration] = lookup.get(`${month}-${registration}`) ?? 0
      }
      return entry
    })
  }, [rows, months, registrations])

  const config: ChartConfig = registrations.reduce<ChartConfig>((acc, registration) => {
    acc[registration] = { label: registration, color: seriesColor[registration] }
    return acc
  }, {})

  return (
    <Card className="border-slate-200/60 bg-white shadow-sm">
      <CardHeader>
        <CardTitle className="text-sm font-semibold text-slate-900">Aircraft Utilisation Trend</CardTitle>
      </CardHeader>
      <CardContent>
        {registrations.length === 0 ? (
          <p className="text-sm text-slate-500">No monthly aircraft hours available.</p>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {registrations.map((registration) => (
                <button
                  key={registration}
                  type="button"
                  onClick={() => setVisible((prev) => ({ ...prev, [registration]: !prev[registration] }))}
                  className="cursor-pointer"
                >
                  <Badge
                    variant={visible[registration] ? "default" : "outline"}
                    className={cn(visible[registration] && "text-white")}
                    style={visible[registration] ? { backgroundColor: seriesColor[registration] } : undefined}
                  >
                    {registration}
                  </Badge>
                </button>
              ))}
            </div>

            <ChartContainer config={config} className="aspect-auto h-[280px] w-full">
              <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis tickLine={false} axisLine={false} tickMargin={8} />
                <ChartTooltip content={<ChartTooltipContent />} />
                {registrations.map((registration) =>
                  visible[registration] ? (
                    <Line
                      key={registration}
                      type="monotone"
                      dataKey={registration}
                      stroke={seriesColor[registration]}
                      strokeWidth={2}
                      dot={false}
                    />
                  ) : null
                )}
              </LineChart>
            </ChartContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
