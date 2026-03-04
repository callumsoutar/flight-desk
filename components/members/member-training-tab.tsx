"use client"

import * as React from "react"
import Link from "next/link"
import * as Tabs from "@radix-ui/react-tabs"
import {
  Activity,
  AlertCircle,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileText,
  GraduationCap,
  Loader2,
  MessageSquare,
  Plane,
  Plus,
  Target,
  User,
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
import { cn } from "@/lib/utils"
import { zonedTodayYyyyMmDd } from "@/lib/utils/timezone"
import type { AircraftTypesRow } from "@/lib/types"
import type { InstructorWithRelations } from "@/lib/types/instructors"
import type {
  MemberTrainingComment,
  MemberTrainingCommentsResponse,
  MemberTrainingEnrollment,
  MemberTrainingExamResult,
  MemberTrainingFlightExperience,
  MemberTrainingResponse,
  MemberTrainingSyllabusLite,
} from "@/lib/types/member-training"

type MemberTrainingTabProps = {
  memberId: string
}

const PAGE_SIZE = 5
const SELECT_NONE = "__none__" as const

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

function toDateKey(value: string | null | undefined) {
  if (!value) return null
  const parsed = parseDateKey(value)
  if (parsed) {
    const yyyy = String(parsed.year).padStart(4, "0")
    const mm = String(parsed.month).padStart(2, "0")
    const dd = String(parsed.day).padStart(2, "0")
    return `${yyyy}-${mm}-${dd}`
  }

  const normalized = value.includes(" ") && !value.includes("T") ? value.replace(" ", "T") : value
  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString().slice(0, 10)
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

function sanitizeHTML(html: string | null): string {
  if (!html) return "-"
  let sanitized = html
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
  sanitized = sanitized.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "")
  sanitized = sanitized.replace(
    /<(object|embed)\b[^<]*(?:(?!<\/(object|embed)>)<[^<]*)*<\/(object|embed)>/gi,
    ""
  )
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, "")
  return sanitized
}

function instructorName(comment: MemberTrainingComment): string {
  const first = comment.instructor?.user?.first_name ?? ""
  const last = comment.instructor?.user?.last_name ?? ""
  const full = `${first} ${last}`.trim()
  return full || "-"
}

async function fetchComments(
  memberId: string,
  offset: number,
  limit: number
): Promise<MemberTrainingCommentsResponse> {
  const response = await fetch(
    `/api/members/${memberId}/training/comments?offset=${offset}&limit=${limit}`,
    { method: "GET", cache: "no-store" }
  )

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(payload?.error || "Failed to load training comments")
  }

  return payload as MemberTrainingCommentsResponse
}

function TrainingCommentsPanel({ memberId }: { memberId: string }) {
  const [comments, setComments] = React.useState<MemberTrainingComment[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [isFetchingMore, setIsFetchingMore] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [nextOffset, setNextOffset] = React.useState<number | null>(0)

  const loadMoreRef = React.useRef<HTMLDivElement | null>(null)

  const loadPage = React.useCallback(
    async (offset: number, replace: boolean) => {
      if (!memberId) return

      if (replace) {
        setIsLoading(true)
      } else {
        setIsFetchingMore(true)
      }

      try {
        const result = await fetchComments(memberId, offset, PAGE_SIZE)

        setComments((prev) => {
          if (replace) return result.comments
          const existingIds = new Set(prev.map((item) => item.id))
          const merged = [...prev]
          for (const item of result.comments) {
            if (!existingIds.has(item.id)) merged.push(item)
          }
          return merged
        })

        setNextOffset(result.next_offset)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load training comments")
      } finally {
        if (replace) {
          setIsLoading(false)
        } else {
          setIsFetchingMore(false)
        }
      }
    },
    [memberId]
  )

  React.useEffect(() => {
    setComments([])
    setNextOffset(0)
    setError(null)
    if (!memberId) {
      setIsLoading(false)
      return
    }
    void loadPage(0, true)
  }, [memberId, loadPage])

  React.useEffect(() => {
    const node = loadMoreRef.current
    if (!node) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return
        if (isLoading || isFetchingMore) return
        if (nextOffset == null) return
        void loadPage(nextOffset, false)
      },
      { threshold: 0.1 }
    )

    observer.observe(node)
    return () => {
      observer.disconnect()
    }
  }, [isLoading, isFetchingMore, nextOffset, loadPage])

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/30 py-20">
        <Loader2 className="mb-4 h-6 w-6 animate-spin text-slate-400" />
        <p className="text-sm text-slate-500">Loading instructor comments...</p>
      </div>
    )
  }

  if (error && comments.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-8 text-center">
        <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100">
          <AlertCircle className="h-5 w-5 text-slate-400" />
        </div>
        <h4 className="mb-1 text-sm font-semibold text-slate-900">Unable to load comments</h4>
        <p className="mx-auto mb-6 max-w-[300px] text-xs text-slate-500">{error}</p>
        <button
          onClick={() => {
            setComments([])
            setNextOffset(0)
            setError(null)
            void loadPage(0, true)
          }}
          className="rounded-md border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
        >
          Try Again
        </button>
      </div>
    )
  }

  if (comments.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/30 p-16 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
          <MessageSquare className="h-6 w-6 text-slate-300" />
        </div>
        <h3 className="text-sm font-semibold text-slate-900">No instructor comments found</h3>
        <p className="mx-auto mt-2 max-w-[280px] text-xs leading-relaxed text-slate-500">
          Instructor comments recorded during flight lessons will appear here automatically.
        </p>
      </div>
    )
  }

  return (
    <div className="animate-in fade-in space-y-4 duration-500">
      <div className="mb-2 flex items-center justify-between px-1">
        <h3 className="text-sm font-semibold text-slate-900">Instructor Feedback</h3>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
          {comments.length} Records
        </span>
      </div>

      <div className="hidden overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm md:block">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/50">
              <th className="w-[160px] px-6 py-3 text-left text-xs font-semibold text-slate-500">Date</th>
              <th className="w-[140px] px-6 py-3 text-left text-xs font-semibold text-slate-500">Aircraft</th>
              <th className="w-[200px] px-6 py-3 text-left text-xs font-semibold text-slate-500">Instructor</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500">Comments</th>
              <th className="w-[120px] px-6 py-3 text-right text-xs font-semibold text-slate-500">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {comments.map((comment) => (
              <tr key={comment.id} className="transition-colors hover:bg-slate-50/50">
                <td className="px-6 py-4 align-middle whitespace-nowrap text-slate-700">
                  {formatDateKey(comment.date)}
                </td>
                <td className="px-6 py-4 align-middle font-medium text-slate-900">
                  {comment.booking?.aircraft?.registration || "-"}
                </td>
                <td className="px-6 py-4 align-middle text-slate-700">{instructorName(comment)}</td>
                <td className="px-6 py-4 align-middle">
                  <div
                    className="line-clamp-2 leading-normal text-slate-600 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_b]:font-semibold [&_strong]:font-semibold [&_i]:italic [&_em]:italic"
                    dangerouslySetInnerHTML={{ __html: sanitizeHTML(comment.instructor_comments) }}
                  />
                </td>
                <td className="px-6 py-4 text-right align-middle">
                  {comment.booking_id ? (
                    <Button variant="ghost" size="sm" asChild className="h-8 px-2 hover:bg-primary/10">
                      <Link href={`/bookings/${comment.booking_id}`}>View Booking</Link>
                    </Button>
                  ) : (
                    <span className="text-xs text-slate-400">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 md:hidden">
        {comments.map((comment) => (
          <div key={comment.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-2 flex items-start justify-between">
              <span className="text-xs font-semibold text-slate-900">{formatDateKey(comment.date)}</span>
              <span className="text-[10px] font-semibold text-slate-600">
                {comment.booking?.aircraft?.registration || "-"}
              </span>
            </div>

            <div className="mb-2">
              <div className="mb-0.5 text-[10px] text-slate-500">Instructor</div>
              <div className="text-xs font-medium text-slate-900">{instructorName(comment)}</div>
            </div>

            <div>
              <div className="mb-1 text-[10px] text-slate-500">Comments</div>
              <div
                className="line-clamp-3 text-sm leading-normal text-slate-600 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_b]:font-semibold [&_strong]:font-semibold [&_i]:italic [&_em]:italic"
                dangerouslySetInnerHTML={{ __html: sanitizeHTML(comment.instructor_comments) }}
              />
            </div>

            <div className="mt-4 border-t border-slate-100 pt-3">
              {comment.booking_id ? (
                <Button variant="outline" size="sm" className="h-9 w-full text-xs font-semibold" asChild>
                  <Link href={`/bookings/${comment.booking_id}`}>View Booking</Link>
                </Button>
              ) : (
                <Button variant="outline" size="sm" className="h-9 w-full text-xs font-semibold" disabled>
                  No booking linked
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div ref={loadMoreRef} className="flex h-12 w-full items-center justify-center pt-4">
        {isFetchingMore ? (
          <div className="flex items-center gap-2 text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-[10px] font-medium tracking-widest uppercase">Loading more...</span>
          </div>
        ) : nextOffset != null ? (
          <div className="h-1 w-full overflow-hidden rounded-full bg-slate-100">
            <div className="h-full w-full animate-pulse bg-slate-200" />
          </div>
        ) : comments.length > 0 ? (
          <p className="text-[10px] font-medium tracking-widest text-slate-300 uppercase">End of records</p>
        ) : null}
      </div>
    </div>
  )
}

async function fetchMemberTraining(memberId: string): Promise<MemberTrainingResponse> {
  const res = await fetch(`/api/members/${memberId}/training`, { cache: "no-store" })
  const payload = (await res.json().catch(() => null)) as { error?: string } | null
  if (!res.ok) throw new Error(payload?.error || "Failed to load training data")
  return payload as unknown as MemberTrainingResponse
}

async function fetchInstructors(): Promise<InstructorWithRelations[]> {
  const res = await fetch("/api/instructors", { cache: "no-store" })
  if (!res.ok) return []
  const data = (await res.json().catch(() => ({}))) as { instructors?: InstructorWithRelations[] }
  return data.instructors ?? []
}

async function fetchAircraftTypes(): Promise<AircraftTypesRow[]> {
  const res = await fetch("/api/aircraft-types", { cache: "no-store" })
  if (!res.ok) return []
  const data = (await res.json().catch(() => ({}))) as { aircraft_types?: AircraftTypesRow[] }
  return data.aircraft_types ?? []
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

function enrollmentStatusClasses(label: string) {
  const normalized = label.toLowerCase()
  if (normalized === "active") return "bg-emerald-100 text-emerald-700 border-0"
  if (normalized === "completed") return "bg-slate-100 text-slate-700 border-0"
  if (normalized === "withdrawn") return "bg-amber-100 text-amber-700 border-0"
  return "bg-gray-100 text-gray-700 border-0"
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

type EnrollmentCardProps = {
  enrollment: MemberTrainingEnrollment
  instructors: InstructorWithRelations[]
  aircraftTypes: AircraftTypesRow[]
  readOnly: boolean
  onUpdate: (
    enrollmentId: string,
    values: Partial<{
      primary_instructor_id: string | null
      aircraft_type: string | null
      enrolled_at: string | null
      notes: string | null
    }>
  ) => Promise<void>
}

function EnrollmentCard({ enrollment, instructors, aircraftTypes, readOnly, onUpdate }: EnrollmentCardProps) {
  const [primaryInstructorId, setPrimaryInstructorId] = React.useState<string>(enrollment.primary_instructor_id || SELECT_NONE)
  const [aircraftTypeId, setAircraftTypeId] = React.useState<string>(enrollment.aircraft_type || SELECT_NONE)
  const [enrolledAt, setEnrolledAt] = React.useState<string>(toDateKey(enrollment.enrolled_at) || "")
  const [notes, setNotes] = React.useState<string>(enrollment.notes || "")
  const [showNotes, setShowNotes] = React.useState(false)
  const [isUpdating, setIsUpdating] = React.useState(false)

  React.useEffect(() => {
    setPrimaryInstructorId(enrollment.primary_instructor_id || SELECT_NONE)
    setAircraftTypeId(enrollment.aircraft_type || SELECT_NONE)
    setEnrolledAt(toDateKey(enrollment.enrolled_at) || "")
    setNotes(enrollment.notes || "")
  }, [enrollment.primary_instructor_id, enrollment.aircraft_type, enrollment.notes, enrollment.enrolled_at])

  const isDirty =
    (primaryInstructorId === SELECT_NONE ? null : primaryInstructorId) !== enrollment.primary_instructor_id ||
    (aircraftTypeId === SELECT_NONE ? null : aircraftTypeId) !== enrollment.aircraft_type ||
    enrolledAt !== (toDateKey(enrollment.enrolled_at) || "") ||
    notes !== (enrollment.notes || "")

  const handleSave = async () => {
    setIsUpdating(true)
    try {
      await onUpdate(enrollment.id, {
        primary_instructor_id: primaryInstructorId === SELECT_NONE ? null : primaryInstructorId,
        aircraft_type: aircraftTypeId === SELECT_NONE ? null : aircraftTypeId,
        enrolled_at: enrolledAt || null,
        notes: notes || null,
      })
      toast.success("Enrollment updated")
    } catch {
      toast.error("Failed to update enrollment")
    } finally {
      setIsUpdating(false)
    }
  }

  const label = enrollmentStatusLabel(enrollment)

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 sm:p-6 shadow-sm">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-5">
          <div className="flex items-start gap-4">
            <div className="h-10 w-10 shrink-0 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 mt-0.5">
              <BookOpen className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mb-1">
                <h4 className="text-base font-bold text-gray-900 tracking-tight leading-tight">
                  {enrollment.syllabus?.name || "Syllabus"}
                </h4>
                <Badge className={cn("rounded-md px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide", enrollmentStatusClasses(label))}>
                  {label}
                </Badge>
              </div>
              <p className="text-xs text-gray-500 font-medium">
                Enrolled {formatDateKey(enrollment.enrolled_at)}
                {enrollment.completion_date && (
                  <span className="ml-1.5 pl-1.5 border-l border-gray-200">
                    Completed {formatDateKey(enrollment.completion_date)}
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto mt-1 sm:mt-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowNotes(!showNotes)}
              className="h-9 text-xs text-gray-500 hover:text-indigo-600 hover:bg-indigo-50/50 flex items-center gap-1.5 px-2 rounded-lg transition-colors"
            >
              <MessageSquare className="w-3.5 h-3.5 opacity-70" />
              <span>{showNotes ? "Hide Notes" : notes ? "Edit Notes" : "Add Notes"}</span>
              {showNotes ? <ChevronUp className="w-3 h-3 opacity-50" /> : <ChevronDown className="w-3 h-3 opacity-50" />}
            </Button>

            {!readOnly && isDirty && (
              <div className="flex items-center gap-1.5 ml-auto sm:ml-0">
                <Button
                  size="sm"
                  onClick={() => {
                    setPrimaryInstructorId(enrollment.primary_instructor_id || SELECT_NONE)
                    setAircraftTypeId(enrollment.aircraft_type || SELECT_NONE)
                    setEnrolledAt(toDateKey(enrollment.enrolled_at) || "")
                    setNotes(enrollment.notes || "")
                  }}
                  variant="ghost"
                  className="h-9 text-xs text-gray-400 hover:text-gray-700 px-2 font-medium"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={isUpdating}
                  className="bg-[#6564db] hover:bg-[#232ed1] text-white shadow-sm h-9 px-4 rounded-xl text-xs font-bold whitespace-nowrap"
                >
                  {isUpdating ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 pt-4 border-t border-gray-200">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Primary Instructor</label>
            <Select value={primaryInstructorId} onValueChange={setPrimaryInstructorId} disabled={readOnly}>
              <SelectTrigger className="w-full h-10 bg-white text-sm border-gray-200 focus:ring-0">
                <SelectValue placeholder="Assign Instructor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SELECT_NONE} className="text-sm italic text-gray-400">
                  No instructor assigned
                </SelectItem>
                {instructors.map((inst) => (
                  <SelectItem key={inst.id} value={inst.id} className="text-sm">
                    {inst.user?.first_name ?? inst.first_name ?? ""} {inst.user?.last_name ?? inst.last_name ?? ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Primary Aircraft Type</label>
            <Select value={aircraftTypeId} onValueChange={setAircraftTypeId} disabled={readOnly}>
              <SelectTrigger className="w-full h-10 bg-white text-sm border-gray-200 focus:ring-0">
                <SelectValue placeholder="Assign Aircraft Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SELECT_NONE} className="text-sm italic text-gray-400">
                  No aircraft type assigned
                </SelectItem>
                {aircraftTypes.map((at) => (
                  <SelectItem key={at.id} value={at.id} className="text-sm">
                    {at.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Enrollment Date</label>
            <DatePicker
              date={enrolledAt}
              onChange={(date) => setEnrolledAt(date || "")}
              placeholder="Select enrollment date"
              className="w-full h-10 bg-white"
              disabled={readOnly}
            />
          </div>
        </div>

        {showNotes && (
          <div className="space-y-2 pt-2 animate-in fade-in slide-in-from-top-2 duration-200">
            <label className="block text-sm font-medium text-gray-700">Enrollment Notes</label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add training context, syllabus goals, or student requirements..."
              className="min-h-[100px] bg-white text-sm border-gray-200 focus-visible:ring-0 resize-none rounded-md"
              disabled={readOnly}
            />
          </div>
        )}
      </div>
    </div>
  )
}

export function MemberTrainingTab({ memberId }: MemberTrainingTabProps) {
  const { role } = useAuth()
  const staff = isStaff(role)

  const [activeTab, setActiveTab] = React.useState("flight")
  const [underlineStyle, setUnderlineStyle] = React.useState({ left: 0, width: 0 })
  const tabRefs = React.useRef<Record<string, HTMLButtonElement | null>>({})
  const tabsListRef = React.useRef<HTMLDivElement>(null)
  const tabsScrollRef = React.useRef<HTMLDivElement>(null)
  const [showScrollLeft, setShowScrollLeft] = React.useState(false)
  const [showScrollRight, setShowScrollRight] = React.useState(false)

  const [training, setTraining] = React.useState<MemberTrainingResponse["training"] | null>(null)
  const [trainingLoading, setTrainingLoading] = React.useState(true)
  const [trainingError, setTrainingError] = React.useState<string | null>(null)

  const [instructors, setInstructors] = React.useState<InstructorWithRelations[]>([])
  const [aircraftTypes, setAircraftTypes] = React.useState<AircraftTypesRow[]>([])

  const [enrollOpen, setEnrollOpen] = React.useState(false)
  const [logExamOpen, setLogExamOpen] = React.useState(false)

  const [enrollSyllabusId, setEnrollSyllabusId] = React.useState("")
  const [enrollPrimaryInstructorId, setEnrollPrimaryInstructorId] = React.useState<string>(SELECT_NONE)
  const [enrollAircraftTypeId, setEnrollAircraftTypeId] = React.useState<string>(SELECT_NONE)
  const [enrollDate, setEnrollDate] = React.useState("")
  const [enrollNotes, setEnrollNotes] = React.useState("")
  const [enrollSubmitting, setEnrollSubmitting] = React.useState(false)

  const [selectedSyllabusId, setSelectedSyllabusId] = React.useState<string>("all")
  const [exams, setExams] = React.useState<Array<{ id: string; name: string }>>([])
  const [logExamId, setLogExamId] = React.useState("")
  const [logExamResult, setLogExamResult] = React.useState<"PASS" | "FAIL">("PASS")
  const [logExamScore, setLogExamScore] = React.useState<number | null>(null)
  const [logExamDate, setLogExamDate] = React.useState("")
  const [logExamNotes, setLogExamNotes] = React.useState("")
  const [logSubmitting, setLogSubmitting] = React.useState(false)

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

  React.useEffect(() => {
    if (!staff) return
    let cancelled = false
    async function load() {
      const [inst, ats] = await Promise.all([fetchInstructors(), fetchAircraftTypes()])
      if (cancelled) return
      setInstructors(inst)
      setAircraftTypes(ats)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [staff])

  const timeZone = training?.timeZone ?? "Pacific/Auckland"
  const todayKey = React.useMemo(() => zonedTodayYyyyMmDd(timeZone), [timeZone])

  React.useEffect(() => {
    if (!enrollOpen) return
    setEnrollSyllabusId("")
    setEnrollPrimaryInstructorId(SELECT_NONE)
    setEnrollAircraftTypeId(SELECT_NONE)
    setEnrollDate(todayKey)
    setEnrollNotes("")
    setEnrollSubmitting(false)
  }, [enrollOpen, todayKey])

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
  const historicalEnrollments = enrollments.filter(
    (e) => !((e.status || "").toLowerCase() === "active" && !e.completion_date)
  )

  const activeSyllabusIds = new Set(activeEnrollments.map((e) => e.syllabus_id))
  const availableSyllabi = syllabi.filter((s) => !activeSyllabusIds.has(s.id))

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

  const handleUpdateEnrollment = async (
    enrollmentId: string,
    values: Partial<{
      primary_instructor_id: string | null
      aircraft_type: string | null
      enrolled_at: string | null
      notes: string | null
    }>
  ) => {
    const res = await fetch(`/api/members/${memberId}/training/enrollments/${enrollmentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    })
    if (!res.ok) throw new Error("Failed to update enrollment")
    await loadTraining()
  }

  const handleCreateEnrollment = async () => {
    if (!enrollSyllabusId) {
      toast.error("Please select a syllabus")
      return
    }

    setEnrollSubmitting(true)
    try {
      const res = await fetch(`/api/members/${memberId}/training/enrollments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          syllabus_id: enrollSyllabusId,
          enrolled_at: enrollDate || undefined,
          notes: enrollNotes ? enrollNotes : null,
          primary_instructor_id: enrollPrimaryInstructorId === SELECT_NONE ? null : enrollPrimaryInstructorId,
          aircraft_type: enrollAircraftTypeId === SELECT_NONE ? null : enrollAircraftTypeId,
        }),
      })
      const payload = (await res.json().catch(() => null)) as { error?: string } | null
      if (!res.ok) throw new Error(payload?.error || "Failed to enroll member")
      toast.success("Syllabus enrollment created")
      setEnrollOpen(false)
      await loadTraining()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to enroll member")
    } finally {
      setEnrollSubmitting(false)
    }
  }

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

  React.useEffect(() => {
    const activeTabElement = tabRefs.current[activeTab]
    const list = tabsListRef.current
    const scroller = tabsScrollRef.current
    if (!activeTabElement || !list || !scroller) return

    setUnderlineStyle({
      left: activeTabElement.offsetLeft,
      width: activeTabElement.getBoundingClientRect().width,
    })

    if (window.innerWidth < 768) {
      const tabLeft = activeTabElement.offsetLeft
      const tabWidth = activeTabElement.getBoundingClientRect().width
      const containerWidth = scroller.getBoundingClientRect().width
      const targetScroll = tabLeft - containerWidth / 2 + tabWidth / 2
      scroller.scrollTo({ left: Math.max(0, targetScroll), behavior: "smooth" })
    }
  }, [activeTab])

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      const activeTabElement = tabRefs.current[activeTab]
      if (!activeTabElement) return
      setUnderlineStyle({
        left: activeTabElement.offsetLeft,
        width: activeTabElement.getBoundingClientRect().width,
      })
    }, 100)
    return () => window.clearTimeout(timer)
  }, [activeTab])

  React.useEffect(() => {
    const scroller = tabsScrollRef.current
    if (!scroller) return

    const checkScroll = () => {
      const { scrollLeft, scrollWidth, clientWidth } = scroller
      setShowScrollLeft(scrollLeft > 0)
      setShowScrollRight(scrollLeft < scrollWidth - clientWidth - 1)
    }

    checkScroll()
    scroller.addEventListener("scroll", checkScroll)
    window.addEventListener("resize", checkScroll)
    return () => {
      scroller.removeEventListener("scroll", checkScroll)
      window.removeEventListener("resize", checkScroll)
    }
  }, [])

  return (
    <div className="space-y-6">
      <Tabs.Root value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="border-b border-gray-200">
          <div className="relative">
            {showScrollLeft ? (
              <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-white to-transparent z-10 pointer-events-none" />
            ) : null}
            {showScrollRight ? (
              <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none" />
            ) : null}

            <div ref={tabsScrollRef} className="flex items-center w-full overflow-x-auto scrollbar-hide scroll-smooth">
              <Tabs.List
                ref={tabsListRef}
                className="flex flex-row gap-4 min-h-[48px] relative min-w-max"
                aria-label="Training sub-tabs"
              >
                <div
                  className="absolute bottom-0 h-0.5 bg-indigo-700 transition-all duration-300 ease-out"
                  style={{ left: `${underlineStyle.left}px`, width: `${underlineStyle.width}px` }}
                />

                {[
                  { id: "flight", label: "Flight Training", icon: Plane },
                  { id: "flight-experience", label: "Flight Experience", icon: Activity },
                  { id: "syllabus", label: "Syllabus", icon: BookOpen },
                  { id: "exams", label: "Exams", icon: FileText },
                ].map((tab) => {
                  const Icon = tab.icon
                  return (
                    <Tabs.Trigger
                      key={tab.id}
                      ref={(el) => {
                        tabRefs.current[tab.id] = el
                      }}
                      value={tab.id}
                      className="inline-flex items-center gap-2 px-4 py-3 pb-1 text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 cursor-pointer data-[state=active]:text-indigo-800 data-[state=inactive]:text-gray-500 hover:text-indigo-600 whitespace-nowrap flex-shrink-0 min-h-[48px] min-w-[44px] touch-manipulation active:bg-gray-50 border-none bg-transparent"
                      aria-label={`${tab.label} tab`}
                    >
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      <span>{tab.label}</span>
                    </Tabs.Trigger>
                  )
                })}
              </Tabs.List>
            </div>
          </div>
        </div>

        <div className="pt-6">
          <Tabs.Content value="flight" className="space-y-6 outline-none">
            <TrainingCommentsPanel memberId={memberId} />
          </Tabs.Content>

          <Tabs.Content value="flight-experience" className="space-y-6 outline-none">
            {trainingLoading ? (
              <div className="flex items-center justify-center py-16 text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Loading experience...
              </div>
            ) : trainingError ? (
              <div className="rounded-lg border border-slate-200 bg-white p-8 text-center">
                <p className="text-sm text-destructive mb-4">{trainingError}</p>
                <Button onClick={() => void loadTraining()} variant="outline" size="sm">
                  Retry
                </Button>
              </div>
            ) : (
              <FlightExperiencePanel experience={experience} />
            )}
          </Tabs.Content>

          <Tabs.Content value="syllabus" className="space-y-6 outline-none">
            <Card className="shadow-sm border border-border/50 bg-card overflow-hidden rounded-lg">
              <CardHeader className="pb-4 border-b border-slate-100">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <div className="p-2 rounded-full bg-indigo-50">
                      <Target className="w-5 h-5 text-indigo-600" />
                    </div>
                    Syllabus Enrollments
                  </CardTitle>
                  {staff ? (
                    <Button
                      size="sm"
                      onClick={() => setEnrollOpen(true)}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-md h-9"
                      disabled={availableSyllabi.length === 0}
                      title={availableSyllabi.length === 0 ? "No additional active syllabi available" : "Enroll in a syllabus"}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Enroll
                    </Button>
                  ) : null}
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="p-4 sm:p-6 border-b border-slate-100">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 tracking-tight">Active Enrollments</h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        {staff ? "Manage student syllabus, assigned staff and aircraft" : "Current active syllabus enrollments"}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className="rounded-full bg-slate-50 text-slate-600 font-medium self-start sm:self-auto px-3 py-1 text-[10px] uppercase tracking-wider"
                    >
                      {activeEnrollments.length} {activeEnrollments.length === 1 ? "enrolled" : "enrollments"}
                    </Badge>
                  </div>

                  {trainingLoading ? (
                    <div className="flex items-center justify-center py-16 text-slate-500">
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Loading enrollments...
                    </div>
                  ) : trainingError ? (
                    <div className="rounded-lg border border-slate-200 bg-white p-8 text-center">
                      <p className="text-sm text-destructive mb-4">{trainingError}</p>
                      <Button onClick={() => void loadTraining()} variant="outline" size="sm">
                        Retry
                      </Button>
                    </div>
                  ) : activeEnrollments.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-200 p-12 text-center bg-slate-50/30">
                      <Target className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                      <p className="text-sm font-semibold text-slate-700">No active enrollments</p>
                      <p className="text-xs text-slate-500 mt-2 max-w-[280px] mx-auto">
                        Enroll the member to start tracking training against a syllabus.
                      </p>
                    </div>
                  ) : (
                    <div className="grid gap-6">
                      {activeEnrollments.map((e) => (
                        <EnrollmentCard
                          key={e.id}
                          enrollment={e}
                          instructors={instructors}
                          aircraftTypes={aircraftTypes}
                          readOnly={!staff}
                          onUpdate={handleUpdateEnrollment}
                        />
                      ))}
                    </div>
                  )}
                </div>

                <div className="p-4 sm:p-6 bg-white/50">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900">Historical Enrollments</h3>
                      <p className="text-xs text-muted-foreground mt-1">Completed or withdrawn training records</p>
                    </div>
                    <Badge
                      variant="outline"
                      className="rounded-full bg-slate-50 text-slate-600 font-medium self-start sm:self-auto px-3 py-1 text-[10px] uppercase tracking-wider"
                    >
                      {historicalEnrollments.length} {historicalEnrollments.length === 1 ? "record" : "records"}
                    </Badge>
                  </div>

                  {trainingLoading ? (
                    <div className="flex items-center justify-center py-10 text-slate-500">
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Loading history...
                    </div>
                  ) : trainingError ? (
                    <div className="rounded-lg border border-slate-200 bg-white p-8 text-center">
                      <p className="text-sm text-destructive mb-4">{trainingError}</p>
                      <Button onClick={() => void loadTraining()} variant="outline" size="sm">
                        Retry
                      </Button>
                    </div>
                  ) : historicalEnrollments.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center bg-white">
                      <p className="text-sm font-medium text-slate-700">No historical enrollments</p>
                      <p className="text-xs text-slate-500 mt-1">
                        Completed or withdrawn enrollments will remain visible here.
                      </p>
                    </div>
                  ) : (
                    <div className="grid gap-3">
                      {historicalEnrollments.map((e) => {
                        const label = enrollmentStatusLabel(e)
                        const inst = instructors.find((i) => i.id === e.primary_instructor_id)
                        const at = aircraftTypes.find((a) => a.id === e.aircraft_type)
                        return (
                          <div
                            key={e.id}
                            className="rounded-lg border border-slate-200 bg-white/80 p-4 opacity-90 transition-all hover:opacity-100 hover:border-slate-300"
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                              <div className="flex items-start gap-3">
                                <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mt-0.5">
                                  <CheckCircle2 className="w-4 h-4" />
                                </div>
                                <div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-semibold text-slate-900 text-sm">
                                      {e.syllabus?.name || "Syllabus"}
                                    </span>
                                    <Badge className={cn("rounded-md px-2 py-0.5 text-[9px] font-bold uppercase", enrollmentStatusClasses(label))}>
                                      {label}
                                    </Badge>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[10px] text-slate-500 mt-1.5 font-medium">
                                    <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">
                                      {formatDateKey(e.enrolled_at)} — {formatDateKey(e.completion_date)}
                                    </span>
                                    {inst ? (
                                      <span className="flex items-center gap-1 bg-indigo-50/50 px-1.5 py-0.5 rounded text-indigo-600">
                                        <User className="w-2.5 h-2.5" />{" "}
                                        {inst.user?.first_name ?? inst.first_name ?? ""}{" "}
                                        {inst.user?.last_name ?? inst.last_name ?? ""}
                                      </span>
                                    ) : null}
                                    {at ? (
                                      <span className="flex items-center gap-1 bg-blue-50/50 px-1.5 py-0.5 rounded text-blue-600">
                                        <Plane className="w-2.5 h-2.5" /> {at.name}
                                      </span>
                                    ) : null}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </Tabs.Content>

          <Tabs.Content value="exams" className="space-y-6 outline-none">
            <div className="flex flex-col gap-4">
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
          </Tabs.Content>
        </div>
      </Tabs.Root>

      <Dialog open={enrollOpen} onOpenChange={setEnrollOpen}>
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
                  <Plus className="h-5 w-5" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-bold tracking-tight text-slate-900">Enroll in Syllabus</DialogTitle>
                  <DialogDescription className="mt-0.5 text-sm text-slate-500">
                    Create a new syllabus enrollment for this member.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-6 pb-6">
              <div className="space-y-6">
                <section>
                  <div className="mb-4 flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                    <span className="text-xs font-semibold tracking-tight text-slate-900">Enrollment Details</span>
                  </div>

                  <div className="space-y-5">
                    <div className="space-y-1.5">
                      <label className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                        <BookOpen className="w-2.5 h-2.5" />
                        SYLLABUS <span className="text-destructive font-bold ml-0.5">*</span>
                      </label>
                      <Select value={enrollSyllabusId} onValueChange={setEnrollSyllabusId} disabled={enrollSubmitting}>
                        <SelectTrigger className="h-10 w-full rounded-xl border-slate-200 bg-white px-3 text-xs font-medium shadow-none hover:bg-slate-50 focus:ring-1 focus:ring-indigo-100 transition-all">
                          <SelectValue
                            placeholder={availableSyllabi.length ? "Select syllabus to enroll in" : "No syllabi available"}
                          />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-slate-200 shadow-xl">
                          {availableSyllabi.map((s: MemberTrainingSyllabusLite) => (
                            <SelectItem key={s.id} value={s.id} className="text-xs font-medium rounded-lg mx-1 focus:bg-indigo-50 focus:text-indigo-600">
                              {s.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-5">
                      <div className="space-y-1.5">
                        <label className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                          <User className="w-2.5 h-2.5" />
                          PRIMARY INSTRUCTOR
                        </label>
                        <Select
                          value={enrollPrimaryInstructorId}
                          onValueChange={setEnrollPrimaryInstructorId}
                          disabled={enrollSubmitting}
                        >
                          <SelectTrigger className="h-10 w-full rounded-xl border-slate-200 bg-white px-3 text-xs font-medium shadow-none hover:bg-slate-50 focus:ring-1 focus:ring-indigo-100 transition-all">
                            <SelectValue placeholder="Optional" />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl border-slate-200 shadow-xl">
                            <SelectItem value={SELECT_NONE} className="text-xs italic text-slate-400">
                              Not assigned
                            </SelectItem>
                            {instructors.map((inst) => (
                              <SelectItem key={inst.id} value={inst.id} className="text-xs font-medium rounded-lg mx-1 focus:bg-indigo-50 focus:text-indigo-600">
                                {inst.user?.first_name ?? inst.first_name ?? ""} {inst.user?.last_name ?? inst.last_name ?? ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                          <Plane className="w-2.5 h-2.5" />
                          PRIMARY AIRCRAFT TYPE
                        </label>
                        <Select value={enrollAircraftTypeId} onValueChange={setEnrollAircraftTypeId} disabled={enrollSubmitting}>
                          <SelectTrigger className="h-10 w-full rounded-xl border-slate-200 bg-white px-3 text-xs font-medium shadow-none hover:bg-slate-50 focus:ring-1 focus:ring-indigo-100 transition-all">
                            <SelectValue placeholder="Optional" />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl border-slate-200 shadow-xl">
                            <SelectItem value={SELECT_NONE} className="text-xs italic text-slate-400">
                              Not assigned
                            </SelectItem>
                            {aircraftTypes.map((at) => (
                              <SelectItem key={at.id} value={at.id} className="text-xs font-medium rounded-lg mx-1 focus:bg-indigo-50 focus:text-indigo-600">
                                {at.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          ENROLLMENT DATE
                        </label>
                        <DatePicker
                          date={enrollDate}
                          onChange={(date) => setEnrollDate(date || "")}
                          disabled={enrollSubmitting}
                          placeholder="Select enrollment date"
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
                        value={enrollNotes}
                        onChange={(e) => setEnrollNotes(e.target.value)}
                        placeholder="Add any relevant training context or student requirements..."
                        className="min-h-[100px] rounded-xl border-slate-200 bg-white px-3 py-2.5 text-xs font-medium shadow-none hover:bg-slate-50 focus-visible:ring-1 focus-visible:ring-indigo-100 transition-all resize-none"
                        disabled={enrollSubmitting}
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
                  onClick={() => setEnrollOpen(false)}
                  disabled={enrollSubmitting}
                  className="h-10 flex-1 rounded-xl border-slate-200 text-xs font-bold shadow-none hover:bg-slate-50"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  disabled={enrollSubmitting || !availableSyllabi.length}
                  onClick={() => void handleCreateEnrollment()}
                  className="h-10 flex-[1.4] rounded-xl bg-slate-900 text-xs font-bold text-white shadow-lg shadow-slate-900/10 hover:bg-slate-800"
                >
                  {enrollSubmitting ? "Enrolling..." : "Enroll Member"}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
