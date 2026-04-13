"use client"

import * as React from "react"
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useTimezone } from "@/contexts/timezone-context"
import { useAircraftTechLog } from "@/hooks/use-aircraft-tech-log"
import type { AircraftWithType } from "@/lib/types/aircraft"
import type { AircraftTechLogRow, Enums } from "@/lib/types"
import { formatDate, formatDateTime } from "@/lib/utils/date-format"
import { cn } from "@/lib/utils"

const PAGE_SIZE = 25

function isTachoFamily(method: Enums<"total_time_method"> | null | undefined) {
  return method === "tacho" || method === "tacho less 5%" || method === "tacho less 10%"
}

function formatHours(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—"
  return `${value.toFixed(1)}h`
}

function formatReading(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—"
  return value.toFixed(1)
}

/** `tech_log_date` is already a civil calendar day in the tenant zone; avoid interpreting YYYY-MM-DD as a UTC instant then re-formatting in a zone (that shifts the day for ahead-of-UTC regions). */
function formatTechLogDate(value: string): string {
  const [year, month, day] = value.split("-").map(Number)
  if (!year || !month || !day) return value
  return formatDate(new Date(Date.UTC(year, month - 1, day)), "UTC", "medium") || value
}

function DailyDeltaCell({ row }: { row: AircraftTechLogRow }) {
  const isCorrection = (row.daily_delta ?? 0) < 0 || (row.daily_ttis_delta ?? 0) < 0

  return (
    <div className="flex items-center gap-2">
      <span className={cn("font-semibold", isCorrection ? "text-amber-700" : "text-slate-900")}>
        {formatHours(row.daily_delta)}
      </span>
      {isCorrection ? (
        <Badge
          variant="outline"
          className="rounded-full border-amber-200 bg-amber-50 px-2 py-0 text-[10px] font-semibold text-amber-700"
        >
          Correction
        </Badge>
      ) : null}
    </div>
  )
}

export function AircraftTechLogTab({
  aircraftId,
  aircraft,
}: {
  aircraftId: string
  aircraft: AircraftWithType
}) {
  const { timeZone } = useTimezone()
  const [page, setPage] = React.useState(1)

  const query = useAircraftTechLog({
    aircraftId,
    page,
    pageSize: PAGE_SIZE,
  })

  const payload = query.data
  const rows = payload?.rows ?? []
  const totalPages = payload?.totalPages ?? 0
  const readingSource = isTachoFamily(aircraft.total_time_method) ? "tacho" : "hobbs"
  const readingLabel = readingSource === "tacho" ? "Tacho Reading" : "Hobbs Reading"

  React.useEffect(() => {
    setPage(1)
  }, [aircraftId])

  return (
    <Card className="overflow-hidden border border-slate-200/80 bg-white shadow-sm">
      <CardContent className="p-0">
        <div className="border-b border-slate-200/80 bg-white px-4 py-5 sm:px-6">
          <h3 className="text-base font-semibold tracking-tight text-slate-900">Tech Log</h3>
        </div>

        {query.isLoading ? (
          <div className="space-y-3 p-6">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-12 w-full rounded-xl" />
            ))}
          </div>
        ) : query.error ? (
          <div className="p-6">
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {query.error instanceof Error ? query.error.message : "Failed to load tech log"}
            </div>
          </div>
        ) : rows.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <p className="text-sm font-medium text-slate-900">No tech log entries yet.</p>
            <p className="mt-1 text-sm text-slate-500">
              Completed TTIS audit rows will roll up into daily entries here.
            </p>
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow className="border-b border-slate-200 bg-slate-50/70 hover:bg-slate-50/70">
                  <TableHead className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 sm:px-6">
                    Date
                  </TableHead>
                  <TableHead className="py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    {readingLabel}
                  </TableHead>
                  <TableHead className="py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Daily Delta
                  </TableHead>
                  <TableHead className="py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Total Time
                  </TableHead>
                  <TableHead className="hidden px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 lg:table-cell sm:px-6">
                    Updated
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.tech_log_date} className="border-b border-slate-100">
                    <TableCell className="px-4 py-4 sm:px-6">
                      <div className="font-semibold text-slate-900">
                        {formatTechLogDate(row.tech_log_date)}
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      <span className="font-medium text-slate-700">
                        {formatReading(row.latest_reading)}
                      </span>
                    </TableCell>
                    <TableCell className="py-4">
                      <DailyDeltaCell row={row} />
                    </TableCell>
                    <TableCell className="py-4">
                      <span className="font-semibold text-slate-900">
                        {formatHours(row.computed_ttis)}
                      </span>
                    </TableCell>
                    <TableCell className="hidden px-4 py-4 text-right lg:table-cell sm:px-6">
                      <span className="text-sm text-slate-500">
                        {row.latest_entry_at
                          ? formatDateTime(row.latest_entry_at, payload?.timeZone ?? timeZone, "short")
                          : "—"}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="flex flex-col gap-3 border-t border-slate-200/80 bg-slate-50/40 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <p className="text-sm font-medium text-slate-700">
                Page {page} of {Math.max(totalPages, 1)}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-full bg-white"
                  disabled={page <= 1 || query.isFetching}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                >
                  <IconChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-full bg-white"
                  disabled={totalPages === 0 || page >= totalPages || query.isFetching}
                  onClick={() => setPage((current) => current + 1)}
                >
                  Next
                  <IconChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
