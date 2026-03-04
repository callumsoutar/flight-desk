"use client"

import * as React from "react"
import { IconBook, IconSchool } from "@tabler/icons-react"

import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"
import type { TrainingTheoryResponse, TrainingTheoryRow, TrainingTheoryStatus } from "@/lib/types/training-theory"

function safeFormatDateISO(value: string | null | undefined) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  const yyyy = String(date.getFullYear()).padStart(4, "0")
  const mm = String(date.getMonth() + 1).padStart(2, "0")
  const dd = String(date.getDate()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
}

function statusBadge(status: TrainingTheoryStatus) {
  if (status === "passed") {
    return {
      label: "Passed",
      className: "border-emerald-200/60 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-500/10 dark:text-emerald-300",
    }
  }
  if (status === "not_passed") {
    return {
      label: "Not passed",
      className: "border-amber-200/60 bg-amber-50 text-amber-800 dark:border-amber-900/40 dark:bg-amber-500/10 dark:text-amber-300",
    }
  }
  return {
    label: "Not attempted",
    className: "border-slate-200/60 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-500/10 dark:text-slate-300",
  }
}

function formatScore(row: TrainingTheoryRow) {
  if (typeof row.score === "number") return `${Math.round(row.score)}%`
  if (typeof row.best_score === "number") return `${Math.round(row.best_score)}%`
  return "—"
}

export function TrainingStudentTheoryTab({
  userId,
  syllabusId,
}: {
  userId: string
  syllabusId: string
}) {
  const [rows, setRows] = React.useState<TrainingTheoryRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const url = new URL(`/api/members/${userId}/training/theory`, window.location.origin)
        url.searchParams.set("syllabus_id", syllabusId)

        const response = await fetch(url.toString(), {
          method: "GET",
          cache: "no-store",
          headers: { "cache-control": "no-store" },
        })

        if (!response.ok) throw new Error("Failed to load theory results")
        const json = (await response.json()) as TrainingTheoryResponse
        if (cancelled) return
        setRows(Array.isArray(json.rows) ? json.rows : [])
      } catch (err) {
        if (cancelled) return
        setRows([])
        setError(err instanceof Error ? err.message : "Failed to load theory results")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [syllabusId, userId])

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading theory exams…</div>
  }

  if (error) {
    return <div className="p-6 text-sm text-destructive">{error}</div>
  }

  if (rows.length === 0) {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-dashed border-border bg-muted/10 p-10 text-center">
          <IconSchool className="mx-auto h-10 w-10 text-muted-foreground/40" />
          <div className="mt-4 text-sm font-semibold">No exams configured</div>
          <div className="mt-1 text-xs text-muted-foreground">
            Add syllabus exams in Settings → Training → Exams.
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-3">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold">Theory Examinations</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Most recent passing attempt shown when available.
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow className="hover:bg-muted/30">
              <TableHead className="px-4 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Subject
              </TableHead>
              <TableHead className="px-4 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Status
              </TableHead>
              <TableHead className="px-4 text-[11px] font-bold uppercase tracking-wider text-muted-foreground text-right">
                Score
              </TableHead>
              <TableHead className="px-4 text-[11px] font-bold uppercase tracking-wider text-muted-foreground text-right">
                Attempts
              </TableHead>
              <TableHead className="px-4 text-[11px] font-bold uppercase tracking-wider text-muted-foreground text-right">
                Date
              </TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {rows.map((row) => {
              const badge = statusBadge(row.status)
              return (
                <TableRow key={row.exam_id} className="hover:bg-muted/30">
                  <TableCell className="px-4 py-3 whitespace-normal">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted/50 text-muted-foreground shrink-0">
                        <IconBook className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium leading-tight truncate">{row.exam_name}</div>
                      </div>
                    </div>
                  </TableCell>

                  <TableCell className="px-4 py-3">
                    <Badge
                      variant="outline"
                      className={cn("text-[10px] font-bold px-2 py-1 rounded-lg uppercase tracking-wide", badge.className)}
                    >
                      {badge.label}
                    </Badge>
                  </TableCell>

                  <TableCell className="px-4 py-3 text-right tabular-nums text-foreground">
                    {formatScore(row)}
                  </TableCell>

                  <TableCell className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                    {row.attempts || "—"}
                  </TableCell>

                  <TableCell className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                    {safeFormatDateISO(row.exam_date)}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

