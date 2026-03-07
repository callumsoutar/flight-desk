"use client"

import * as React from "react"
import { toast } from "sonner"
import { BookOpen, ChevronDown, ChevronUp, MessageSquare, Plane, Plus, Target, User } from "lucide-react"

import { useAuth } from "@/contexts/auth-context"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DatePicker } from "@/components/ui/date-picker"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { formatDate } from "@/lib/utils/date-format"
import { zonedTodayYyyyMmDd } from "@/lib/utils/timezone"
import { useTimezone } from "@/contexts/timezone-context"
import type { AircraftTypesRow } from "@/lib/types"
import type { InstructorWithRelations } from "@/lib/types/instructors"
import type { MemberTrainingEnrollment, MemberTrainingSyllabusLite } from "@/lib/types/member-training"

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

type EnrollmentCardProps = {
  userId: string
  enrollment: MemberTrainingEnrollment
  instructors: InstructorWithRelations[]
  aircraftTypes: AircraftTypesRow[]
  readOnly: boolean
  onUpdated: () => Promise<void>
}

function EnrollmentCard({ userId, enrollment, instructors, aircraftTypes, readOnly, onUpdated }: EnrollmentCardProps) {
  const { timeZone } = useTimezone()
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
      const res = await fetch(`/api/members/${userId}/training/enrollments/${enrollment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          primary_instructor_id: primaryInstructorId === SELECT_NONE ? null : primaryInstructorId,
          aircraft_type: aircraftTypeId === SELECT_NONE ? null : aircraftTypeId,
          enrolled_at: enrolledAt || null,
          notes: notes || null,
        }),
      })
      if (!res.ok) throw new Error("Failed to update enrollment")
      toast.success("Enrollment updated")
      await onUpdated()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update enrollment")
    } finally {
      setIsUpdating(false)
    }
  }

  const label = enrollmentStatusLabel(enrollment)

  return (
    <div className="rounded-xl border border-border/60 bg-card p-4 sm:p-5 shadow-sm">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted/40 text-muted-foreground mt-0.5">
              <BookOpen className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="text-sm font-semibold text-foreground truncate">
                  {enrollment.syllabus?.name || "Syllabus"}
                </h4>
                <Badge
                  variant="outline"
                  className={cn(
                    "h-5 rounded-md px-2 text-[10px] font-bold uppercase tracking-wide shadow-none",
                    enrollmentStatusClasses(label)
                  )}
                >
                  {label}
                </Badge>
              </div>
              <div className="mt-1 text-xs text-muted-foreground tabular-nums">
                Enrolled {formatDate(enrollment.enrolled_at, timeZone) || "-"}
                {enrollment.completion_date ? (
                  <span className="ml-2">
                    · Completed {formatDate(enrollment.completion_date, timeZone) || "-"}
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowNotes(!showNotes)}
              className="h-9 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40 flex items-center gap-1.5 px-2 rounded-lg"
            >
              <MessageSquare className="w-3.5 h-3.5 opacity-70" />
              <span>{showNotes ? "Hide notes" : notes ? "Edit notes" : "Add notes"}</span>
              {showNotes ? <ChevronUp className="w-3 h-3 opacity-50" /> : <ChevronDown className="w-3 h-3 opacity-50" />}
            </Button>

            {!readOnly && isDirty ? (
              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  onClick={() => {
                    setPrimaryInstructorId(enrollment.primary_instructor_id || SELECT_NONE)
                    setAircraftTypeId(enrollment.aircraft_type || SELECT_NONE)
                    setEnrolledAt(toDateKey(enrollment.enrolled_at) || "")
                    setNotes(enrollment.notes || "")
                  }}
                  variant="ghost"
                  className="h-9 text-xs text-muted-foreground hover:text-foreground px-2"
                  disabled={isUpdating}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={() => void handleSave()}
                  disabled={isUpdating}
                  className="h-9 rounded-lg bg-slate-900 text-white hover:bg-slate-800 px-3 text-xs font-bold shadow-sm"
                >
                  {isUpdating ? "Saving..." : "Save"}
                </Button>
              </div>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Primary Instructor
            </label>
            <Select value={primaryInstructorId} onValueChange={setPrimaryInstructorId} disabled={readOnly}>
              <SelectTrigger className="w-full h-10 rounded-lg border-border bg-background px-3 text-sm">
                <SelectValue placeholder="Assign instructor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SELECT_NONE} className="text-sm italic text-muted-foreground">
                  Unassigned
                </SelectItem>
                {instructors.map((inst) => (
                  <SelectItem key={inst.id} value={inst.id} className="text-sm">
                    {inst.user?.first_name ?? inst.first_name ?? ""} {inst.user?.last_name ?? inst.last_name ?? ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Aircraft Type
            </label>
            <Select value={aircraftTypeId} onValueChange={setAircraftTypeId} disabled={readOnly}>
              <SelectTrigger className="w-full h-10 rounded-lg border-border bg-background px-3 text-sm">
                <SelectValue placeholder="Select aircraft type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SELECT_NONE} className="text-sm italic text-muted-foreground">
                  Not specified
                </SelectItem>
                {aircraftTypes.map((at) => (
                  <SelectItem key={at.id} value={at.id} className="text-sm">
                    {at.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Enrollment Date
            </label>
            <DatePicker
              date={enrolledAt}
              onChange={(date) => setEnrolledAt(date || "")}
              placeholder="Select enrollment date"
              className="h-10 w-full"
              disabled={readOnly}
            />
          </div>
        </div>

        {showNotes ? (
          <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Notes
            </label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add training context, syllabus goals, or student requirements..."
              className="min-h-[90px] bg-background border-border text-sm resize-none rounded-lg"
              disabled={readOnly}
            />
          </div>
        ) : null}
      </div>
    </div>
  )
}

export function TrainingStudentProgrammeTab({
  userId,
  syllabi,
  enrollments,
  timeZone,
  onRefresh,
}: {
  userId: string
  syllabi: MemberTrainingSyllabusLite[]
  enrollments: MemberTrainingEnrollment[]
  timeZone: string
  onRefresh: () => Promise<void>
}) {
  const { role } = useAuth()
  const { timeZone: contextTimeZone } = useTimezone()
  const resolvedTimeZone = timeZone || contextTimeZone
  const staff = isStaff(role)

  const [instructors, setInstructors] = React.useState<InstructorWithRelations[]>([])
  const [aircraftTypes, setAircraftTypes] = React.useState<AircraftTypesRow[]>([])

  const [enrollOpen, setEnrollOpen] = React.useState(false)
  const [enrollSyllabusId, setEnrollSyllabusId] = React.useState("")
  const [enrollPrimaryInstructorId, setEnrollPrimaryInstructorId] = React.useState<string>(SELECT_NONE)
  const [enrollAircraftTypeId, setEnrollAircraftTypeId] = React.useState<string>(SELECT_NONE)
  const [enrollDate, setEnrollDate] = React.useState("")
  const [enrollNotes, setEnrollNotes] = React.useState("")
  const [enrollSubmitting, setEnrollSubmitting] = React.useState(false)

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

  const todayKey = React.useMemo(() => zonedTodayYyyyMmDd(resolvedTimeZone), [resolvedTimeZone])

  React.useEffect(() => {
    if (!enrollOpen) return
    setEnrollSyllabusId("")
    setEnrollPrimaryInstructorId(SELECT_NONE)
    setEnrollAircraftTypeId(SELECT_NONE)
    setEnrollDate(todayKey)
    setEnrollNotes("")
    setEnrollSubmitting(false)
  }, [enrollOpen, todayKey])

  const activeEnrollments = enrollments.filter(
    (e) => (e.status || "").toLowerCase() === "active" && !e.completion_date
  )
  const historicalEnrollments = enrollments.filter(
    (e) => !((e.status || "").toLowerCase() === "active" && !e.completion_date)
  )

  const activeSyllabusIds = new Set(activeEnrollments.map((e) => e.syllabus_id))
  const availableSyllabi = syllabi.filter((s) => !activeSyllabusIds.has(s.id))

  const handleCreateEnrollment = async () => {
    if (!enrollSyllabusId) {
      toast.error("Please select a syllabus")
      return
    }

    setEnrollSubmitting(true)
    try {
      const res = await fetch(`/api/members/${userId}/training/enrollments`, {
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
      await onRefresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to enroll member")
    } finally {
      setEnrollSubmitting(false)
    }
  }

  return (
    <div className="px-4 py-5 sm:p-6 space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-slate-900">Syllabus</h3>
          <p className="text-xs text-muted-foreground">
            Manage syllabus enrollments, primary instructor and aircraft type.
          </p>
        </div>
        {staff ? (
          <Button
            size="sm"
            onClick={() => setEnrollOpen(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg h-9 text-xs font-bold shadow-sm w-full sm:w-auto"
            disabled={availableSyllabi.length === 0}
            title={availableSyllabi.length === 0 ? "No additional active syllabi available" : "Enroll in a syllabus"}
          >
            <Plus className="w-4 h-4 mr-2" />
            Enroll
          </Button>
        ) : null}
      </div>

      <div className="rounded-xl border border-border/60 bg-card shadow-sm overflow-hidden">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-5 py-4 border-b border-border/60 bg-muted/20">
          <div className="text-sm font-semibold">Active Enrollments</div>
          <Badge
            variant="outline"
            className="rounded-full bg-background/50 text-muted-foreground font-semibold px-3 py-1 text-[10px] uppercase tracking-wider"
          >
            {activeEnrollments.length} {activeEnrollments.length === 1 ? "enrollment" : "enrollments"}
          </Badge>
        </div>
        <div className="p-5 space-y-4">
          {activeEnrollments.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-muted/10 p-10 text-center">
              <Target className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm font-semibold text-foreground">No active enrollments</p>
              <p className="text-xs text-muted-foreground mt-1">
                Enroll the member to start tracking training against a syllabus.
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {activeEnrollments.map((e) => (
                <EnrollmentCard
                  key={e.id}
                  userId={userId}
                  enrollment={e}
                  instructors={instructors}
                  aircraftTypes={aircraftTypes}
                  readOnly={!staff}
                  onUpdated={onRefresh}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-border/60 bg-card shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/60 bg-muted/20">
          <div className="text-sm font-semibold">Syllabus History</div>
          <Badge
            variant="outline"
            className="rounded-full bg-background/50 text-muted-foreground font-semibold px-3 py-1 text-[10px] uppercase tracking-wider"
          >
            {historicalEnrollments.length} {historicalEnrollments.length === 1 ? "record" : "records"}
          </Badge>
        </div>

        {historicalEnrollments.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No historical enrollments.
          </div>
        ) : (
          <>
            <div className="p-5 space-y-3 sm:hidden">
              {historicalEnrollments.map((e) => {
                const label = enrollmentStatusLabel(e)
                const inst = e.primary_instructor_id
                  ? instructors.find((i) => i.id === e.primary_instructor_id) ?? null
                  : null
                const at = e.aircraft_type ? aircraftTypes.find((a) => a.id === e.aircraft_type) ?? null : null
                const instName = inst
                  ? `${inst.user?.first_name ?? inst.first_name ?? ""} ${inst.user?.last_name ?? inst.last_name ?? ""}`.trim()
                  : "—"

                return (
                  <div key={e.id} className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-medium text-foreground truncate">{e.syllabus?.name || "Syllabus"}</div>
                        <div className="mt-2">
                          <Badge
                            variant="outline"
                            className={cn(
                              "h-5 rounded-md px-2 text-[10px] font-bold uppercase tracking-wide shadow-none",
                              enrollmentStatusClasses(label)
                            )}
                          >
                            {label}
                          </Badge>
                        </div>
                      </div>
                      <div className="text-right text-xs text-muted-foreground tabular-nums">
                        {formatDate(e.enrolled_at, resolvedTimeZone) || "-"}
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Completed</div>
                        <div className="mt-0.5 font-medium tabular-nums">{formatDate(e.completion_date, resolvedTimeZone) || "-"}</div>
                      </div>
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Instructor</div>
                        <div className="mt-0.5 font-medium truncate">{instName || "—"}</div>
                      </div>
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Aircraft</div>
                        <div className="mt-0.5 font-medium truncate">{at?.name ?? "—"}</div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="hidden sm:block overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/10">
                  <TableRow className="hover:bg-muted/10">
                    <TableHead className="px-5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Syllabus
                    </TableHead>
                    <TableHead className="px-5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Status
                    </TableHead>
                    <TableHead className="px-5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Enrolled
                    </TableHead>
                    <TableHead className="px-5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Completed
                    </TableHead>
                    <TableHead className="px-5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Instructor
                    </TableHead>
                    <TableHead className="px-5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Aircraft
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historicalEnrollments.map((e) => {
                    const label = enrollmentStatusLabel(e)
                    const inst = e.primary_instructor_id
                      ? instructors.find((i) => i.id === e.primary_instructor_id) ?? null
                      : null
                    const at = e.aircraft_type ? aircraftTypes.find((a) => a.id === e.aircraft_type) ?? null : null
                    const instName = inst
                      ? `${inst.user?.first_name ?? inst.first_name ?? ""} ${inst.user?.last_name ?? inst.last_name ?? ""}`.trim()
                      : "—"

                    return (
                      <TableRow key={e.id} className="hover:bg-muted/20">
                        <TableCell className="px-5 py-3">
                          <div className="font-medium text-foreground">{e.syllabus?.name || "Syllabus"}</div>
                        </TableCell>
                        <TableCell className="px-5 py-3">
                          <Badge
                            variant="outline"
                            className={cn(
                              "h-5 rounded-md px-2 text-[10px] font-bold uppercase tracking-wide shadow-none",
                              enrollmentStatusClasses(label)
                            )}
                          >
                            {label}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-5 py-3 text-sm text-muted-foreground tabular-nums">
                          {formatDate(e.enrolled_at, resolvedTimeZone) || "-"}
                        </TableCell>
                        <TableCell className="px-5 py-3 text-sm text-muted-foreground tabular-nums">
                          {formatDate(e.completion_date, resolvedTimeZone) || "-"}
                        </TableCell>
                        <TableCell className="px-5 py-3 text-sm text-muted-foreground">
                          {instName || "—"}
                        </TableCell>
                        <TableCell className="px-5 py-3 text-sm text-muted-foreground">
                          {at?.name ?? "—"}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </div>

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
                          {availableSyllabi.map((s) => (
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

                    <div className="space-y-1.5">
                      <label className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                        <Target className="w-2.5 h-2.5" />
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

                    <div className="space-y-1.5">
                      <label className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                        <MessageSquare className="w-2.5 h-2.5" />
                        NOTES (OPTIONAL)
                      </label>
                      <Textarea
                        value={enrollNotes}
                        onChange={(e) => setEnrollNotes(e.target.value)}
                        placeholder="Add training context, syllabus goals, or requirements..."
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
    </div>
  )
}
