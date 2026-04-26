"use client"

import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import type { HoursByFlightTypeRow } from "@/lib/types/reports"

const chartConfig = {
  total_hours: { label: "Total Hours", color: "hsl(217, 55%, 58%)" },
} satisfies ChartConfig

function colorForInstructionType(value: string) {
  if (value === "dual") return "hsl(217, 55%, 40%)"
  if (value === "solo") return "hsl(220, 18%, 55%)"
  if (value === "trial") return "hsl(40, 90%, 55%)"
  return "hsl(215, 22%, 70%)"
}

export function HoursByFlightTypeChart({
  rows,
  className,
}: {
  rows: HoursByFlightTypeRow[]
  className?: string
}) {
  return (
    <Card
      className={cn(
        "relative w-full min-w-0 overflow-hidden border-slate-200/60 bg-white shadow-sm transition-all hover:shadow-md",
        className
      )}
    >
      <CardHeader className="px-4 pt-4 pb-0">
        <CardTitle className="text-sm font-semibold text-slate-900">Hours by Flight Type</CardTitle>
        <CardDescription className="text-xs">Total hours and share of overall flying activity</CardDescription>
      </CardHeader>
      <CardContent className="px-2 pb-4">
        {rows.length === 0 ? (
          <div className="flex h-[200px] items-center justify-center">
            <p className="text-sm text-muted-foreground">No flight type data in this period.</p>
          </div>
        ) : (
          <ChartContainer
            config={chartConfig}
            className="aspect-auto w-full"
            style={{ height: `${Math.max(200, rows.length * 42)}px` }}
          >
            <BarChart data={rows} layout="vertical" margin={{ top: 8, right: 24, left: 8, bottom: 0 }}>
              <CartesianGrid horizontal={false} />
              <YAxis
                dataKey="flight_type_name"
                type="category"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                width={140}
              />
              <XAxis type="number" tickLine={false} axisLine={false} tickMargin={8} />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value, _name, item) => [
                      `${value}h • ${item.payload.flights} flights • ${item.payload.pct_of_total}%`,
                      item.payload.instruction_type,
                    ]}
                  />
                }
              />
              <Bar dataKey="total_hours" radius={[0, 4, 4, 0]}>
                {rows.map((entry) => (
                  <Cell key={entry.flight_type_id} fill={colorForInstructionType(entry.instruction_type)} />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
