"use client"

import * as React from "react"
import {
  AlertCircle,
  CalendarIcon,
  Check,
  NotebookPen,
  Plane,
  Plus,
  Repeat,
  User,
} from "lucide-react"
import { toast } from "sonner"

import { zonedDateTimeToUtc } from "@/lib/utils/timezone"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"

type SchedulerBookingDraft = {
  dateYyyyMmDd: string
  startTimeHHmm: string
  endTimeHHmm: string
  preselectedInstructorId?: string | null
  preselectedAircraftId?: string | null
}

type BookingType = "flight" | "groundwork" | "maintenance" | "other"

type BookingOptionsResponse = {
  options: {
    aircraft: Array<{
      id: string
      registration: string
      type: string
      model: string | null
      manufacturer: string | null
    }>
    members: Array<{
      id: string
      first_name: string | null
      last_name: string | null
      email: string
    }>
    instructors: Array<{
      id: string
      first_name: string | null
      last_name: string | null
      user_id: string | null
      is_actively_instructing?: boolean
      user: {
        id: string
        first_name: string | null
        last_name: string | null
        email: string
      } | null
    }>
    flightTypes: Array<{
      id: string
      name: string
      instruction_type: string | null
    }>
    syllabi?: Array<{
      id: string
      name: string
    }>
    lessons: Array<{
      id: string
      name: string
      description?: string | null
      order?: number | null
      syllabus_id: string | null
    }>
  }
}

type AvailabilityResponse = {
  unavailableAircraftIds: string[]
  unavailableInstructorIds: string[]
}

type FormState = {
  date: Date
  startTime: string
  endTime: string
  aircraftId: string | null
  flightTypeId: string | null
  lessonId: string | null
  instructorId: string | null
  memberId: string | null
  bookingType: BookingType
  purpose: string
  remarks: string
  isRecurring: boolean
  recurringDays: number[]
  repeatUntil: Date | null
}

type Occurrence = {
  date: Date
  startIso: string
  endIso: string
}

type ErrorState = Partial<
  Record<
    | "date"
    | "startTime"
    | "endTime"
    | "aircraftId"
    | "flightTypeId"
    | "lessonId"
    | "instructorId"
    | "memberId"
    | "bookingType"
    | "purpose"
    | "remarks"
    | "recurringDays"
    | "repeatUntil",
    string
  >
>

const BOOKING_TYPE_OPTIONS: { value: BookingType; label: string }[] = [
  { value: "flight", label: "Flight" },
  { value: "groundwork", label: "Ground Work" },
  { value: "maintenance", label: "Maintenance" },
  { value: "other", label: "Other" },
]

const TIME_OPTIONS = (() => {
  const values: string[] = []
  for (let hour = 7; hour <= 23; hour += 1) {
    values.push(`${String(hour).padStart(2, "0")}:00`)
    values.push(`${String(hour).padStart(2, "0")}:30`)
  }
  return values
})()

function formatName(value: { first_name: string | null; last_name: string | null; email: string | null }) {
  return [value.first_name, value.last_name].filter(Boolean).join(" ").trim() || value.email || "Unknown"
}

function toYyyyMmDd(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

function fromYyyyMmDd(value: string) {
  const [y, m, d] = value.split("-").map(Number)
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) {
    return new Date()
  }
  return new Date(y, m - 1, d, 12, 0, 0, 0)
}

function formatDdMmmYyyy(value: Date) {
  return new Intl.DateTimeFormat("en-NZ", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(value)
}

function formatEeeDdMmm(value: Date) {
  return new Intl.DateTimeFormat("en-NZ", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  }).format(value)
}

function parseTimeToMinutes(value: string) {
  const [hh, mm] = value.split(":")
  const h = Number(hh)
  const m = Number(mm)
  if (!Number.isInteger(h) || !Number.isInteger(m)) return null
  if (h < 0 || h > 23 || m < 0 || m > 59) return null
  return h * 60 + m
}

function addMinutesToHHmm(timeHHmm: string, minutesToAdd: number) {
  const start = parseTimeToMinutes(timeHHmm)
  if (start === null) return timeHHmm
  const maxEnd = 23 * 60 + 30
  const end = Math.min(start + minutesToAdd, maxEnd)
  const h = Math.floor(end / 60)
  const m = end % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

function combineSchoolDateAndTimeToIso(params: { date: Date; timeHHmm: string; timeZone: string }) {
  return zonedDateTimeToUtc({
    dateYyyyMmDd: toYyyyMmDd(params.date),
    timeHHmm: params.timeHHmm,
    timeZone: params.timeZone,
  }).toISOString()
}

function buildInitialState({
  draft,
  isStaff,
  currentUserId,
}: {
  draft: SchedulerBookingDraft
  isStaff: boolean
  currentUserId: string | null
}): FormState {
  const date = fromYyyyMmDd(draft.dateYyyyMmDd)
  return {
    date,
    startTime: draft.startTimeHHmm,
    endTime: addMinutesToHHmm(draft.startTimeHHmm, 120),
    aircraftId: draft.preselectedAircraftId ?? null,
    flightTypeId: null,
    lessonId: null,
    instructorId: draft.preselectedInstructorId ?? null,
    memberId: isStaff ? null : currentUserId,
    bookingType: "flight",
    purpose: "",
    remarks: "",
    isRecurring: false,
    recurringDays: [],
    repeatUntil: null,
  }
}

export function NewBookingModal({
  open,
  onOpenChange,
  draft,
  timeZone,
  isStaff,
  currentUserId,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  draft: SchedulerBookingDraft | null
  timeZone: string
  isStaff: boolean
  currentUserId: string | null
  onCreated: () => void
}) {
  const isMemberOrStudent = !isStaff
  const defaultDurationMinutes = 120

  const [bookingMode, setBookingMode] = React.useState<"regular" | "trial">("regular")
  const [form, setForm] = React.useState<FormState | null>(null)
  const [errors, setErrors] = React.useState<ErrorState>({})
  const [submitting, setSubmitting] = React.useState(false)

  const [selectedSyllabusId, setSelectedSyllabusId] = React.useState<string | null>(null)

  const [options, setOptions] = React.useState<BookingOptionsResponse["options"] | null>(null)
  const [optionsLoading, setOptionsLoading] = React.useState(false)
  const [optionsError, setOptionsError] = React.useState<string | null>(null)

  const [unavailableAircraftIds, setUnavailableAircraftIds] = React.useState<string[]>([])
  const [unavailableInstructorIds, setUnavailableInstructorIds] = React.useState<string[]>([])
  const [overlapsFetching, setOverlapsFetching] = React.useState(false)
  const [overlapsError, setOverlapsError] = React.useState<string | null>(null)

  const [occurrenceConflicts, setOccurrenceConflicts] = React.useState<Record<string, { aircraft: boolean; instructor: boolean }>>({})
  const [checkingOccurrences, setCheckingOccurrences] = React.useState(false)

  React.useEffect(() => {
    if (!open || !draft) return
    setForm(buildInitialState({ draft, isStaff, currentUserId }))
    setBookingMode("regular")
    setErrors({})
    setSelectedSyllabusId(null)
    setOccurrenceConflicts({})
    setUnavailableAircraftIds([])
    setUnavailableInstructorIds([])
    setOverlapsError(null)
  }, [open, draft, isStaff, currentUserId])

  React.useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    setOptionsLoading(true)
    setOptionsError(null)

    void fetch("/api/bookings/options", {
      method: "GET",
      cache: "no-store",
      headers: { "cache-control": "no-store" },
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          const payload = (await response.json().catch(() => ({}))) as { error?: string }
          throw new Error(payload.error || "Failed to load booking options")
        }
        const payload = (await response.json()) as BookingOptionsResponse
        setOptions(payload.options)
      })
      .catch((error) => {
        if (controller.signal.aborted) return
        setOptions(null)
        setOptionsError(error instanceof Error ? error.message : "Failed to load booking options")
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setOptionsLoading(false)
        }
      })

    return () => controller.abort()
  }, [open])

  const memberId = form?.memberId ?? null

  React.useEffect(() => {
    if (!open || !isMemberOrStudent) return
    if (memberId) return

    const candidate = options?.members?.[0]?.id ?? currentUserId
    if (!candidate) return

    setForm((prev) => (prev ? { ...prev, memberId: candidate } : prev))
  }, [open, memberId, isMemberOrStudent, options?.members, currentUserId])

  const selectedFlightType = React.useMemo(() => {
    if (!form?.flightTypeId) return null
    return (options?.flightTypes ?? []).find((ft) => ft.id === form.flightTypeId) ?? null
  }, [form?.flightTypeId, options?.flightTypes])

  const instructionType = (selectedFlightType?.instruction_type ?? null) as "trial" | "dual" | "solo" | null
  const shouldHideInstructor = form?.bookingType === "flight" && instructionType === "solo"

  React.useEffect(() => {
    if (!open || !form?.startTime) return
    setForm((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        endTime: addMinutesToHHmm(prev.startTime, defaultDurationMinutes),
      }
    })
  }, [open, form?.startTime])

  React.useEffect(() => {
    if (!open || !shouldHideInstructor || !form?.instructorId) return
    setForm((prev) => (prev ? { ...prev, instructorId: null } : prev))
  }, [open, shouldHideInstructor, form?.instructorId])

  const filteredFlightTypes = React.useMemo(() => {
    const all = options?.flightTypes ?? []
    if (bookingMode === "trial") return all.filter((ft) => ft.instruction_type === "trial")
    return all.filter((ft) => ft.instruction_type !== "trial")
  }, [bookingMode, options?.flightTypes])

  React.useEffect(() => {
    if (!open || !form?.flightTypeId) return
    const exists = filteredFlightTypes.some((ft) => ft.id === form.flightTypeId)
    if (exists) return
    setForm((prev) => (prev ? { ...prev, flightTypeId: null } : prev))
  }, [open, form?.flightTypeId, filteredFlightTypes])

  const isValidTimeRange = React.useMemo(() => {
    if (!form?.startTime || !form?.endTime) return false
    const start = parseTimeToMinutes(form.startTime)
    const end = parseTimeToMinutes(form.endTime)
    if (start === null || end === null) return false
    return end > start
  }, [form?.startTime, form?.endTime])

  const computedRange = React.useMemo(() => {
    if (!form?.date || !form.startTime || !form.endTime || !isValidTimeRange) return null
    return {
      startIso: combineSchoolDateAndTimeToIso({ date: form.date, timeHHmm: form.startTime, timeZone }),
      endIso: combineSchoolDateAndTimeToIso({ date: form.date, timeHHmm: form.endTime, timeZone }),
    }
  }, [form?.date, form?.startTime, form?.endTime, isValidTimeRange, timeZone])

  const computedRangeStartIso = computedRange?.startIso ?? null
  const computedRangeEndIso = computedRange?.endIso ?? null

  React.useEffect(() => {
    if (!open || !computedRangeStartIso || !computedRangeEndIso) return
    const controller = new AbortController()
    const params = new URLSearchParams({
      start_time: computedRangeStartIso,
      end_time: computedRangeEndIso,
    })

    setOverlapsFetching(true)
    setOverlapsError(null)

    void fetch(`/api/bookings/availability?${params.toString()}`, {
      method: "GET",
      cache: "no-store",
      headers: { "cache-control": "no-store" },
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          const payload = (await response.json().catch(() => ({}))) as { error?: string }
          throw new Error(payload.error || "Failed to check availability")
        }
        const payload = (await response.json()) as AvailabilityResponse
        setUnavailableAircraftIds(payload.unavailableAircraftIds ?? [])
        setUnavailableInstructorIds(payload.unavailableInstructorIds ?? [])
      })
      .catch((error) => {
        if (controller.signal.aborted) return
        setUnavailableAircraftIds([])
        setUnavailableInstructorIds([])
        setOverlapsError(error instanceof Error ? error.message : "Failed to check availability")
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setOverlapsFetching(false)
        }
      })

    return () => controller.abort()
  }, [open, computedRangeStartIso, computedRangeEndIso])

  const unavailableAircraftSet = React.useMemo(
    () => new Set(unavailableAircraftIds),
    [unavailableAircraftIds]
  )
  const unavailableInstructorSet = React.useMemo(
    () => new Set(unavailableInstructorIds),
    [unavailableInstructorIds]
  )

  const availableAircraft = React.useMemo(() => {
    const all = options?.aircraft ?? []
    if (!isValidTimeRange) return all
    return all.filter((a) => !unavailableAircraftSet.has(a.id))
  }, [options?.aircraft, isValidTimeRange, unavailableAircraftSet])

  const availableInstructors = React.useMemo(() => {
    const all = options?.instructors ?? []
    if (!isValidTimeRange) return all
    return all.filter((i) => !unavailableInstructorSet.has(i.id))
  }, [options?.instructors, isValidTimeRange, unavailableInstructorSet])

  React.useEffect(() => {
    if (!open || !isValidTimeRange) return

    if (form?.aircraftId && unavailableAircraftSet.has(form.aircraftId)) {
      setForm((prev) => (prev ? { ...prev, aircraftId: null } : prev))
      toast.message("Selected aircraft is no longer available for this time range.")
    }

    if (form?.instructorId && unavailableInstructorSet.has(form.instructorId)) {
      setForm((prev) => (prev ? { ...prev, instructorId: null } : prev))
      toast.message("Selected instructor is no longer available for this time range.")
    }
  }, [form?.aircraftId, form?.instructorId, open, isValidTimeRange, unavailableAircraftSet, unavailableInstructorSet])

  const lessonsForSelectedSyllabus = React.useMemo(() => {
    const all = options?.lessons ?? []
    if (!selectedSyllabusId) return all
    return all.filter((lesson) => lesson.syllabus_id === selectedSyllabusId)
  }, [options?.lessons, selectedSyllabusId])

  React.useEffect(() => {
    if (!form?.lessonId) return
    const exists = lessonsForSelectedSyllabus.some((lesson) => lesson.id === form.lessonId)
    if (exists) return
    setForm((prev) => (prev ? { ...prev, lessonId: null } : prev))
  }, [form?.lessonId, lessonsForSelectedSyllabus])

  const occurrences = React.useMemo<Occurrence[]>(() => {
    if (!form?.isRecurring || !form.repeatUntil || form.recurringDays.length === 0 || !isValidTimeRange) {
      return []
    }

    const list: Occurrence[] = []
    let current = new Date(form.date.getFullYear(), form.date.getMonth(), form.date.getDate(), 12, 0, 0, 0)
    const end = new Date(form.repeatUntil.getFullYear(), form.repeatUntil.getMonth(), form.repeatUntil.getDate(), 12, 0, 0, 0)

    while (current <= end) {
      if (form.recurringDays.includes(current.getDay())) {
        list.push({
          date: new Date(current),
          startIso: combineSchoolDateAndTimeToIso({ date: current, timeHHmm: form.startTime, timeZone }),
          endIso: combineSchoolDateAndTimeToIso({ date: current, timeHHmm: form.endTime, timeZone }),
        })
      }
      current = new Date(current.getFullYear(), current.getMonth(), current.getDate() + 1, 12, 0, 0, 0)
    }

    return list
  }, [
    form?.date,
    form?.endTime,
    form?.isRecurring,
    form?.recurringDays,
    form?.repeatUntil,
    form?.startTime,
    isValidTimeRange,
    timeZone,
  ])

  React.useEffect(() => {
    if (!open || !form?.isRecurring || occurrences.length === 0) {
      setOccurrenceConflicts({})
      return
    }

    const timer = setTimeout(() => {
      const check = async () => {
        setCheckingOccurrences(true)
        const conflicts: Record<string, { aircraft: boolean; instructor: boolean }> = {}

        try {
          await Promise.all(
            occurrences.map(async (occ) => {
              const params = new URLSearchParams({
                start_time: occ.startIso,
                end_time: occ.endIso,
              })
              const response = await fetch(`/api/bookings/availability?${params.toString()}`, {
                method: "GET",
                cache: "no-store",
                headers: { "cache-control": "no-store" },
              })
              if (!response.ok) return
              const payload = (await response.json()) as AvailabilityResponse

              const aircraftConflict = form.aircraftId ? payload.unavailableAircraftIds.includes(form.aircraftId) : false
              const instructorConflict = form.instructorId ? payload.unavailableInstructorIds.includes(form.instructorId) : false
              if (aircraftConflict || instructorConflict) {
                conflicts[occ.startIso] = { aircraft: aircraftConflict, instructor: instructorConflict }
              }
            })
          )

          setOccurrenceConflicts(conflicts)
        } finally {
          setCheckingOccurrences(false)
        }
      }

      void check()
    }, 500)

    return () => clearTimeout(timer)
  }, [open, form?.isRecurring, form?.aircraftId, form?.instructorId, occurrences])

  const hasConflicts = Object.keys(occurrenceConflicts).length > 0

  const isCheckingAvailability =
    open && isValidTimeRange && overlapsFetching

  const updateForm = React.useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
  }, [])

  const validate = React.useCallback(
    (values: FormState) => {
      const nextErrors: ErrorState = {}

      const start = parseTimeToMinutes(values.startTime)
      const end = parseTimeToMinutes(values.endTime)
      if (start === null) nextErrors.startTime = "Start time is required"
      if (end === null) nextErrors.endTime = "End time is required"
      if (start !== null && end !== null && end <= start) {
        nextErrors.endTime = "End time must be after start time"
      }

      if (!values.purpose.trim()) {
        nextErrors.purpose = "Description is required"
      }

      if ((values.bookingType === "flight" || values.bookingType === "maintenance") && !values.aircraftId) {
        nextErrors.aircraftId = "Aircraft is required for flight and maintenance bookings"
      }

      if (isStaff && !values.memberId) {
        nextErrors.memberId = "Member is required"
      }

      if (isStaff && values.bookingType === "flight" && !values.flightTypeId) {
        nextErrors.flightTypeId = "Flight type is required"
      }

      if (values.isRecurring) {
        if (values.recurringDays.length === 0) {
          nextErrors.recurringDays = "Select at least one day"
        }
        if (!values.repeatUntil) {
          nextErrors.repeatUntil = "Repeat until date is required"
        } else {
          const startDate = new Date(values.date.getFullYear(), values.date.getMonth(), values.date.getDate(), 12, 0, 0, 0)
          const endDate = new Date(values.repeatUntil.getFullYear(), values.repeatUntil.getMonth(), values.repeatUntil.getDate(), 12, 0, 0, 0)
          if (endDate <= startDate) {
            nextErrors.repeatUntil = "Repeat until date must be after the booking date"
          }
        }
      }

      return nextErrors
    },
    [isStaff]
  )

  const submit = React.useCallback(
    async (status: "unconfirmed" | "confirmed") => {
      if (!form) return

      const nextErrors = validate(form)
      setErrors(nextErrors)
      if (Object.keys(nextErrors).length > 0) {
        toast.error("Please fix the highlighted fields.")
        return
      }

      if (form.isRecurring && hasConflicts) {
        toast.error("Please resolve the resource conflicts before saving.")
        return
      }

      const makePayload = (startIso: string, endIso: string) => ({
        aircraft_id: form.aircraftId,
        start_time: startIso,
        end_time: endIso,
        booking_type: form.bookingType,
        purpose: form.purpose.trim(),
        remarks: form.remarks.trim() || null,
        instructor_id: shouldHideInstructor ? null : form.instructorId,
        flight_type_id: isMemberOrStudent ? null : form.flightTypeId,
        lesson_id: isMemberOrStudent ? null : form.lessonId,
        user_id: isStaff ? form.memberId : currentUserId,
        status,
      })

      setSubmitting(true)
      try {
        if (form.isRecurring && occurrences.length > 0) {
          for (const occ of occurrences) {
            const response = await fetch("/api/bookings", {
              method: "POST",
              headers: { "Content-Type": "application/json", "cache-control": "no-store" },
              body: JSON.stringify(makePayload(occ.startIso, occ.endIso)),
            })
            if (!response.ok) {
              const payload = (await response.json().catch(() => ({}))) as { error?: string }
              throw new Error(payload.error || "Failed to create recurring bookings")
            }
          }

          toast.success(`${occurrences.length} bookings created`)
          onOpenChange(false)
          onCreated()
          return
        }

        const startIso = combineSchoolDateAndTimeToIso({
          date: form.date,
          timeHHmm: form.startTime,
          timeZone,
        })
        const endIso = combineSchoolDateAndTimeToIso({
          date: form.date,
          timeHHmm: form.endTime,
          timeZone,
        })

        const response = await fetch("/api/bookings", {
          method: "POST",
          headers: { "Content-Type": "application/json", "cache-control": "no-store" },
          body: JSON.stringify(makePayload(startIso, endIso)),
        })

        if (!response.ok) {
          const payload = (await response.json().catch(() => ({}))) as { error?: string }
          throw new Error(payload.error || "Failed to create booking")
        }

        toast.success("Booking created")
        onOpenChange(false)
        onCreated()
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to create booking")
      } finally {
        setSubmitting(false)
      }
    },
    [
      currentUserId,
      form,
      hasConflicts,
      isMemberOrStudent,
      isStaff,
      occurrences,
      onCreated,
      onOpenChange,
      shouldHideInstructor,
      timeZone,
      validate,
    ]
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          "p-0 border-none shadow-2xl rounded-[24px] overflow-hidden flex flex-col",
          "w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] sm:w-full sm:max-w-[720px]",
          "top-4 sm:top-1/2 translate-y-0 sm:-translate-y-1/2",
          "h-[calc(100vh-2rem)] supports-[height:100dvh]:h-[calc(100dvh-2rem)] sm:h-auto sm:max-h-[calc(100vh-4rem)] sm:max-h-[calc(100dvh-4rem)]"
        )}
      >
        <div className="flex flex-1 min-h-0 flex-col overflow-hidden bg-white">
          <DialogHeader className="px-6 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-4 text-left sm:pt-6 shrink-0">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                <Plus className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold tracking-tight text-slate-900">New Booking</DialogTitle>
                <DialogDescription className="mt-0.5 text-sm text-slate-500">
                  Enter details for the new booking. Required fields are marked with <span className="text-destructive">*</span>.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {!form ? (
            <div className="flex flex-1 items-center justify-center text-sm text-slate-500">Preparing booking form...</div>
          ) : (
            <form
              onSubmit={(event) => {
                event.preventDefault()
                void submit("unconfirmed")
              }}
              className="flex-1 overflow-y-auto px-6 pb-6"
            >
              <div className="space-y-6">
                {!isMemberOrStudent ? (
                  <section>
                    <div className="mb-3 flex items-center gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                      <span className="text-xs font-semibold tracking-tight text-slate-900">Booking Category</span>
                    </div>
                    <Tabs value={bookingMode} onValueChange={(value) => setBookingMode(value as "regular" | "trial")} className="w-full">
                      <TabsList className="grid h-9 w-full grid-cols-2 rounded-[12px] bg-slate-50 p-1 ring-1 ring-slate-100">
                        <TabsTrigger
                          value="regular"
                          className="gap-2 rounded-[8px] py-1 text-xs font-semibold data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-slate-200"
                        >
                          <User className="h-3.5 w-3.5" />
                          Regular Booking
                        </TabsTrigger>
                        <TabsTrigger
                          value="trial"
                          className="gap-2 rounded-[8px] py-1 text-xs font-semibold data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-slate-200"
                        >
                          <Plane className="h-3.5 w-3.5" />
                          Trial Flight
                        </TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </section>
                ) : null}

                <section className="rounded-[24px] bg-slate-50/50 p-5 ring-1 ring-slate-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                        <Repeat className="h-4 w-4" />
                      </div>
                      <div>
                        <Label htmlFor="recurring" className="text-sm font-bold text-slate-900">Recurring Booking</Label>
                        <p className="text-[10px] font-medium text-slate-500">Automatically repeat this schedule</p>
                      </div>
                    </div>
                    <Switch
                      id="recurring"
                      checked={form.isRecurring}
                      onCheckedChange={(checked) => {
                        updateForm("isRecurring", checked)
                        if (!checked) {
                          updateForm("recurringDays", [])
                          updateForm("repeatUntil", null)
                        } else {
                          updateForm("recurringDays", [form.date.getDay()])
                        }
                      }}
                    />
                  </div>

                  {form.isRecurring ? (
                    <div className="mt-5 space-y-5 border-t border-slate-100 pt-5">
                      <div className="space-y-3">
                        <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Repeat on days</Label>
                        <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
                          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, index) => {
                            const isSelected = form.recurringDays.includes(index)
                            return (
                              <Button
                                key={day}
                                type="button"
                                variant={isSelected ? "default" : "outline"}
                                className={cn(
                                  "h-9 w-full rounded-xl p-0 text-[10px] font-bold transition-all",
                                  isSelected
                                    ? "border-slate-900 bg-slate-900 text-white shadow-sm hover:bg-slate-800"
                                    : "border-slate-200 text-slate-600 shadow-none hover:border-slate-300 hover:bg-slate-50"
                                )}
                                onClick={() => {
                                  if (isSelected) {
                                    updateForm("recurringDays", form.recurringDays.filter((value) => value !== index))
                                  } else {
                                    updateForm("recurringDays", [...form.recurringDays, index])
                                  }
                                }}
                              >
                                <span className="sm:hidden">{day.charAt(0)}</span>
                                <span className="hidden sm:inline">{day}</span>
                              </Button>
                            )
                          })}
                        </div>
                        {errors.recurringDays ? <p className="text-[10px] font-medium text-destructive">{errors.recurringDays}</p> : null}
                      </div>

                      <div className="flex items-center justify-between gap-4 rounded-xl bg-white p-3 ring-1 ring-slate-100">
                        <div className="space-y-0.5">
                          <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Until Date</Label>
                          <p className="text-[10px] font-medium text-slate-500">Last occurrence</p>
                        </div>
                        <div className="w-[140px]">
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                type="button"
                                variant="outline"
                                className={cn(
                                  "h-9 w-full justify-start rounded-lg border-slate-200 bg-white px-2.5 text-xs font-bold shadow-none transition-colors hover:bg-slate-50 focus:ring-0",
                                  !form.repeatUntil && "text-slate-400"
                                )}
                              >
                                <CalendarIcon className="mr-2 h-3.5 w-3.5 shrink-0 text-slate-400" />
                                <span className="truncate">{form.repeatUntil ? formatDdMmmYyyy(form.repeatUntil) : "End date"}</span>
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto rounded-2xl border-slate-200 p-0 shadow-2xl" align="end">
                              <Calendar
                                mode="single"
                                selected={form.repeatUntil ?? undefined}
                                onSelect={(value) => {
                                  if (!value) {
                                    updateForm("repeatUntil", null)
                                    return
                                  }
                                  const day = new Date(value.getFullYear(), value.getMonth(), value.getDate(), 12, 0, 0, 0)
                                  const startDay = new Date(
                                    form.date.getFullYear(),
                                    form.date.getMonth(),
                                    form.date.getDate(),
                                    12,
                                    0,
                                    0,
                                    0
                                  )
                                  updateForm("repeatUntil", day > startDay ? value : null)
                                }}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                      </div>
                      {errors.repeatUntil ? <p className="text-[10px] font-medium text-destructive">{errors.repeatUntil}</p> : null}
                    </div>
                  ) : null}
                </section>

                {form.isRecurring && occurrences.length > 0 ? (
                  <section className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                        <span className="text-xs font-semibold tracking-tight text-slate-900">Occurrences ({occurrences.length})</span>
                      </div>
                      {checkingOccurrences ? <span className="animate-pulse text-[10px] text-slate-500">Checking availability...</span> : null}
                    </div>

                    {hasConflicts ? (
                      <div className="space-y-3 rounded-xl border border-destructive/20 bg-destructive/5 p-4">
                        <div className="flex items-center gap-2 text-destructive">
                          <AlertCircle className="h-4 w-4" />
                          <span className="text-xs font-bold">Resource Conflicts Detected</span>
                        </div>
                        <p className="text-[10px] leading-relaxed text-destructive/80">
                          Some occurrences have conflicts with existing bookings. Please adjust your schedule or resources.
                        </p>
                        <div className="max-h-[160px] space-y-1 overflow-y-auto pr-2">
                          {occurrences.map((occ) => {
                            const conflict = occurrenceConflicts[occ.startIso]
                            if (!conflict) return null
                            return (
                              <div key={occ.startIso} className="flex items-center justify-between rounded-lg bg-white/50 px-3 py-2 text-[10px] ring-1 ring-destructive/10">
                                <span className="font-semibold text-slate-700">{formatEeeDdMmm(occ.date)}</span>
                                <div className="flex gap-2">
                                  {conflict.aircraft ? (
                                    <span className="rounded bg-destructive/10 px-1.5 py-0.5 font-bold uppercase tracking-wider text-destructive">Aircraft Conflict</span>
                                  ) : null}
                                  {conflict.instructor ? (
                                    <span className="rounded bg-destructive/10 px-1.5 py-0.5 font-bold uppercase tracking-wider text-destructive">Instructor Conflict</span>
                                  ) : null}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ) : occurrences.length > 1 ? (
                      <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-2 text-emerald-700">
                        <Check className="h-3.5 w-3.5" />
                        <span className="text-[10px] font-medium">All {occurrences.length} occurrences are available</span>
                      </div>
                    ) : null}
                  </section>
                ) : null}

                <section>
                  <div className="mb-3 flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                    <span className="text-xs font-semibold tracking-tight text-slate-900">Schedule Times</span>
                  </div>

                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                        START TIME <span className="text-destructive">*</span>
                      </label>
                      <div className="flex gap-2">
                        <div className="flex-[1.4] space-y-1">
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                type="button"
                                variant="outline"
                                className="h-10 w-full justify-start rounded-xl border-slate-200 bg-white px-3 text-base font-medium shadow-none hover:bg-slate-50 focus:ring-0"
                              >
                                <CalendarIcon className="mr-2 h-3.5 w-3.5 shrink-0 text-slate-400" />
                                <span className="truncate">{formatDdMmmYyyy(form.date)}</span>
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={form.date}
                                onSelect={(value) => {
                                  if (!value) return
                                  updateForm("date", value)
                                }}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                          {errors.date ? <p className="text-[10px] text-destructive">{errors.date}</p> : null}
                        </div>
                        <div className="flex-1 space-y-1">
                          <Select
                            value={form.startTime}
                            onValueChange={(value) => updateForm("startTime", value)}
                          >
                            <SelectTrigger className="h-10 w-full rounded-xl border-slate-200 bg-white px-3 text-base font-medium shadow-none hover:bg-slate-50 focus:ring-0">
                              <SelectValue placeholder="Time" />
                            </SelectTrigger>
                            <SelectContent position="popper" className="w-[var(--radix-select-trigger-width)] rounded-xl border-slate-200 shadow-xl">
                              {TIME_OPTIONS.map((time) => (
                                <SelectItem key={time} value={time} className="rounded-lg py-2 text-xs">
                                  {time}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {errors.startTime ? <p className="text-[10px] text-destructive">{errors.startTime}</p> : null}
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                        END TIME <span className="text-destructive">*</span>
                      </label>
                      <div className="flex gap-2">
                        <div className="flex-[1.4]">
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                type="button"
                                variant="outline"
                                className="h-10 w-full justify-start rounded-xl border-slate-200 bg-white px-3 text-base font-medium shadow-none hover:bg-slate-50 focus:ring-0"
                              >
                                <CalendarIcon className="mr-2 h-3.5 w-3.5 shrink-0 text-slate-400" />
                                <span className="truncate">{formatDdMmmYyyy(form.date)}</span>
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={form.date}
                                onSelect={(value) => {
                                  if (!value) return
                                  updateForm("date", value)
                                }}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                        <div className="flex-1 space-y-1">
                          <Select
                            value={form.endTime}
                            onValueChange={(value) => updateForm("endTime", value)}
                          >
                            <SelectTrigger className="h-10 w-full rounded-xl border-slate-200 bg-white px-3 text-base font-medium shadow-none hover:bg-slate-50 focus:ring-0">
                              <SelectValue placeholder="Time" />
                            </SelectTrigger>
                            <SelectContent position="popper" className="w-[var(--radix-select-trigger-width)] rounded-xl border-slate-200 shadow-xl">
                              {TIME_OPTIONS.map((time) => (
                                <SelectItem key={time} value={time} className="rounded-lg py-2 text-xs">
                                  {time}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {errors.endTime ? <p className="text-[10px] text-destructive">{errors.endTime}</p> : null}
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                <section>
                  <div className="mb-3 flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                    <span className="text-xs font-semibold tracking-tight text-slate-900">Booking Details</span>
                  </div>

                  {optionsError ? (
                    <div className="mb-3 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-2 text-[10px] font-medium text-destructive">
                      Could not load booking options. Please refresh and try again.
                    </div>
                  ) : null}
                  {overlapsError ? (
                    <div className="mb-3 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-2 text-[10px] font-medium text-amber-700">
                      Could not verify aircraft/instructor availability. You can still try to save; the database will prevent invalid overlaps.
                    </div>
                  ) : null}

                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                        SELECT MEMBER {isStaff ? <span className="text-destructive">*</span> : null}
                      </label>
                      {isStaff ? (
                        <>
                          <Select
                            value={form.memberId ?? "none"}
                            onValueChange={(value) => updateForm("memberId", value === "none" ? null : value)}
                            disabled={optionsLoading}
                          >
                            <SelectTrigger className="h-10 w-full rounded-xl border-slate-200 bg-white px-3 text-base font-medium shadow-none hover:bg-slate-50 focus:ring-0">
                              <div className="flex items-center gap-2 truncate">
                                <User className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                                <SelectValue placeholder="Select member" />
                              </div>
                            </SelectTrigger>
                            <SelectContent position="popper" className="w-[var(--radix-select-trigger-width)] rounded-xl border-slate-200 shadow-xl">
                              <SelectItem value="none" className="rounded-lg py-2 text-xs">
                                Select member
                              </SelectItem>
                              {(options?.members ?? []).map((member) => (
                                <SelectItem key={member.id} value={member.id} className="rounded-lg py-2 text-xs">
                                  {formatName(member)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {errors.memberId ? <p className="mt-1 text-[10px] text-destructive">{errors.memberId}</p> : null}
                        </>
                      ) : (
                        <div className="flex h-10 items-center rounded-xl border border-slate-200 bg-slate-50/50 px-3 text-xs font-medium text-slate-600">
                          <User className="mr-2 h-3.5 w-3.5 shrink-0 text-slate-400" />
                          <span className="truncate">{options?.members?.[0] ? formatName(options.members[0]) : "your account"}</span>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-wider text-slate-400">SELECT INSTRUCTOR</label>
                      <Select
                        disabled={optionsLoading || shouldHideInstructor || isCheckingAvailability}
                        value={form.instructorId || "none"}
                        onValueChange={(value) => updateForm("instructorId", value === "none" ? null : value)}
                      >
                        <SelectTrigger className="h-10 w-full rounded-xl border-slate-200 bg-white px-3 text-base font-medium shadow-none hover:bg-slate-50 focus:ring-0">
                          <div className="flex items-center gap-2 truncate">
                            <User className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                            <SelectValue
                              placeholder={
                                shouldHideInstructor
                                  ? "Not required"
                                  : optionsLoading
                                    ? "Loading..."
                                    : isCheckingAvailability
                                      ? "Checking availability..."
                                      : "No instructor"
                              }
                            />
                          </div>
                        </SelectTrigger>
                        <SelectContent position="popper" className="w-[var(--radix-select-trigger-width)] rounded-xl border-slate-200 shadow-xl">
                          <SelectItem value="none" className="rounded-lg py-2 text-xs">
                            No instructor
                          </SelectItem>
                          {availableInstructors.map((instructor) => (
                            <SelectItem key={instructor.id} value={instructor.id} className="rounded-lg py-2 text-xs">
                              {formatName({
                                first_name: instructor.user?.first_name ?? instructor.first_name,
                                last_name: instructor.user?.last_name ?? instructor.last_name,
                                email: instructor.user?.email ?? null,
                              })}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {errors.instructorId ? <p className="mt-1 text-[10px] text-destructive">{errors.instructorId}</p> : null}
                    </div>

                    <div>
                      <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                        AIRCRAFT {(form.bookingType === "flight" || form.bookingType === "maintenance") ? <span className="text-destructive">*</span> : null}
                      </label>
                      <Select
                        disabled={optionsLoading || isCheckingAvailability}
                        value={form.aircraftId || "none"}
                        onValueChange={(value) => updateForm("aircraftId", value === "none" ? null : value)}
                      >
                        <SelectTrigger className="h-10 w-full rounded-xl border-slate-200 bg-white px-3 text-base font-medium shadow-none hover:bg-slate-50 focus:ring-0">
                          <div className="flex items-center gap-2 truncate">
                            <Plane className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                            <SelectValue
                              placeholder={
                                optionsLoading
                                  ? "Loading..."
                                  : isCheckingAvailability
                                    ? "Checking availability..."
                                    : (form.bookingType === "flight" || form.bookingType === "maintenance")
                                      ? "Select aircraft"
                                      : "No aircraft (optional)"
                              }
                            />
                          </div>
                        </SelectTrigger>
                        <SelectContent position="popper" className="w-[var(--radix-select-trigger-width)] rounded-xl border-slate-200 shadow-xl">
                          <SelectItem value="none" className="rounded-lg py-2 text-xs">
                            {(form.bookingType === "flight" || form.bookingType === "maintenance") ? "Select aircraft" : "No aircraft"}
                          </SelectItem>
                          {availableAircraft.map((aircraft) => (
                            <SelectItem key={aircraft.id} value={aircraft.id} className="rounded-lg py-2 text-xs">
                              {aircraft.registration} ({aircraft.type})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {errors.aircraftId ? <p className="mt-1 text-[10px] text-destructive">{errors.aircraftId}</p> : null}
                    </div>

                    <div>
                      <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                        BOOKING TYPE <span className="text-destructive">*</span>
                      </label>
                      <Select
                        value={form.bookingType}
                        onValueChange={(value) => {
                          const nextType = value as BookingType
                          updateForm("bookingType", nextType)
                          if (nextType !== "flight") {
                            updateForm("flightTypeId", null)
                          }
                          if (nextType === "groundwork" || nextType === "other") {
                            updateForm("aircraftId", null)
                          }
                        }}
                      >
                        <SelectTrigger className="h-10 w-full rounded-xl border-slate-200 bg-white px-3 text-base font-medium shadow-none hover:bg-slate-50 focus:ring-0">
                          <SelectValue placeholder="Type" />
                        </SelectTrigger>
                        <SelectContent position="popper" className="w-[var(--radix-select-trigger-width)] rounded-xl border-slate-200 shadow-xl">
                          {BOOKING_TYPE_OPTIONS.map((item) => (
                            <SelectItem key={item.value} value={item.value} className="rounded-lg py-2 text-xs">
                              {item.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {errors.bookingType ? <p className="mt-1 text-[10px] text-destructive">{errors.bookingType}</p> : null}
                    </div>

                    {!isMemberOrStudent ? (
                      <div className="sm:col-span-2">
                        <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                          FLIGHT TYPE {form.bookingType === "flight" ? <span className="text-destructive">*</span> : null}
                        </label>
                        <Select
                          disabled={optionsLoading || form.bookingType !== "flight"}
                          value={form.flightTypeId || "none"}
                          onValueChange={(value) => updateForm("flightTypeId", value === "none" ? null : value)}
                        >
                          <SelectTrigger className="h-10 w-full rounded-xl border-slate-200 bg-white px-3 text-base font-medium shadow-none hover:bg-slate-50 focus:ring-0">
                            <div className="flex items-center gap-2 truncate">
                              <Plane className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                              <SelectValue
                                placeholder={
                                  form.bookingType !== "flight"
                                    ? "N/A"
                                    : optionsLoading
                                      ? "Loading..."
                                      : "Select flight type"
                                }
                              />
                            </div>
                          </SelectTrigger>
                          <SelectContent position="popper" className="w-[var(--radix-select-trigger-width)] rounded-xl border-slate-200 shadow-xl">
                            <SelectItem value="none" className="rounded-lg py-2 text-xs">
                              None
                            </SelectItem>
                            {filteredFlightTypes.map((flightType) => (
                              <SelectItem key={flightType.id} value={flightType.id} className="rounded-lg py-2 text-xs">
                                {flightType.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {errors.flightTypeId ? <p className="mt-1 text-[10px] text-destructive">{errors.flightTypeId}</p> : null}
                      </div>
                    ) : null}

                    {!isMemberOrStudent ? (
                      <div>
                        <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-wider text-slate-400">SYLLABUS</label>
                        <Select
                          value={selectedSyllabusId ?? "none"}
                          onValueChange={(value) => {
                            setSelectedSyllabusId(value === "none" ? null : value)
                            updateForm("lessonId", null)
                          }}
                          disabled={form.bookingType !== "flight" || (options?.syllabi ?? []).length === 0}
                        >
                          <SelectTrigger className="h-10 w-full rounded-xl border-slate-200 bg-white px-3 text-base font-medium shadow-none hover:bg-slate-50 focus:ring-0">
                            <SelectValue
                              placeholder={
                                form.bookingType !== "flight"
                                  ? "N/A"
                                  : (options?.syllabi ?? []).length === 0
                                    ? "No active syllabi"
                                    : "Select syllabus"
                              }
                            />
                          </SelectTrigger>
                          <SelectContent position="popper" className="w-[var(--radix-select-trigger-width)] rounded-xl border-slate-200 shadow-xl">
                            <SelectItem value="none" className="rounded-lg py-2 text-xs">
                              Select syllabus
                            </SelectItem>
                            {(options?.syllabi ?? []).map((syllabus) => (
                              <SelectItem key={syllabus.id} value={syllabus.id} className="rounded-lg py-2 text-xs">
                                {syllabus.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : null}

                    {!isMemberOrStudent ? (
                      <div>
                        <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-wider text-slate-400">LESSON</label>
                        <Select
                          value={form.lessonId ?? "none"}
                          onValueChange={(value) => updateForm("lessonId", value === "none" ? null : value)}
                          disabled={form.bookingType !== "flight" || optionsLoading}
                        >
                          <SelectTrigger className="h-10 w-full rounded-xl border-slate-200 bg-white px-3 text-base font-medium shadow-none hover:bg-slate-50 focus:ring-0">
                            <div className="flex items-center gap-2 truncate">
                              <NotebookPen className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                              <SelectValue
                                placeholder={
                                  form.bookingType !== "flight"
                                    ? "N/A"
                                    : optionsLoading
                                      ? "Loading..."
                                      : "Select lesson"
                                }
                              />
                            </div>
                          </SelectTrigger>
                          <SelectContent position="popper" className="w-[var(--radix-select-trigger-width)] rounded-xl border-slate-200 shadow-xl">
                            <SelectItem value="none" className="rounded-lg py-2 text-xs">
                              No lesson
                            </SelectItem>
                            {lessonsForSelectedSyllabus.map((lesson) => (
                              <SelectItem key={lesson.id} value={lesson.id} className="rounded-lg py-2 text-xs">
                                {lesson.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {errors.lessonId ? <p className="mt-1 text-[10px] text-destructive">{errors.lessonId}</p> : null}
                      </div>
                    ) : null}
                  </div>
                </section>

                <section>
                  <div className="mb-3 flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    <span className="text-xs font-semibold tracking-tight text-slate-900">Notes & Remarks</span>
                  </div>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                        DESCRIPTION <span className="text-destructive">*</span>
                      </label>
                      <Textarea
                        rows={3}
                        placeholder="e.g. Dual circuits..."
                        className="rounded-xl border-slate-200 text-base focus:ring-slate-900"
                        value={form.purpose}
                        onChange={(event) => updateForm("purpose", event.target.value)}
                      />
                      {errors.purpose ? <p className="mt-1 text-[10px] text-destructive">{errors.purpose}</p> : null}
                    </div>

                    <div>
                      <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-wider text-slate-400">REMARKS (OPTIONAL)</label>
                      <Textarea
                        rows={3}
                        placeholder="Internal notes..."
                        className="rounded-xl border-slate-200 text-base focus:ring-slate-900"
                        value={form.remarks}
                        onChange={(event) => updateForm("remarks", event.target.value)}
                      />
                      {errors.remarks ? <p className="mt-1 text-[10px] text-destructive">{errors.remarks}</p> : null}
                    </div>
                  </div>
                </section>
              </div>
            </form>
          )}

          <div className="border-t bg-white px-6 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-[0_-4px_12px_rgba(0,0,0,0.05)] sm:pb-4 shrink-0">
            <div className="flex items-center justify-between gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={submitting}
                className="h-10 flex-1 rounded-xl border-slate-200 text-xs font-bold shadow-none hover:bg-slate-50"
              >
                Cancel
              </Button>
              {isStaff ? (
                <Button
                  type="button"
                  disabled={submitting}
                  onClick={() => {
                    void submit("confirmed")
                  }}
                  className="h-10 flex-1 rounded-xl bg-emerald-600 text-xs font-bold text-white shadow-lg shadow-emerald-600/10 hover:bg-emerald-500"
                >
                  Save & Confirm
                </Button>
              ) : null}
              <Button
                type="button"
                disabled={submitting}
                onClick={() => {
                  void submit("unconfirmed")
                }}
                className="h-10 flex-[1.4] rounded-xl bg-slate-900 text-xs font-bold text-white shadow-lg shadow-slate-900/10 hover:bg-slate-800"
              >
                {submitting ? "Saving..." : "Save Booking"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export type { SchedulerBookingDraft }
