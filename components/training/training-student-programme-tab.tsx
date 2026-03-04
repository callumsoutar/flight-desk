"use client"

import * as React from "react"
import { toast } from "sonner"
import { BookOpen, ChevronDown, ChevronUp, MessageSquare, Plane, Plus, Target, User } from "lucide-react"

import { useAuth } from "@/contexts/auth-context"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DatePicker } from "@/components/ui/date-picker"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { zonedTodayYyyyMmDd } from "@/lib/utils/timezone"
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
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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

  const todayKey = React.useMemo(() => zonedTodayYyyyMmDd(timeZone || "Pacific/Auckland"), [timeZone])

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
    <div className="p-6 space-y-6">
      <Card className="shadow-sm border border-border/50 bg-card overflow-hidden rounded-lg">
        <CardHeader className="pb-4 border-b border-slate-100">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <div className="p-2 rounded-full bg-indigo-50">
                <Target className="w-5 h-5 text-indigo-600" />
              </div>
              Programme
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

            {activeEnrollments.length === 0 ? (
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

            {historicalEnrollments.length === 0 ? (
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
                  const inst = e.primary_instructor_id
                    ? instructors.find((i) => i.id === e.primary_instructor_id) ?? null
                    : null
                  const at = e.aircraft_type ? aircraftTypes.find((a) => a.id === e.aircraft_type) ?? null : null
                  return (
                    <div
                      key={e.id}
                      className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden"
                    >
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
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

