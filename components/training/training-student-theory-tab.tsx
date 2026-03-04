"use client"

import * as React from "react"
import {
  IconBook,
  IconCheck,
  IconMessage,
  IconPlus,
  IconSchool,
  IconTarget,
} from "@tabler/icons-react"
import { toast } from "sonner"

import { useAuth } from "@/contexts/auth-context"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DatePicker } from "@/components/ui/date-picker"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
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

function isStaff(role: string | null) {
  return role === "owner" || role === "admin" || role === "instructor"
}

function todayKeyLocal() {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
}

type ExamLite = { id: string; name: string }

async function fetchExamsForSyllabus(syllabusId: string) {
  const res = await fetch(`/api/exams?syllabus_id=${encodeURIComponent(syllabusId)}`, { cache: "no-store" })
  if (!res.ok) return []
  const data = (await res.json().catch(() => ({}))) as { exams?: ExamLite[] }
  return data.exams ?? []
}

export function TrainingStudentTheoryTab({
  userId,
  syllabusId,
}: {
  userId: string
  syllabusId: string
}) {
  const { role } = useAuth()
  const staff = isStaff(role)

  const [rows, setRows] = React.useState<TrainingTheoryRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const [logOpen, setLogOpen] = React.useState(false)
  const [logSubmitting, setLogSubmitting] = React.useState(false)
  const [exams, setExams] = React.useState<ExamLite[]>([])
  const [logExamId, setLogExamId] = React.useState("")
  const [logExamResult, setLogExamResult] = React.useState<"PASS" | "FAIL">("PASS")
  const [logExamScore, setLogExamScore] = React.useState<number | null>(null)
  const [logExamDate, setLogExamDate] = React.useState("")
  const [logExamNotes, setLogExamNotes] = React.useState("")

  const loadTheory = React.useCallback(async () => {
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
      setRows(Array.isArray(json.rows) ? json.rows : [])
    } catch (err) {
      setRows([])
      setError(err instanceof Error ? err.message : "Failed to load theory results")
    } finally {
      setLoading(false)
    }
  }, [syllabusId, userId])

  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      await loadTheory()
      if (cancelled) return
    })()
    return () => {
      cancelled = true
    }
  }, [loadTheory])

  React.useEffect(() => {
    if (!logOpen) return
    setLogSubmitting(false)
    setLogExamId("")
    setLogExamResult("PASS")
    setLogExamScore(null)
    setLogExamDate(todayKeyLocal())
    setLogExamNotes("")
  }, [logOpen])

  React.useEffect(() => {
    if (!logOpen) return
    let cancelled = false
    void (async () => {
      const list = await fetchExamsForSyllabus(syllabusId)
      if (cancelled) return
      setExams(list)
    })()
    return () => {
      cancelled = true
    }
  }, [logOpen, syllabusId])

  const passedExamIds = React.useMemo(
    () => new Set(rows.filter((r) => r.status === "passed").map((r) => r.exam_id)),
    [rows]
  )

  const availableExams = React.useMemo(() => exams.filter((e) => !passedExamIds.has(e.id)), [exams, passedExamIds])

  const handleLogExam = async () => {
    if (!logExamId) {
      toast.error("Please select an exam")
      return
    }
    if (!logExamDate) {
      toast.error("Please select an exam date")
      return
    }

    setLogSubmitting(true)
    try {
      const res = await fetch(`/api/members/${userId}/training/exam-results`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exam_id: logExamId,
          result: logExamResult,
          score: logExamScore,
          exam_date: logExamDate,
          notes: logExamNotes ? logExamNotes : null,
        }),
      })
      const payload = (await res.json().catch(() => null)) as { error?: string } | null
      if (!res.ok) throw new Error(payload?.error || "Failed to log exam result")
      toast.success("Exam result logged successfully")
      setLogOpen(false)
      await loadTheory()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to log exam result")
    } finally {
      setLogSubmitting(false)
    }
  }

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
        {staff ? (
          <Button
            size="sm"
            onClick={() => setLogOpen(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg h-9 font-bold text-xs shadow-sm"
          >
            <IconPlus className="w-4 h-4 mr-2" />
            Log Result
          </Button>
        ) : null}
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

      <Dialog open={logOpen} onOpenChange={setLogOpen}>
        <DialogContent
          className={cn(
            "p-0 border-none shadow-2xl rounded-[24px] overflow-hidden flex flex-col",
            "w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] sm:w-full sm:max-w-[520px]",
            "top-[calc(env(safe-area-inset-top)+1rem)] sm:top-[50%] translate-y-0 sm:translate-y-[-50%]",
            "h-[calc(100dvh-4rem)] sm:h-auto sm:max-h-[calc(100dvh-4rem)]"
          )}
        >
          <div className="flex flex-1 min-h-0 flex-col bg-white">
            <DialogHeader className="px-6 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-4 text-left sm:pt-6">
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
                  <IconSchool className="h-5 w-5" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-bold tracking-tight text-slate-900">Log Exam Result</DialogTitle>
                  <DialogDescription className="mt-0.5 text-sm text-slate-500">
                    Record a new theory exam result for this member. Required fields are marked with{" "}
                    <span className="text-destructive">*</span>.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-6 pb-6">
              <div className="space-y-6">
                <section>
                  <div className="mb-3 flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                    <span className="text-xs font-semibold tracking-tight text-slate-900">Exam Details</span>
                  </div>

                  <div className="space-y-5">
                    <div className="space-y-1.5">
                      <label className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                        <IconBook className="w-2.5 h-2.5" />
                        EXAM <span className="text-destructive font-bold ml-0.5">*</span>
                      </label>
                      <Select value={logExamId} onValueChange={setLogExamId} disabled={logSubmitting}>
                        <SelectTrigger className="h-10 w-full rounded-xl border-slate-200 bg-white px-3 text-base font-medium shadow-none hover:bg-slate-50 focus:ring-1 focus:ring-indigo-100 transition-all">
                          <SelectValue placeholder={availableExams.length ? "Select exam" : "No exams available"} />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-slate-200 shadow-xl">
                          {availableExams.map((e) => (
                            <SelectItem
                              key={e.id}
                              value={e.id}
                              className="text-base font-medium rounded-lg mx-1 focus:bg-indigo-50 focus:text-indigo-600"
                            >
                              {e.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {!availableExams.length ? (
                        <p className="text-[11px] text-slate-400 font-medium">
                          All syllabus exams have been passed (or no exams exist).
                        </p>
                      ) : null}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-5">
                      <div className="space-y-1.5">
                        <label className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                          <IconCheck className="w-2.5 h-2.5" />
                          RESULT <span className="text-destructive font-bold ml-0.5">*</span>
                        </label>
                        <Select
                          value={logExamResult}
                          onValueChange={(val) => setLogExamResult(val as "PASS" | "FAIL")}
                          disabled={logSubmitting}
                        >
                          <SelectTrigger className="h-10 w-full rounded-xl border-slate-200 bg-white px-3 text-base font-medium shadow-none hover:bg-slate-50 focus:ring-1 focus:ring-indigo-100 transition-all">
                            <SelectValue placeholder="Select result" />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl border-slate-200 shadow-xl">
                            <SelectItem value="PASS" className="text-base font-medium rounded-lg mx-1 focus:bg-emerald-50 focus:text-emerald-600">
                              Pass
                            </SelectItem>
                            <SelectItem value="FAIL" className="text-base font-medium rounded-lg mx-1 focus:bg-rose-50 focus:text-rose-600">
                              Fail
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                          <IconTarget className="w-2.5 h-2.5" />
                          SCORE (%)
                        </label>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          value={logExamScore ?? ""}
                          onChange={(e) => setLogExamScore(e.target.value ? Number(e.target.value) : null)}
                          disabled={logSubmitting}
                          placeholder="e.g. 85"
                          className="h-10 w-full rounded-xl border-slate-200 bg-white px-3 text-base font-medium shadow-none hover:bg-slate-50 focus-visible:ring-1 focus-visible:ring-indigo-100 transition-all"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                          <IconCheck className="w-2.5 h-2.5" />
                          EXAM DATE <span className="text-destructive font-bold ml-0.5">*</span>
                        </label>
                        <DatePicker
                          date={logExamDate}
                          onChange={(date) => setLogExamDate(date || "")}
                          disabled={logSubmitting}
                          placeholder="Select exam date"
                          className="h-10 w-full"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                        <IconMessage className="w-2.5 h-2.5" />
                        NOTES (OPTIONAL)
                      </label>
                      <Textarea
                        value={logExamNotes}
                        onChange={(e) => setLogExamNotes(e.target.value)}
                        placeholder="Add any additional context about this exam attempt..."
                        className="min-h-[100px] rounded-xl border-slate-200 bg-white px-3 py-2.5 text-base font-medium shadow-none hover:bg-slate-50 focus-visible:ring-1 focus-visible:ring-indigo-100 transition-all resize-none"
                        disabled={logSubmitting}
                      />
                    </div>
                  </div>
                </section>
              </div>
            </div>

            <div className="border-t bg-white px-6 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-[0_-4px_12px_rgba(0,0,0,0.05)] sm:pb-4">
              <div className="flex items-center justify-between gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setLogOpen(false)}
                  disabled={logSubmitting}
                  className="h-10 flex-1 rounded-xl border-slate-200 text-sm font-bold shadow-none hover:bg-slate-50"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  disabled={logSubmitting || !logExamId}
                  onClick={() => void handleLogExam()}
                  className="h-10 flex-[1.4] rounded-xl bg-slate-900 text-sm font-bold text-white shadow-lg shadow-slate-900/10 hover:bg-slate-800"
                >
                  {logSubmitting ? "Logging..." : "Log Result"}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
