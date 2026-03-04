"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import {
  Activity,
  BookOpen,
  CheckCircle2,
  GraduationCap,
  Loader2,
  MessageSquare,
  Plus,
  Target,
} from "lucide-react"
import { toast } from "sonner"

import { useAuth } from "@/contexts/auth-context"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DatePicker } from "@/components/ui/date-picker"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  Tabs as SnapshotTabs,
  TabsContent as SnapshotTabsContent,
  TabsList as SnapshotTabsList,
  TabsTrigger as SnapshotTabsTrigger,
} from "@/components/ui/tabs"
import { TrainingStudentDebriefsTab } from "@/components/training/training-student-debriefs-tab"
import { TrainingStudentFlyingTab } from "@/components/training/training-student-flying-tab"
import { TrainingStudentOverviewTab } from "@/components/training/training-student-overview-tab"
import { TrainingStudentProgrammeTab } from "@/components/training/training-student-programme-tab"
import { TrainingStudentTheoryTab } from "@/components/training/training-student-theory-tab"
import { cn } from "@/lib/utils"
import { zonedTodayYyyyMmDd } from "@/lib/utils/timezone"
import type {
  MemberTrainingEnrollment,
  MemberTrainingExamResult,
  MemberTrainingFlightExperience,
  MemberTrainingResponse,
} from "@/lib/types/member-training"
import type { TrainingOverviewRow } from "@/lib/types/training-overview"

type MemberTrainingTabProps = {
  memberId: string
}

function isStaff(role: string | null) {
  return role === "owner" || role === "admin" || role === "instructor"
}

function parseDateKey(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null
  if (month < 1 || month > 12) return null
  if (day < 1 || day > 31) return null
  return { year, month, day }
}

function formatDateKey(value: string | null | undefined) {
  if (!value) return "-"
  const parsed = parseDateKey(value)
  if (parsed) {
    const safe = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day, 12, 0, 0))
    return safe.toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" })
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return date.toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" })
}

function cleanSyllabusId(value: string | null) {
  const v = (value ?? "").trim()
  if (!v || v === "all") return null
  return v
}

function daysSince(value: string | null | undefined) {
  if (!value) return 0
  const normalized = value.includes(" ") && !value.includes("T") ? value.replace(" ", "T") : value
  const dt = new Date(normalized)
  if (Number.isNaN(dt.getTime())) return 0
  const diffMs = Date.now() - dt.getTime()
  if (!Number.isFinite(diffMs) || diffMs <= 0) return 0
  return Math.floor(diffMs / (1000 * 60 * 60 * 24))
}

async function fetchMemberTraining(memberId: string): Promise<MemberTrainingResponse> {
  const res = await fetch(`/api/members/${memberId}/training`, { cache: "no-store" })
  const payload = (await res.json().catch(() => null)) as { error?: string } | null
  if (!res.ok) throw new Error(payload?.error || "Failed to load training data")
  return payload as unknown as MemberTrainingResponse
}

async function fetchExams(syllabusId?: string) {
  const url = syllabusId ? `/api/exams?syllabus_id=${syllabusId}` : "/api/exams"
  const res = await fetch(url, { cache: "no-store" })
  if (!res.ok) return []
  const data = (await res.json().catch(() => ({}))) as { exams?: Array<{ id: string; name: string }> }
  return data.exams ?? []
}

function enrollmentStatusLabel(enrollment: MemberTrainingEnrollment) {
  const status = (enrollment.status || "").toLowerCase()
  if (status === "active") return "Active"
  if (status === "completed" || enrollment.completion_date) return "Completed"
  if (status === "withdrawn") return "Withdrawn"
  return enrollment.status || "Unknown"
}

function resultBadgeClasses(result: "PASS" | "FAIL") {
  return result === "PASS"
    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
    : "bg-rose-50 text-rose-700 border-rose-200"
}

function progressBar(percent: number) {
  return (
    <div className="w-full">
      <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden border border-slate-200/50">
        <div
          className="h-1.5 rounded-full bg-indigo-500 transition-all duration-500"
          style={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
        />
      </div>
    </div>
  )
}

function FlightExperiencePanel({ experience }: { experience: MemberTrainingFlightExperience[] }) {
  if (experience.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 p-12 text-center bg-slate-50/30">
        <Activity className="w-12 h-12 text-slate-300 mx-auto mb-4" />
        <p className="text-sm font-semibold text-slate-700">No flight experience yet</p>
        <p className="text-xs text-slate-500 mt-2 max-w-[320px] mx-auto">
          Any structured experience entries will appear here once recorded.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="hidden md:block overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/50">
              <th className="px-6 py-3 text-left font-bold text-[11px] uppercase tracking-wider text-slate-500">
                Date
              </th>
              <th className="px-6 py-3 text-left font-bold text-[11px] uppercase tracking-wider text-slate-500">
                Type
              </th>
              <th className="px-6 py-3 text-left font-bold text-[11px] uppercase tracking-wider text-slate-500 w-[140px]">
                Value
              </th>
              <th className="px-6 py-3 text-left font-bold text-[11px] uppercase tracking-wider text-slate-500 w-[180px]">
                Instructor
              </th>
              <th className="px-6 py-3 text-left font-bold text-[11px] uppercase tracking-wider text-slate-500 w-[140px]">
                Aircraft
              </th>
              <th className="px-6 py-3 text-left font-bold text-[11px] uppercase tracking-wider text-slate-500">
                Notes
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {experience.map((row) => {
              const instFirst = row.instructor?.user?.first_name ?? ""
              const instLast = row.instructor?.user?.last_name ?? ""
              const instName = `${instFirst} ${instLast}`.trim() || "-"
              return (
                <tr key={row.id} className="transition-colors hover:bg-slate-50/50">
                  <td className="px-6 py-4 align-middle whitespace-nowrap text-slate-700 font-medium">
                    {formatDateKey(row.occurred_at)}
                  </td>
                  <td className="px-6 py-4 align-middle font-bold text-slate-900">
                    {row.experience_type?.name ?? "Experience"}
                  </td>
                  <td className="px-6 py-4 align-middle text-slate-700 font-medium">
                    {row.value} {row.unit}
                  </td>
                  <td className="px-6 py-4 align-middle text-slate-700">{instName}</td>
                  <td className="px-6 py-4 align-middle text-slate-700">
                    {row.booking?.aircraft?.registration ?? "-"}
                  </td>
                  <td className="px-6 py-4 align-middle text-slate-600">
                    <div className="line-clamp-2">{row.notes || row.conditions || "—"}</div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="md:hidden space-y-3">
        {experience.map((row) => {
          const instFirst = row.instructor?.user?.first_name ?? ""
          const instLast = row.instructor?.user?.last_name ?? ""
          const instName = `${instFirst} ${instLast}`.trim() || "-"
          return (
            <div key={row.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <div className="text-xs font-bold text-slate-900">
                    {row.experience_type?.name ?? "Experience"}
                  </div>
                  <div className="text-[11px] text-slate-500 font-medium mt-0.5">{formatDateKey(row.occurred_at)}</div>
                </div>
                <div className="text-xs font-bold text-slate-900">
                  {row.value} {row.unit}
                </div>
              </div>
              <div className="text-[11px] text-slate-500 font-medium">Instructor</div>
              <div className="text-xs font-semibold text-slate-900 mb-2">{instName}</div>
              <div className="text-[11px] text-slate-500 font-medium">Aircraft</div>
              <div className="text-xs font-semibold text-slate-900 mb-2">
                {row.booking?.aircraft?.registration ?? "-"}
              </div>
              {row.notes || row.conditions ? (
                <>
                  <div className="text-[11px] text-slate-500 font-medium">Notes</div>
                  <div className="text-xs text-slate-700">{row.notes || row.conditions}</div>
                </>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function MemberTrainingTab({ memberId }: MemberTrainingTabProps) {
  const { role } = useAuth()
  const staff = isStaff(role)

  const [training, setTraining] = React.useState<MemberTrainingResponse["training"] | null>(null)
  const [trainingLoading, setTrainingLoading] = React.useState(true)
  const [trainingError, setTrainingError] = React.useState<string | null>(null)
  const [logExamOpen, setLogExamOpen] = React.useState(false)

  const [selectedSyllabusId, setSelectedSyllabusId] = React.useState<string>("all")
  const [exams, setExams] = React.useState<Array<{ id: string; name: string }>>([])
  const [logExamId, setLogExamId] = React.useState("")
  const [logExamResult, setLogExamResult] = React.useState<"PASS" | "FAIL">("PASS")
  const [logExamScore, setLogExamScore] = React.useState<number | null>(null)
  const [logExamDate, setLogExamDate] = React.useState("")
  const [logExamNotes, setLogExamNotes] = React.useState("")
  const [logSubmitting, setLogSubmitting] = React.useState(false)

  const searchParams = useSearchParams()
  const requestedSyllabusId = React.useMemo(() => cleanSyllabusId(searchParams.get("syllabus_id")), [searchParams])
  const [snapshotSyllabusId, setSnapshotSyllabusId] = React.useState<string>("")
  const [snapshotTab, setSnapshotTab] = React.useState("overview")

  const loadTraining = React.useCallback(async () => {
    if (!memberId) {
      setTraining(null)
      setTrainingLoading(false)
      setTrainingError(null)
      return
    }

    setTrainingLoading(true)
    setTrainingError(null)
    try {
      const data = await fetchMemberTraining(memberId)
      setTraining(data.training)
    } catch (err) {
      setTraining(null)
      setTrainingError(err instanceof Error ? err.message : "Failed to load training data")
    } finally {
      setTrainingLoading(false)
    }
  }, [memberId])

  React.useEffect(() => {
    void loadTraining()
  }, [loadTraining])

  const timeZone = training?.timeZone ?? "Pacific/Auckland"
  const todayKey = React.useMemo(() => zonedTodayYyyyMmDd(timeZone), [timeZone])

  React.useEffect(() => {
    if (!logExamOpen) return
    setSelectedSyllabusId("all")
    setLogExamId("")
    setLogExamResult("PASS")
    setLogExamScore(null)
    setLogExamDate(todayKey)
    setLogExamNotes("")
    setLogSubmitting(false)
    setExams([])
  }, [logExamOpen, todayKey])

  React.useEffect(() => {
    if (!logExamOpen) return
    let cancelled = false
    async function load() {
      const list = await fetchExams(selectedSyllabusId === "all" ? undefined : selectedSyllabusId)
      if (!cancelled) setExams(list)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [logExamOpen, selectedSyllabusId])

  const syllabi = React.useMemo(() => training?.syllabi ?? [], [training])
  const enrollments = React.useMemo(() => training?.enrollments ?? [], [training])
  const examResults = React.useMemo(() => training?.examResults ?? [], [training])
  const experience = React.useMemo(() => training?.flightExperience ?? [], [training])

  const activeEnrollments = enrollments.filter(
    (e) => (e.status || "").toLowerCase() === "active" && !e.completion_date
  )

  React.useEffect(() => {
    if (trainingLoading) return

    if (!enrollments.length) {
      setSnapshotSyllabusId("")
      return
    }

    setSnapshotSyllabusId((prev) => {
      if (prev && enrollments.some((e) => e.syllabus_id === prev)) return prev
      if (requestedSyllabusId && enrollments.some((e) => e.syllabus_id === requestedSyllabusId)) return requestedSyllabusId
      if (activeEnrollments[0]?.syllabus_id) return activeEnrollments[0].syllabus_id
      return enrollments[0]?.syllabus_id ?? ""
    })
  }, [activeEnrollments, enrollments, requestedSyllabusId, trainingLoading])

  React.useEffect(() => {
    if (!snapshotSyllabusId) return
    setSnapshotTab("overview")
  }, [snapshotSyllabusId])

  const snapshotSyllabusOptions = React.useMemo(() => {
    const byId = new Map<
      string,
      { id: string; name: string; isActive: boolean; lastEnrolledAt: string | null }
    >()

    for (const enrollment of enrollments) {
      const id = enrollment.syllabus_id
      const name =
        enrollment.syllabus?.name ||
        syllabi.find((s) => s.id === id)?.name ||
        "Syllabus"

      const isActive = (enrollment.status || "").toLowerCase() === "active" && !enrollment.completion_date
      const existing = byId.get(id)
      const lastEnrolledAt = enrollment.enrolled_at ?? null

      if (!existing) {
        byId.set(id, { id, name, isActive, lastEnrolledAt })
        continue
      }

      byId.set(id, {
        id,
        name: existing.name || name,
        isActive: existing.isActive || isActive,
        lastEnrolledAt:
          existing.lastEnrolledAt && lastEnrolledAt
            ? existing.lastEnrolledAt > lastEnrolledAt
              ? existing.lastEnrolledAt
              : lastEnrolledAt
            : existing.lastEnrolledAt ?? lastEnrolledAt,
      })
    }

    return [...byId.values()].sort((a, b) => {
      if (a.isActive !== b.isActive) return a.isActive ? -1 : 1
      return (b.lastEnrolledAt ?? "").localeCompare(a.lastEnrolledAt ?? "")
    })
  }, [enrollments, syllabi])

  const snapshotRow = React.useMemo<TrainingOverviewRow | null>(() => {
    if (!snapshotSyllabusId) return null

    const enrollment = [...enrollments]
      .filter((e) => e.syllabus_id === snapshotSyllabusId)
      .sort((a, b) => (b.enrolled_at ?? "").localeCompare(a.enrolled_at ?? ""))[0]

    const syllabusName =
      enrollment?.syllabus?.name ||
      syllabi.find((s) => s.id === snapshotSyllabusId)?.name ||
      "Syllabus"

    const enrolledAt = enrollment?.enrolled_at ?? new Date().toISOString()
    const enrollmentStatus = enrollment ? enrollmentStatusLabel(enrollment) : "Active"

    return {
      enrollment_id: enrollment?.id ?? `enrollment:${memberId}:${snapshotSyllabusId}`,
      enrolled_at: enrolledAt,
      completion_date: enrollment?.completion_date ?? null,
      enrollment_status: enrollmentStatus,
      user_id: memberId,
      syllabus_id: snapshotSyllabusId,
      primary_instructor_id: enrollment?.primary_instructor_id ?? null,
      student: {
        id: memberId,
        first_name: null,
        last_name: null,
        email: null,
      },
      syllabus: {
        id: snapshotSyllabusId,
        name: syllabusName,
      },
      primaryInstructor: null,
      last_flight_at: null,
      days_since_last_flight: null,
      days_since_enrolled: daysSince(enrolledAt),
      progress: { completed: 0, total: 0, percent: null },
      activity_status: "active",
    }
  }, [enrollments, memberId, snapshotSyllabusId, syllabi])

  const syllabusProgress = React.useMemo(() => {
    return syllabi.map((s) => {
      const totalExams = s.number_of_exams || 0
      const uniquePassedIds = new Set(
        examResults
          .filter((r) => r.result === "PASS" && r.exam?.syllabus_id === s.id)
          .map((r) => r.exam_id)
      )
      const percent = totalExams > 0 ? Math.round((uniquePassedIds.size / totalExams) * 100) : 0
      return {
        ...s,
        completed: uniquePassedIds.size,
        total: totalExams,
        percent,
      }
    })
  }, [syllabi, examResults])

  const groupedExamResults = React.useMemo(() => {
    const groups: Record<
      string,
      { name: string; results: MemberTrainingExamResult[]; progress?: { completed: number; total: number; percent: number } }
    > = {}

    examResults.forEach((r) => {
      const syllabusId = r.exam?.syllabus_id || "no-syllabus"
      const syllabusName = r.exam?.syllabus?.name || "No Syllabus"
      if (!groups[syllabusId]) {
        groups[syllabusId] = { name: syllabusName, results: [] }
        if (syllabusId !== "no-syllabus") {
          const prog = syllabusProgress.find((p) => p.id === syllabusId)
          if (prog) groups[syllabusId].progress = { completed: prog.completed, total: prog.total, percent: prog.percent }
        }
      }
      groups[syllabusId].results.push(r)
    })

    return groups
  }, [examResults, syllabusProgress])

  const passedExamIds = React.useMemo(() => new Set(examResults.filter((r) => r.result === "PASS").map((r) => r.exam_id)), [examResults])

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
      const res = await fetch(`/api/members/${memberId}/training/exam-results`, {
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
      setLogExamOpen(false)
      await loadTraining()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to log exam result")
    } finally {
      setLogSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-sm border border-border/60 bg-white overflow-hidden rounded-lg">
        <CardHeader className="pb-4 border-b border-slate-100">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <CardTitle className="text-lg">Training Snapshot</CardTitle>
              <p className="text-xs text-muted-foreground">
                Read-only view for quick handover. Use the sections below to manage enrollments, exams and experience.
              </p>
            </div>
            <div className="w-full sm:w-80">
              <Select value={snapshotSyllabusId || ""} onValueChange={setSnapshotSyllabusId} disabled={trainingLoading || snapshotSyllabusOptions.length === 0}>
                <SelectTrigger className="w-full h-9 rounded-xl border-slate-200/70 bg-white shadow-sm hover:border-slate-300 transition-colors text-[13px] font-medium px-3">
                  <SelectValue placeholder={snapshotSyllabusOptions.length ? "Select syllabus" : "No enrollments"} />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-slate-200 shadow-lg">
                  {snapshotSyllabusOptions.map((s) => (
                    <SelectItem key={s.id} value={s.id} className="text-[13px] py-2">
                      {s.name}
                      {s.isActive ? (
                        <span className="ml-2 text-[10px] font-semibold text-emerald-600">Active</span>
                      ) : (
                        <span className="ml-2 text-[10px] font-semibold text-slate-400">Past</span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {snapshotRow ? (
            <SnapshotTabs value={snapshotTab} onValueChange={setSnapshotTab} className="gap-0">
              <div className="border-b px-4 py-3">
                <SnapshotTabsList variant="line" className="w-full justify-start">
                  <SnapshotTabsTrigger value="overview">Overview</SnapshotTabsTrigger>
                  <SnapshotTabsTrigger value="flying">Flying</SnapshotTabsTrigger>
                  <SnapshotTabsTrigger value="debriefs">Debriefs</SnapshotTabsTrigger>
                  <SnapshotTabsTrigger value="programme">Programme</SnapshotTabsTrigger>
                  <SnapshotTabsTrigger value="experience">Experience</SnapshotTabsTrigger>
                  <SnapshotTabsTrigger value="theory">Theory</SnapshotTabsTrigger>
                </SnapshotTabsList>
              </div>

              <SnapshotTabsContent value="overview">
                <TrainingStudentOverviewTab row={snapshotRow} />
              </SnapshotTabsContent>

              <SnapshotTabsContent value="flying">
                <TrainingStudentFlyingTab userId={memberId} syllabusId={snapshotRow.syllabus_id} />
              </SnapshotTabsContent>

              <SnapshotTabsContent value="debriefs">
                <TrainingStudentDebriefsTab userId={memberId} syllabusId={snapshotRow.syllabus_id} />
              </SnapshotTabsContent>

              <SnapshotTabsContent value="programme">
                <TrainingStudentProgrammeTab
                  userId={memberId}
                  syllabi={syllabi}
                  enrollments={enrollments}
                  timeZone={timeZone}
                  onRefresh={loadTraining}
                />
              </SnapshotTabsContent>

              <SnapshotTabsContent value="experience">
                <div className="p-6 space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">Flight Experience</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Experience entries logged for this member (not syllabus-specific).
                    </p>
                  </div>
                  <FlightExperiencePanel experience={experience} />
                </div>
              </SnapshotTabsContent>

              <SnapshotTabsContent value="theory">
                <TrainingStudentTheoryTab userId={memberId} syllabusId={snapshotRow.syllabus_id} />
              </SnapshotTabsContent>
            </SnapshotTabs>
          ) : (
            <div className="p-8 text-center text-sm text-muted-foreground">
              {trainingLoading ? "Loading training snapshot..." : "No syllabus enrollments found for this member."}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-4 pt-2">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-bold text-slate-900 tracking-tight">Exam History</h3>
          {staff ? (
            <Button
              size="sm"
              onClick={() => setLogExamOpen(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg h-9 font-bold text-xs shadow-sm"
            >
              <Plus className="w-4 h-4 mr-2" />
              Log Result
            </Button>
          ) : null}
        </div>

        {trainingLoading ? (
          <div className="flex items-center justify-center py-16 text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Loading exams...
          </div>
        ) : trainingError ? (
          <div className="rounded-lg border border-slate-200 bg-white p-8 text-center">
            <p className="text-sm text-destructive mb-4">{trainingError}</p>
            <Button onClick={() => void loadTraining()} variant="outline" size="sm">
              Retry
            </Button>
          </div>
        ) : examResults.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 p-12 text-center bg-slate-50/30">
            <GraduationCap className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-sm font-semibold text-slate-700">No exam results yet</p>
            <p className="text-xs text-slate-500 mt-2 max-w-[280px] mx-auto">
              Exam attempts and outcomes will appear here once recorded.
            </p>
          </div>
        ) : (
          <div className="space-y-10">
            {Object.entries(groupedExamResults)
              .sort((a, b) => {
                if (a[0] === "no-syllabus") return 1
                if (b[0] === "no-syllabus") return -1
                return a[1].name.localeCompare(b[1].name)
              })
              .map(([syllabusId, group]) => (
                <div key={syllabusId} className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 px-1">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <div className={cn("w-1.5 h-1.5 rounded-full", syllabusId === "no-syllabus" ? "bg-slate-400" : "bg-indigo-500")} />
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">{group.name}</h4>
                        <Badge
                          variant="outline"
                          className="text-[9px] font-bold px-1.5 py-0 rounded-md bg-slate-50 text-slate-400 border-slate-200"
                        >
                          {group.results.length} {group.results.length === 1 ? "result" : "results"}
                        </Badge>
                      </div>
                      {group.progress ? (
                        <p className="text-[11px] font-medium text-slate-400 pl-3.5">
                          {group.progress.completed} of {group.progress.total} exams passed
                        </p>
                      ) : null}
                    </div>

                    {group.progress ? (
                      <div className="flex items-center gap-4 w-full sm:w-[240px]">
                        <div className="flex-1">{progressBar(group.progress.percent)}</div>
                        <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full min-w-[38px] text-center">
                          {group.progress.percent}%
                        </span>
                      </div>
                    ) : null}
                  </div>

                  <div className="hidden md:block overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50/50">
                          <th className="px-6 py-3 text-left font-bold text-[11px] uppercase tracking-wider text-slate-500">
                            Exam
                          </th>
                          <th className="px-6 py-3 text-left font-bold text-[11px] uppercase tracking-wider text-slate-500 w-[180px]">
                            Date
                          </th>
                          <th className="px-6 py-3 text-left font-bold text-[11px] uppercase tracking-wider text-slate-500 w-[140px]">
                            Result
                          </th>
                          <th className="px-6 py-3 text-left font-bold text-[11px] uppercase tracking-wider text-slate-500 w-[140px]">
                            Score
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {group.results.map((r) => (
                          <tr key={r.id} className="group transition-colors hover:bg-slate-50/50">
                            <td className="px-6 py-4 align-middle">
                              <span className="font-bold text-slate-900">{r.exam?.name || "Exam"}</span>
                            </td>
                            <td className="px-6 py-4 align-middle">
                              <span className="text-slate-700 font-medium">{formatDateKey(r.exam_date)}</span>
                            </td>
                            <td className="px-6 py-4 align-middle">
                              <Badge className={cn("rounded-md px-2 py-0.5 text-[10px] font-bold uppercase border shadow-none", resultBadgeClasses(r.result))}>
                                {r.result}
                              </Badge>
                            </td>
                            <td className="px-6 py-4 align-middle">
                              <div className="flex flex-col gap-0.5">
                                <span className="font-bold text-slate-900">{r.score}%</span>
                                <span className="text-[10px] text-slate-400 font-medium">/ 100%</span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="md:hidden space-y-3">
                    {group.results.map((r) => (
                      <div key={r.id} className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                        <div className={cn("absolute left-0 top-0 bottom-0 w-1", r.result === "PASS" ? "bg-emerald-500" : "bg-rose-500")} />
                        <div className="flex justify-between items-start mb-3">
                          <h5 className="font-bold text-slate-900 text-sm">{r.exam?.name || "Exam"}</h5>
                          <Badge className={cn("rounded-md px-2 py-0.5 text-[10px] font-bold uppercase border shadow-none", resultBadgeClasses(r.result))}>
                            {r.result}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Date</div>
                            <div className="font-bold text-xs text-slate-900">{formatDateKey(r.exam_date)}</div>
                          </div>
                          <div className="space-y-1">
                            <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Score</div>
                            <div className="font-bold text-xs text-slate-900">
                              {r.score}% <span className="text-slate-400 font-medium ml-1">/ 100%</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

      <Dialog open={logExamOpen} onOpenChange={setLogExamOpen}>
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
                  <GraduationCap className="h-5 w-5" />
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-5">
                      <div className="space-y-1.5">
                        <label className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                          <BookOpen className="w-2.5 h-2.5" />
                          SYLLABUS (FILTER)
                        </label>
                        <Select value={selectedSyllabusId} onValueChange={setSelectedSyllabusId} disabled={logSubmitting}>
                          <SelectTrigger className="h-10 w-full rounded-xl border-slate-200 bg-white px-3 text-base font-medium shadow-none hover:bg-slate-50 focus:ring-1 focus:ring-indigo-100 transition-all">
                            <SelectValue placeholder="All exams" />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl border-slate-200 shadow-xl">
                            <SelectItem value="all" className="text-base font-medium rounded-lg mx-1 focus:bg-indigo-50 focus:text-indigo-600">
                              All Exams
                            </SelectItem>
                            {syllabi.map((s) => (
                              <SelectItem key={s.id} value={s.id} className="text-base font-medium rounded-lg mx-1 focus:bg-indigo-50 focus:text-indigo-600">
                                {s.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                          <GraduationCap className="w-2.5 h-2.5" />
                          EXAM <span className="text-destructive font-bold ml-0.5">*</span>
                        </label>
                        <Select value={logExamId} onValueChange={setLogExamId} disabled={logSubmitting}>
                          <SelectTrigger className="h-10 w-full rounded-xl border-slate-200 bg-white px-3 text-base font-medium shadow-none hover:bg-slate-50 focus:ring-1 focus:ring-indigo-100 transition-all">
                            <SelectValue placeholder={availableExams.length ? "Select exam" : "No exams available"} />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl border-slate-200 shadow-xl">
                            {availableExams.map((e) => (
                              <SelectItem key={e.id} value={e.id} className="text-base font-medium rounded-lg mx-1 focus:bg-indigo-50 focus:text-indigo-600">
                                {e.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-5">
                      <div className="space-y-1.5">
                        <label className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                          <CheckCircle2 className="w-2.5 h-2.5" />
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
                          <Target className="w-2.5 h-2.5" />
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
                          <CheckCircle2 className="w-2.5 h-2.5" />
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
                        <MessageSquare className="w-2.5 h-2.5" />
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
                  onClick={() => setLogExamOpen(false)}
                  disabled={logSubmitting}
                  className="h-10 flex-1 rounded-xl border-slate-200 text-sm font-bold shadow-none hover:bg-slate-50"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  disabled={logSubmitting}
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
