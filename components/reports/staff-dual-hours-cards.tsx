"use client"

import * as React from "react"
import { Cell, Label, Pie, PieChart } from "recharts"

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
  type ChartConfig,
} from "@/components/ui/chart"
const chartConfig = {
  salary: {
    label: "Salary staff (FT & PT)",
    color: "hsl(217, 55%, 42%)",
  },
  contractor: {
    label: "Contractor & casual",
    color: "hsl(215, 22%, 58%)",
  },
} satisfies ChartConfig

function formatHours(value: number) {
  return `${value.toFixed(1)}h`
}

export function StaffDualHoursCards({
  dualHoursSalary,
  dualHoursContractor,
}: {
  dualHoursSalary: number
  dualHoursContractor: number
}) {
  const total = dualHoursSalary + dualHoursContractor
  const data = React.useMemo(
    () => [
      { key: "salary" as const, name: chartConfig.salary.label, value: dualHoursSalary, fill: "var(--color-salary)" },
      {
        key: "contractor" as const,
        name: chartConfig.contractor.label,
        value: dualHoursContractor,
        fill: "var(--color-contractor)",
      },
    ],
    [dualHoursSalary, dualHoursContractor]
  )

  const pct = (part: number) => (total > 0 ? Math.round((part / total) * 1000) / 10 : 0)

  return (
    <Card className="border-slate-200/60 bg-white shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-slate-900">Dual hours by employment type</CardTitle>
        <CardDescription className="text-xs">
          Completed flight dual time split between salary employees and contractors/casual.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {total <= 0 ? (
          <div className="flex h-[200px] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50">
            <p className="text-sm text-slate-500">No dual hours in this period.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:gap-10">
            <ChartContainer config={chartConfig} className="mx-auto aspect-square h-[220px] w-full max-w-[260px]">
              <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                <ChartTooltip content={<ChartTooltipContent hideLabel nameKey="name" />} />
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={58}
                  outerRadius={88}
                  strokeWidth={2}
                  stroke="hsl(0, 0%, 100%)"
                >
                  {data.map((entry) => (
                    <Cell key={entry.key} fill={entry.fill} />
                  ))}
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
                            <tspan x={viewBox.cx} y={(viewBox.cy ?? 0) - 6} className="fill-slate-900 text-2xl font-bold">
                              {formatHours(total)}
                            </tspan>
                            <tspan
                              x={viewBox.cx}
                              y={(viewBox.cy ?? 0) + 14}
                              className="fill-muted-foreground text-[11px] font-medium"
                            >
                              total dual
                            </tspan>
                          </text>
                        )
                      }
                      return null
                    }}
                  />
                </Pie>
              </PieChart>
            </ChartContainer>

            <div className="flex min-w-0 flex-1 flex-col justify-center gap-3">
              <div className="rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3">
                <div className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: "hsl(217, 55%, 42%)" }}
                  />
                  <span className="text-sm font-medium text-slate-800">{chartConfig.salary.label}</span>
                </div>
                <div className="mt-1 flex items-baseline justify-between gap-2 pl-5">
                  <span className="text-lg font-semibold tabular-nums text-slate-900">{formatHours(dualHoursSalary)}</span>
                  <span className="text-xs font-medium text-slate-500">{pct(dualHoursSalary)}%</span>
                </div>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3">
                <div className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: "hsl(215, 22%, 58%)" }}
                  />
                  <span className="text-sm font-medium text-slate-800">{chartConfig.contractor.label}</span>
                </div>
                <div className="mt-1 flex items-baseline justify-between gap-2 pl-5">
                  <span className="text-lg font-semibold tabular-nums text-slate-900">{formatHours(dualHoursContractor)}</span>
                  <span className="text-xs font-medium text-slate-500">{pct(dualHoursContractor)}%</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
