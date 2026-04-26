"use client"

import * as React from "react"
import { Label, Pie, PieChart } from "recharts"

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
import { getRevenueNonRevenueHoursFromRows } from "@/lib/reports/revenue-non-revenue-hours"
import type { HoursByFlightTypeRow } from "@/lib/types/reports"

const C_REV = "hsl(217, 55%, 58%)"
const C_NON = "hsl(215, 22%, 78%)"

const chartConfig = {
  revenue: { label: "Revenue", color: C_REV },
  nonRevenue: { label: "Non-revenue", color: C_NON },
} satisfies ChartConfig

export function RevenueVsNonRevenueChart({ rows }: { rows: HoursByFlightTypeRow[] }) {
  const { revenueHours, nonRevenueHours, total } = React.useMemo(
    () => getRevenueNonRevenueHoursFromRows(rows),
    [rows]
  )
  const pctRevenue = total > 0 ? Math.round((revenueHours / total) * 100) : 0

  return (
    <Card className="relative w-full min-w-0 overflow-hidden border-slate-200/60 bg-white shadow-sm transition-all hover:shadow-md">
      <CardHeader className="px-4 pt-4 pb-0">
        <CardTitle className="text-sm font-semibold text-slate-900">Revenue vs non-revenue</CardTitle>
        <CardDescription className="text-xs">Share of total flight hours</CardDescription>
      </CardHeader>
      <CardContent className="flex justify-center px-2 pb-4">
        {total <= 0 ? (
          <div className="flex h-[200px] w-full items-center justify-center">
            <p className="text-sm text-muted-foreground">No flight hours in this period</p>
          </div>
        ) : (
          <ChartContainer
            config={chartConfig}
            className="mx-auto aspect-square w-full max-w-[min(100%,16rem)] max-h-[220px]"
          >
            <PieChart>
              <ChartTooltip content={<ChartTooltipContent hideLabel />} />
              <Pie
                data={[
                  { name: "Revenue", hours: revenueHours, fill: "var(--color-revenue)" },
                  { name: "Non-revenue", hours: nonRevenueHours, fill: "var(--color-nonRevenue)" },
                ]}
                dataKey="hours"
                nameKey="name"
                innerRadius={50}
                strokeWidth={4}
              >
                <Label
                  content={({ viewBox }) => {
                    if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                      return (
                        <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                          <tspan x={viewBox.cx} y={viewBox.cy} className="fill-foreground text-2xl font-bold">
                            {pctRevenue}%
                          </tspan>
                          <tspan
                            x={viewBox.cx}
                            y={(viewBox.cy ?? 0) + 20}
                            className="fill-muted-foreground text-xs"
                          >
                            Revenue
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
  )
}
