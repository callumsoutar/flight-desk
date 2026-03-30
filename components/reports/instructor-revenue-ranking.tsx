"use client"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { InstructorSummary } from "@/lib/types/reports"
import { cn } from "@/lib/utils"

function employmentAbbrev(value: InstructorSummary["employment_type"]) {
  switch (value) {
    case "full_time":
      return "FT"
    case "part_time":
      return "PT"
    case "casual":
      return "Casual"
    case "contractor":
      return "Contractor"
    default:
      return "Unknown"
  }
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-NZ", { style: "currency", currency: "NZD", maximumFractionDigits: 2 }).format(
    value
  )
}

export function InstructorRevenueRanking({ instructors }: { instructors: InstructorSummary[] }) {
  const sorted = [...instructors].sort((a, b) => b.instruction_revenue - a.instruction_revenue)

  return (
    <Card className="border-slate-200/60 bg-white shadow-sm">
      <CardHeader>
        <CardTitle className="text-sm font-semibold text-slate-900">Instructor Revenue Ranking</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Rank</TableHead>
              <TableHead>Instructor</TableHead>
              <TableHead>Rating</TableHead>
              <TableHead>Dual Hours</TableHead>
              <TableHead>Flights</TableHead>
              <TableHead className="text-right">Revenue (NZD)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-sm text-slate-500">
                  No instructor activity in this period.
                </TableCell>
              </TableRow>
            ) : (
              sorted.map((instructor, index) => (
                <TableRow key={instructor.instructor_id} className={cn(index === 0 && "bg-amber-50/70")}>
                  <TableCell>
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2 py-0.5 text-xs font-semibold",
                        index === 0 ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-700"
                      )}
                    >
                      #{index + 1}
                    </span>
                  </TableCell>
                  <TableCell className="font-medium text-slate-900">
                    <div className="flex items-center gap-2">
                      <span>{instructor.instructor_name}</span>
                      <Badge variant="outline" className="text-[10px] uppercase">
                        {employmentAbbrev(instructor.employment_type)}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell>{instructor.rating ?? "-"}</TableCell>
                  <TableCell>{instructor.dual_hours.toFixed(1)}h</TableCell>
                  <TableCell>{instructor.flights}</TableCell>
                  <TableCell className="text-right font-medium">
                    {formatMoney(instructor.instruction_revenue)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
