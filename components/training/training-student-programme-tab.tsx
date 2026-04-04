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
import { fetchInstructorsQuery } from "@/hooks/use-instructors-query"
import {
  createTrainingEnrollment,
  updateTrainingEnrollment,
} from "@/hooks/use-member-training-query"
import { fetchAircraftTypes } from "@/hooks/use-aircraft-types-query"
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

type EnrollmentCardProps = {
  userId: string
  enrollment: MemberTrainingEnrollment
  instructors: InstructorWithRelations[]
  aircraftTypes: AircraftTypesRow[]
  readOnly: boolean
  isLoadingOptions: boolean
  onUpdated: () => Promise<void>
}

function EnrollmentCard({ userId, enrollment, instructors, aircraftTypes, readOnly, isLoadingOptions, onUpdated }: EnrollmentCardProps) {
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
      await updateTrainingEnrollment(userId, enrollment.id, {
        primary_instructor_id: primaryInstructorId === SELECT_NONE ? null : primaryInstructorId,
        aircraft_type: aircraftTypeId === SELECT_NONE ? null : aircraftTypeId,
        enrolled_at: enrolledAt || null,
        notes: notes || null,
      })
      toast.success("Enrollment updated")
      await onUpdated()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update enrollment")
    } finally {
      setIsUpdating(false)
    }
  }

  const label = enrollmentStatusLabel(enrollment)
  const selectsDisabled = readOnly || isLoadingOptions || isUpdating

  return (
    <div className="rounded-xl border border-border/50 bg-white p-5 shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-5">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
            <BookOpen className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-foreground truncate">
                {enrollment.syllabus?.name || "Syllabus"}
              </span>
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
            <div className="mt-0.5 text-xs text-muted-foreground">
              Enrolled {formatDate(enrollment.enrolled_at, timeZone) || "-"}
              {enrollment.completion_date ? (
                <span className="ml-2">· Completed {formatDate(enrollment.completion_date, timeZone) || "-"}</span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowNotes(!showNotes)}
            className="h-8 text-xs text-muted-foreground hover:text-foreground hover:bg-slate-100 flex items-center gap-1.5 px-2.5 rounded-lg"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>{showNotes ? "Hide notes" : notes ? "Edit notes" : "Add notes"}</span>
            {showNotes ? <ChevronUp className="w-3 h-3 opacity-50" /> : <ChevronDown className="w-3 h-3 opacity-50" />}
          </Button>

          {!readOnly && isDirty ? (
            <>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setPrimaryInstructorId(enrollment.primary_instructor_id || SELECT_NONE)
                  setAircraftTypeId(enrollment.aircraft_type || SELECT_NONE)
                  setEnrolledAt(toDateKey(enrollment.enrolled_at) || "")
                  setNotes(enrollment.notes || "")
                }}
                className="h-8 text-xs text-muted-foreground hover:text-foreground px-2.5"
                disabled={isUpdating}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => void handleSave()}
                disabled={isUpdating}
                className="h-8 rounded-lg bg-slate-900 text-white hover:bg-slate-800 px-3 text-xs font-semibold shadow-sm"
              >
                {isUpdating ? "Saving…" : "Save"}
              </Button>
            </>
          ) : null}
        </div>
      </div>

      {/* Fields */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Primary Instructor
          </label>
          <Select value={primaryInstructorId} onValueChange={setPrimaryInstructorId} disabled={selectsDisabled}>
            <SelectTrigger className="w-full h-9 rounded-lg border-border/70 bg-slate-50 px-3 text-sm data-[placeholder]:text-muted-foreground">
              {isLoadingOptions ? (
                <span className="text-muted-foreground text-sm">Loading…</span>
              ) : (
                <SelectValue placeholder="Assign instructor" />
              )}
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
          <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Aircraft Type
          </label>
          <Select value={aircraftTypeId} onValueChange={setAircraftTypeId} disabled={selectsDisabled}>
            <SelectTrigger className="w-full h-9 rounded-lg border-border/70 bg-slate-50 px-3 text-sm data-[placeholder]:text-muted-foreground">
              {isLoadingOptions ? (
                <span className="text-muted-foreground text-sm">Loading…</span>
              ) : (
                <SelectValue placeholder="Select aircraft type" />
              )}
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
          <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Enrollment Date
          </label>
          <DatePicker
            date={enrolledAt}
            onChange={(date) => setEnrolledAt(date || "")}
            placeholder="Select enrollment date"
            className="h-9 w-full bg-slate-50 border-border/70 rounded-lg"
            disabled={readOnly || isUpdating}
          />
        </div>
      </div>

      {showNotes ? (
        <div className="mt-4 space-y-1.5">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Notes
          </label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add training context, syllabus goals, or student requirements…"
            className="min-h-[80px] bg-slate-50 border-border/70 text-sm resize-none rounded-lg"
            disabled={readOnly}
          />
        </div>
      ) : null}
    </div>
  )
}

export function TrainingStudentProgrammeTab({
  userId,
  syllabi,
  enrollments,
  timeZone,
  onRefresh,
  embedded = false,
}: {
  userId: string
  syllabi: MemberTrainingSyllabusLite[]
  enrollments: MemberTrainingEnrollment[]
  timeZone: string
  onRefresh: () => Promise<void>
  embedded?: boolean
}) {
  const { role } = useAuth()
  const { timeZone: contextTimeZone } = useTimezone()
  const resolvedTimeZone = timeZone || contextTimeZone
  const staff = isStaff(role)

  const [instructors, setInstructors] = React.useState<InstructorWithRelations[]>([])
  const [aircraftTypes, setAircraftTypes] = React.useState<AircraftTypesRow[]>([])
  const [isLoadingOptions, setIsLoadingOptions] = React.useState(true)

  const [enrollOpen, setEnrollOpen] = React.useState(false)
  const [enrollSyllabusId, setEnrollSyllabusId] = React.useState("")
  const [enrollPrimaryInstructorId, setEnrollPrimaryInstructorId] = React.useState<string>(SELECT_NONE)
  const [enrollAircraftTypeId, setEnrollAircraftTypeId] = React.useState<string>(SELECT_NONE)
  const [enrollDate, setEnrollDate] = React.useState("")
  const [enrollNotes, setEnrollNotes] = React.useState("")
  const [enrollSubmitting, setEnrollSubmitting] = React.useState(false)

  React.useEffect(() => {
    if (!staff) {
      setIsLoadingOptions(false)
      return
    }
    let cancelled = false
    async function load() {
      setIsLoadingOptions(true)
      const [inst, ats] = await Promise.all([fetchInstructorsQuery(), fetchAircraftTypes()])
      if (cancelled) return
      setInstructors(inst)
      setAircraftTypes(ats as AircraftTypesRow[])
      setIsLoadingOptions(false)
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
  const hasAnyEnrollments = enrollments.length > 0
  const showEmbeddedStarter = embedded && !hasAnyEnrollments

  const activeSyllabusIds = new Set(activeEnrollments.map((e) => e.syllabus_id))
  const availableSyllabi = syllabi.filter((s) => !activeSyllabusIds.has(s.id))

  const handleCreateEnrollment = async () => {
    if (!enrollSyllabusId) {
      toast.error("Please select a syllabus")
      return
    }

    setEnrollSubmitting(true)
    try {
      await createTrainingEnrollment(userId, {
        syllabus_id: enrollSyllabusId,
        enrolled_at: enrollDate || undefined,
        notes: enrollNotes ? enrollNotes : null,
        primary_instructor_id: enrollPrimaryInstructorId === SELECT_NONE ? null : enrollPrimaryInstructorId,
        aircraft_type: enrollAircraftTypeId === SELECT_NONE ? null : enrollAircraftTypeId,
      })
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
    <div className={cn(embedded ? "space-y-4" : "px-4 py-5 sm:p-6 space-y-8")}>
      {/* Page header */}
      {showEmbeddedStarter ? (
        <div className="rounded-2xl border border-border/60 bg-gradient-to-br from-white via-slate-50/70 to-slate-100/40 px-6 py-7 sm:px-8 sm:py-8 min-h-[170px] flex items-center">
          <div className="flex w-full flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <h3 className="text-base font-semibold text-slate-900">No training programme yet</h3>
              <p className="max-w-[680px] text-sm text-muted-foreground">
                Enroll this member in a syllabus to start tracking lessons, debriefs, and theory progress.
              </p>
              <div className="inline-flex items-center rounded-full border border-border/60 bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                0 active enrollments
              </div>
            </div>
            {staff ? (
              <Button
                size="sm"
                onClick={() => setEnrollOpen(true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg h-10 px-5 text-sm font-semibold shadow-sm shrink-0"
                disabled={availableSyllabi.length === 0}
                title={availableSyllabi.length === 0 ? "No additional active syllabi available" : "Enroll in a syllabus"}
              >
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                Enroll Member
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground">Only staff can create enrollments.</p>
            )}
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Syllabus</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Manage syllabus enrollments, primary instructor and aircraft type.
            </p>
          </div>
          {staff ? (
            <Button
              size="sm"
              onClick={() => setEnrollOpen(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg h-9 px-4 text-xs font-semibold shadow-sm shrink-0"
              disabled={availableSyllabi.length === 0}
              title={availableSyllabi.length === 0 ? "No additional active syllabi available" : "Enroll in a syllabus"}
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Enroll
            </Button>
          ) : null}
        </div>
      )}

      {/* Active Enrollments */}
      {!showEmbeddedStarter ? (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Active Enrollments</h4>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground bg-muted/60 rounded-full px-2.5 py-0.5">
            {activeEnrollments.length} {activeEnrollments.length === 1 ? "enrollment" : "enrollments"}
          </span>
        </div>

        {activeEnrollments.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/10 py-10 text-center">
            <Target className="w-9 h-9 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm font-semibold text-foreground">No active enrollments</p>
            <p className="text-xs text-muted-foreground mt-1">
              Enroll the member to start tracking training against a syllabus.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {activeEnrollments.map((e) => (
              <EnrollmentCard
                key={e.id}
                userId={userId}
                enrollment={e}
                instructors={instructors}
                aircraftTypes={aircraftTypes}
                readOnly={!staff}
                isLoadingOptions={isLoadingOptions}
                onUpdated={onRefresh}
              />
            ))}
          </div>
        )}
      </div>
      ) : null}

      {/* Syllabus History */}
      {!showEmbeddedStarter ? (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Syllabus History</h4>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground bg-muted/60 rounded-full px-2.5 py-0.5">
            {historicalEnrollments.length} {historicalEnrollments.length === 1 ? "record" : "records"}
          </span>
        </div>

        {historicalEnrollments.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
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
                  <div key={e.id} className="rounded-xl border border-border/50 bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-semibold text-sm text-foreground truncate">{e.syllabus?.name || "Syllabus"}</span>
                        <Badge
                          variant="outline"
                          className={cn(
                            "h-5 rounded-md px-2 text-[10px] font-bold uppercase tracking-wide shadow-none shrink-0",
                            enrollmentStatusClasses(label)
                          )}
                        >
                          {label}
                        </Badge>
                      </div>
                      <div className="text-right text-xs text-muted-foreground tabular-nums shrink-0">
                        {formatDate(e.enrolled_at, resolvedTimeZone) || "-"}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-xs">
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Completed</div>
                        <div className="mt-0.5 font-medium tabular-nums">{formatDate(e.completion_date, resolvedTimeZone) || "—"}</div>
                      </div>
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Instructor</div>
                        <div className="mt-0.5 font-medium truncate">{instName || "—"}</div>
                      </div>
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Aircraft</div>
                        <div className="mt-0.5 font-medium truncate">{at?.name ?? "—"}</div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="hidden sm:block rounded-xl border border-border/50 bg-white shadow-sm overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/80 hover:bg-slate-50/80 border-b border-border/50">
                    <TableHead className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Syllabus
                    </TableHead>
                    <TableHead className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Status
                    </TableHead>
                    <TableHead className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Enrolled
                    </TableHead>
                    <TableHead className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Completed
                    </TableHead>
                    <TableHead className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Instructor
                    </TableHead>
                    <TableHead className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
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
                      <TableRow key={e.id} className="hover:bg-slate-50/60 border-b border-border/40 last:border-0">
                        <TableCell className="px-5 py-3.5">
                          <span className="font-medium text-sm text-foreground">{e.syllabus?.name || "Syllabus"}</span>
                        </TableCell>
                        <TableCell className="px-5 py-3.5">
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
                        <TableCell className="px-5 py-3.5 text-sm text-muted-foreground tabular-nums">
                          {formatDate(e.enrolled_at, resolvedTimeZone) || "—"}
                        </TableCell>
                        <TableCell className="px-5 py-3.5 text-sm text-muted-foreground tabular-nums">
                          {formatDate(e.completion_date, resolvedTimeZone) || "—"}
                        </TableCell>
                        <TableCell className="px-5 py-3.5 text-sm text-muted-foreground">
                          {instName || "—"}
                        </TableCell>
                        <TableCell className="px-5 py-3.5 text-sm text-muted-foreground">
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
      ) : null}

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
