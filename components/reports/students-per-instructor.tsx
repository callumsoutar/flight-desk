"use client"

import * as React from "react"
import { ChevronDown } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { InstructorStudentLoad } from "@/lib/types/reports"
import { cn } from "@/lib/utils"

const HIGH_LOAD_THRESHOLD = 6

function employmentAbbrev(value: string | null) {
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
      return "—"
  }
}

export function StudentsPerInstructor({ rows }: { rows: InstructorStudentLoad[] }) {
  const [open, setOpen] = React.useState<Record<string, boolean>>({})

  const sorted = React.useMemo(
    () => [...rows].sort((a, b) => b.student_count - a.student_count),
    [rows]
  )

  const maxCount = React.useMemo(
    () => Math.max(...sorted.map((r) => r.student_count), 1),
    [sorted]
  )

  if (rows.length === 0) {
    return (
      <Card className="border-slate-200/60 bg-white shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-slate-900">Students per instructor</CardTitle>
          <CardDescription className="text-xs">
            Active enrolled students attributed to each instructor for this period.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-slate-500">No active enrolled students found.</CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-slate-200/60 bg-white shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-slate-900">Students per instructor</CardTitle>
        <CardDescription className="text-xs">
          Ranked by student count. The bar shows load relative to the busiest instructor in this list.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="h-9 pl-4 text-xs font-medium text-slate-500">Instructor</TableHead>
              <TableHead className="h-9 w-[88px] text-xs font-medium text-slate-500">Type</TableHead>
              <TableHead className="h-9 min-w-[140px] text-xs font-medium text-slate-500">Relative load</TableHead>
              <TableHead className="h-9 w-[88px] text-right text-xs font-medium text-slate-500">Students</TableHead>
              <TableHead className="h-9 w-11 pr-3" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((row, index) => {
              const key = `${row.instructor_name}-${index}`
              const expanded = open[key] ?? false
              const highLoad = row.student_count > HIGH_LOAD_THRESHOLD
              const barPct = Math.round((row.student_count / maxCount) * 100)

              return (
                <React.Fragment key={key}>
                  <TableRow
                    className={cn(
                      "group cursor-pointer border-slate-100",
                      highLoad && "border-l-4 border-l-amber-400 bg-amber-50/35"
                    )}
                    onClick={() => setOpen((prev) => ({ ...prev, [key]: !(prev[key] ?? false) }))}
                  >
                    <TableCell className="max-w-[200px] py-2.5 pl-4 align-middle">
                      <div className="flex flex-col gap-0.5">
                        <span className="truncate font-medium text-slate-900">{row.instructor_name}</span>
                        {highLoad ? (
                          <span className="text-[11px] font-medium text-amber-800">
                            High load (&gt;{HIGH_LOAD_THRESHOLD} students)
                          </span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="py-2.5 align-middle">
                      <Badge
                        variant={highLoad ? "default" : "outline"}
                        className={cn(
                          "text-[10px] font-semibold uppercase tracking-wide",
                          highLoad && "border-transparent bg-amber-600 text-white hover:bg-amber-600"
                        )}
                      >
                        {employmentAbbrev(row.employment_type)}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-2.5 align-middle">
                      <div className="flex items-center gap-3">
                        <div className="h-2 min-w-[72px] flex-1 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className={cn(
                              "h-full rounded-full transition-[width] duration-300",
                              highLoad ? "bg-amber-500" : "bg-indigo-600"
                            )}
                            style={{ width: `${barPct}%` }}
                          />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-2.5 text-right align-middle">
                      <span className="tabular-nums text-sm font-semibold text-slate-900">{row.student_count}</span>
                    </TableCell>
                    <TableCell className="py-2.5 pr-2 align-middle">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 text-slate-500"
                        aria-expanded={expanded}
                        aria-label={expanded ? "Hide students" : "Show students"}
                        onClick={(e) => {
                          e.stopPropagation()
                          setOpen((prev) => ({ ...prev, [key]: !expanded }))
                        }}
                      >
                        <ChevronDown
                          className={cn("h-4 w-4 transition-transform duration-200", expanded && "rotate-180")}
                        />
                      </Button>
                    </TableCell>
                  </TableRow>
                  {expanded ? (
                    <TableRow className="border-slate-100 bg-slate-50/90 hover:bg-slate-50/90">
                      <TableCell colSpan={5} className="px-4 py-3">
                        <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-500">
                          Students
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {row.students.map((student) => (
                            <div
                              key={`${student.student_id}-${student.syllabus}`}
                              className="inline-flex max-w-full flex-col rounded-lg border border-slate-200/80 bg-white px-2.5 py-1.5 text-xs shadow-sm"
                            >
                              <span className="font-medium text-slate-800">{student.student_name}</span>
                              <span className="text-[11px] text-slate-500">{student.syllabus}</span>
                            </div>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : null}
                </React.Fragment>
              )
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
