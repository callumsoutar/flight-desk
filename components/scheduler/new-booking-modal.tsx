"use client"

import * as React from "react"
import {
  AlertCircle,
  CalendarIcon,
  Check,
  ChevronDown,
  Clock,
  HelpCircle,
  Mail,
  Phone,
  Plane,
  Plus,
  Ticket,
  User,
  Wrench,
} from "lucide-react"
import { toast } from "sonner"

import { zonedDateTimeToUtc } from "@/lib/utils/timezone"
import { formatDate } from "@/lib/utils/date-format"
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
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { LessonSearchDropdown } from "@/components/bookings/lesson-search-dropdown"
import { MemberTrainingPeek } from "@/components/bookings/member-training-peek"
import type { MemberTrainingPeekResponse } from "@/lib/types/member-training-peek"
import MemberSelect, { type UserResult } from "@/components/invoices/member-select"

type SchedulerBookingDraft = {
  dateYyyyMmDd: string
  startTimeHHmm: string
  endTimeHHmm: string
  preselectedInstructorId?: string | null
  preselectedAircraftId?: string | null
}

type InstructorRosterWindow = { startMin: number; endMin: number }

type BookingType = "flight" | "groundwork" | "maintenance" | "other"

type BookingOptionsResponse = {
  options: {
    aircraft: Array<{
      id: string
      registration: string
      type: string
      aircraft_type_id: string | null
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
    syllabi: Array<{
      id: string
      name: string
    }>
    lessons: Array<{
      id: string
      name: string
      description: string | null
      order: number | null
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
  endDate: Date
  startTime: string
  endTime: string
  aircraftId: string | null
  flightTypeId: string | null
  instructorId: string | null
  memberId: string | null
  bookingType: BookingType
  lessonId: string | null
  purpose: string
  remarks: string
  isRecurring: boolean
  recurringDays: number[]
  repeatUntil: Date | null
  trialFirstName: string
  trialLastName: string
  trialEmail: string
  trialPhone: string
  voucherNumber: string
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
    | "instructorId"
    | "memberId"
    | "bookingType"
    | "purpose"
    | "remarks"
    | "recurringDays"
    | "repeatUntil"
    | "trialFirstName"
    | "trialLastName"
    | "trialEmail"
    | "trialPhone"
    | "voucherNumber",
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

function formatEeeDdMmm(value: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-NZ", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    timeZone,
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

function minutesToHHmm(minutes: number) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

function addMinutesToHHmm(timeHHmm: string, minutesToAdd: number) {
  const start = parseTimeToMinutes(timeHHmm)
  if (start === null) return timeHHmm
  const maxEnd = 23 * 60 + 30
  const end = Math.min(start + minutesToAdd, maxEnd)
  return minutesToHHmm(end)
}

function getRosterMaxEndMinutes(
  startTimeHHmm: string,
  instructorId: string | null,
  rosterWindows: Map<string, InstructorRosterWindow[]> | undefined
): number | null {
  if (!instructorId || !rosterWindows) return null
  const windows = rosterWindows.get(instructorId)
  if (!windows || windows.length === 0) return null
  const startMin = parseTimeToMinutes(startTimeHHmm)
  if (startMin === null) return null
  const containingWindow = windows.find((w) => startMin >= w.startMin && startMin < w.endMin)
  if (!containingWindow) return null
  return containingWindow.endMin
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
    endDate: date,
    startTime: draft.startTimeHHmm,
    endTime: addMinutesToHHmm(draft.startTimeHHmm, 120),
    aircraftId: draft.preselectedAircraftId ?? null,
    flightTypeId: null,
    instructorId: draft.preselectedInstructorId ?? null,
    memberId: isStaff ? null : currentUserId,
    bookingType: "flight",
    lessonId: null,
    purpose: "",
    remarks: "",
    isRecurring: false,
    recurringDays: [],
    repeatUntil: null,
    trialFirstName: "",
    trialLastName: "",
    trialEmail: "",
    trialPhone: "",
    voucherNumber: "",
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
  instructorRosterWindows,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  draft: SchedulerBookingDraft | null
  timeZone: string
  isStaff: boolean
  currentUserId: string | null
  onCreated: () => void
  instructorRosterWindows?: Map<string, InstructorRosterWindow[]>
}) {
  const isMemberOrStudent = !isStaff
  const defaultDurationMinutes = 120

  const [bookingMode, setBookingMode] = React.useState<"regular" | "trial" | "maintenance">("regular")
  const [form, setForm] = React.useState<FormState | null>(null)
  const [errors, setErrors] = React.useState<ErrorState>({})
  const [moreOptionsOpen, setMoreOptionsOpen] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)

  const [options, setOptions] = React.useState<BookingOptionsResponse["options"] | null>(null)
  const [optionsLoading, setOptionsLoading] = React.useState(false)
  const [optionsError, setOptionsError] = React.useState<string | null>(null)

  const [unavailableAircraftIds, setUnavailableAircraftIds] = React.useState<string[]>([])
  const [unavailableInstructorIds, setUnavailableInstructorIds] = React.useState<string[]>([])
  const [overlapsFetching, setOverlapsFetching] = React.useState(false)
  const [overlapsError, setOverlapsError] = React.useState<string | null>(null)

  const [occurrenceConflicts, setOccurrenceConflicts] = React.useState<Record<string, { aircraft: boolean; instructor: boolean }>>({})
  const [checkingOccurrences, setCheckingOccurrences] = React.useState(false)

  const [memberEnrollment, setMemberEnrollment] = React.useState<MemberTrainingPeekResponse["enrollment"] | null>(null)

  React.useEffect(() => {
    if (!open || !draft) return
    setForm(buildInitialState({ draft, isStaff, currentUserId }))
    setBookingMode("regular")
    setErrors({})
    setMoreOptionsOpen(false)
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
  const members = React.useMemo(() => options?.members ?? [], [options?.members])

  React.useEffect(() => {
    if (!open || !memberId) {
      setMemberEnrollment(null)
      return
    }
    const controller = new AbortController()
    void fetch(`/api/members/${memberId}/training/peek`, {
      cache: "no-store",
      headers: { "cache-control": "no-store" },
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) return
        const data = (await res.json()) as MemberTrainingPeekResponse
        if (!controller.signal.aborted) setMemberEnrollment(data.enrollment ?? null)
      })
      .catch(() => {})
    return () => controller.abort()
  }, [open, memberId])

  const selectedMember = React.useMemo<UserResult | null>(() => {
    if (!memberId) return null
    return members.find((member) => member.id === memberId) ?? null
  }, [memberId, members])

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

  const sameDay = React.useMemo(() => {
    if (!form?.date || !form?.endDate) return true
    return toYyyyMmDd(form.date) === toYyyyMmDd(form.endDate)
  }, [form?.date, form?.endDate])

  React.useEffect(() => {
    if (!open || !form?.startTime) return
    setForm((prev) => {
      if (!prev) return prev
      if (toYyyyMmDd(prev.date) !== toYyyyMmDd(prev.endDate)) return prev
      let newEndTime = addMinutesToHHmm(prev.startTime, defaultDurationMinutes)

      const maxEnd = getRosterMaxEndMinutes(prev.startTime, prev.instructorId, instructorRosterWindows)
      if (maxEnd !== null) {
        const endMin = parseTimeToMinutes(newEndTime)
        if (endMin !== null && endMin > maxEnd) {
          newEndTime = minutesToHHmm(maxEnd)
        }
      }

      return { ...prev, endTime: newEndTime }
    })
  }, [open, form?.startTime, instructorRosterWindows])

  React.useEffect(() => {
    if (!open) return
    setForm((prev) => {
      if (!prev) return prev
      if (toYyyyMmDd(prev.endDate) < toYyyyMmDd(prev.date)) {
        return { ...prev, endDate: prev.date }
      }
      return prev
    })
  }, [open, form?.date])

  React.useEffect(() => {
    if (!open || !shouldHideInstructor || !form?.instructorId) return
    setForm((prev) => (prev ? { ...prev, instructorId: null } : prev))
  }, [open, shouldHideInstructor, form?.instructorId])

	  React.useEffect(() => {
	    if (!open || !form?.instructorId || !form.startTime || !form.endTime || !instructorRosterWindows) return
	    if (!sameDay) return
	    const maxEnd = getRosterMaxEndMinutes(form.startTime, form.instructorId, instructorRosterWindows)
	    if (maxEnd === null) return
	    const endMin = parseTimeToMinutes(form.endTime)
	    if (endMin === null || endMin <= maxEnd) return
	    setForm((prev) => (prev ? { ...prev, endTime: minutesToHHmm(maxEnd) } : prev))
	  }, [open, sameDay, form?.instructorId, form?.startTime, form?.endTime, instructorRosterWindows])

  const filteredFlightTypes = React.useMemo(() => {
    const all = options?.flightTypes ?? []
    if (bookingMode === "trial") return all.filter((ft) => ft.instruction_type === "trial")
    return all.filter((ft) => ft.instruction_type !== "trial")
  }, [bookingMode, options?.flightTypes])

  React.useEffect(() => {
    if (!open || bookingMode !== "trial") return
    setForm((prev) => {
      if (!prev) return prev
      const updates: Partial<FormState> = { bookingType: "flight" }
      if (!prev.purpose.trim()) updates.purpose = "Trial Flight"
      const trialTypes = (options?.flightTypes ?? []).filter((ft) => ft.instruction_type === "trial")
      if (trialTypes.length === 1 && prev.flightTypeId !== trialTypes[0].id) {
        updates.flightTypeId = trialTypes[0].id
      }
      return { ...prev, ...updates }
    })
  }, [open, bookingMode, options?.flightTypes])

  React.useEffect(() => {
    if (!open || !form?.flightTypeId) return
    const exists = filteredFlightTypes.some((ft) => ft.id === form.flightTypeId)
    if (exists) return
    setForm((prev) => (prev ? { ...prev, flightTypeId: null } : prev))
  }, [open, form?.flightTypeId, filteredFlightTypes])

  React.useEffect(() => {
    if (!open || bookingMode !== "maintenance") return
    setForm((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        bookingType: "maintenance",
        memberId: null,
        instructorId: null,
        flightTypeId: null,
        lessonId: null,
        isRecurring: false,
        recurringDays: [],
        repeatUntil: null,
      }
    })
  }, [open, bookingMode])

  const isValidTimeRange = React.useMemo(() => {
    if (!form?.date || !form?.endDate || !form?.startTime || !form?.endTime) return false
    const startDateStr = toYyyyMmDd(form.date)
    const endDateStr = toYyyyMmDd(form.endDate)
    if (endDateStr > startDateStr) return true
    if (endDateStr < startDateStr) return false
    const start = parseTimeToMinutes(form.startTime)
    const end = parseTimeToMinutes(form.endTime)
    if (start === null || end === null) return false
    return end > start
  }, [form?.date, form?.endDate, form?.startTime, form?.endTime])

  const durationLabel = React.useMemo(() => {
    if (!form?.date || !form?.endDate || !form?.startTime || !form?.endTime) return null
    const start = parseTimeToMinutes(form.startTime)
    const end = parseTimeToMinutes(form.endTime)
    if (start === null || end === null) return null
    const startDateStr = toYyyyMmDd(form.date)
    const endDateStr = toYyyyMmDd(form.endDate)
    let diffMinutes: number
    if (startDateStr === endDateStr) {
      if (end <= start) return null
      diffMinutes = end - start
    } else if (endDateStr > startDateStr) {
      const d0 = new Date(form.date.getFullYear(), form.date.getMonth(), form.date.getDate())
      const d1 = new Date(form.endDate.getFullYear(), form.endDate.getMonth(), form.endDate.getDate())
      const daysDiff = Math.round((d1.getTime() - d0.getTime()) / 86400000)
      diffMinutes = daysDiff * 1440 + end - start
    } else {
      return null
    }
    if (diffMinutes <= 0) return null
    const h = Math.floor(diffMinutes / 60)
    const m = diffMinutes % 60
    if (h === 0) return `${m}m`
    if (m === 0) return `${h}h`
    return `${h}h ${String(m).padStart(2, "0")}m`
  }, [form?.date, form?.endDate, form?.startTime, form?.endTime])

  const rosterMaxEndMinutes = React.useMemo(
    () => getRosterMaxEndMinutes(form?.startTime ?? "", form?.instructorId ?? null, instructorRosterWindows),
    [form?.startTime, form?.instructorId, instructorRosterWindows]
  )

  const filteredEndTimeOptions = React.useMemo(() => {
    if (!sameDay || rosterMaxEndMinutes === null || !form?.startTime) return TIME_OPTIONS
    const startMin = parseTimeToMinutes(form.startTime)
    if (startMin === null) return TIME_OPTIONS
    return TIME_OPTIONS.filter((time) => {
      const timeMin = parseTimeToMinutes(time)
      if (timeMin === null) return false
      return timeMin > startMin && timeMin <= rosterMaxEndMinutes
    })
  }, [sameDay, rosterMaxEndMinutes, form?.startTime])

  const computedRange = React.useMemo(() => {
    if (!form?.date || !form?.endDate || !form.startTime || !form.endTime || !isValidTimeRange) return null
    return {
      startIso: combineSchoolDateAndTimeToIso({ date: form.date, timeHHmm: form.startTime, timeZone }),
      endIso: combineSchoolDateAndTimeToIso({ date: form.endDate, timeHHmm: form.endTime, timeZone }),
    }
  }, [form?.date, form?.endDate, form?.startTime, form?.endTime, isValidTimeRange, timeZone])

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
    let filtered = all

    if (instructorRosterWindows) {
      filtered = filtered.filter((i) => {
        const windows = instructorRosterWindows.get(i.id)
        return windows && windows.length > 0
      })
    }

    if (isValidTimeRange) {
      filtered = filtered.filter((i) => !unavailableInstructorSet.has(i.id))
    }

    return filtered
  }, [options?.instructors, isValidTimeRange, unavailableInstructorSet, instructorRosterWindows])

  const enrollmentAircraftTypeId = memberEnrollment?.aircraft_type?.id ?? null
  const enrollmentAircraftTypeName = memberEnrollment?.aircraft_type?.name ?? null
  const enrollmentPrimaryInstructorId = memberEnrollment?.primary_instructor?.id ?? null

  const suggestedAircraft = React.useMemo(() => {
    if (!enrollmentAircraftTypeId) return []
    return availableAircraft.filter((a) => a.aircraft_type_id === enrollmentAircraftTypeId)
  }, [availableAircraft, enrollmentAircraftTypeId])

  const otherAircraft = React.useMemo(() => {
    if (!enrollmentAircraftTypeId) return availableAircraft
    return availableAircraft.filter((a) => a.aircraft_type_id !== enrollmentAircraftTypeId)
  }, [availableAircraft, enrollmentAircraftTypeId])

  const primaryInstructor = React.useMemo(() => {
    if (!enrollmentPrimaryInstructorId) return null
    return availableInstructors.find((i) => i.id === enrollmentPrimaryInstructorId) ?? null
  }, [availableInstructors, enrollmentPrimaryInstructorId])

  const otherInstructors = React.useMemo(() => {
    if (!enrollmentPrimaryInstructorId) return availableInstructors
    return availableInstructors.filter((i) => i.id !== enrollmentPrimaryInstructorId)
  }, [availableInstructors, enrollmentPrimaryInstructorId])

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

  const advancedBookingType = form?.bookingType ?? null
  const advancedDate = form?.date ?? null
  const advancedEndDate = form?.endDate ?? null
  const advancedIsRecurring = form?.isRecurring ?? false
  const advancedRemarks = form?.remarks ?? ""

  React.useEffect(() => {
    if (!open || !advancedDate || !advancedEndDate || !advancedBookingType) return
    const endDateIsDifferent = toYyyyMmDd(advancedEndDate) !== toYyyyMmDd(advancedDate)
    const hasAdvancedValues =
      advancedIsRecurring ||
      Boolean(advancedRemarks.trim()) ||
      endDateIsDifferent

    if (hasAdvancedValues) {
      setMoreOptionsOpen(true)
    }
  }, [
    open,
    advancedBookingType,
    advancedDate,
    advancedEndDate,
    advancedIsRecurring,
    advancedRemarks,
  ])

  const handleBookingTypeChange = React.useCallback(
    (value: string) => {
      const nextType = value as BookingType
      updateForm("bookingType", nextType)
      if (nextType !== "flight") {
        updateForm("flightTypeId", null)
      }
      if (nextType === "groundwork" || nextType === "other") {
        updateForm("aircraftId", null)
      }
    },
    [updateForm]
  )

  const validate = React.useCallback(
    (values: FormState, mode: "regular" | "trial" | "maintenance") => {
      const nextErrors: ErrorState = {}

      const start = parseTimeToMinutes(values.startTime)
      const end = parseTimeToMinutes(values.endTime)
      if (start === null) nextErrors.startTime = "Start time is required"
      if (end === null) nextErrors.endTime = "End time is required"

      const startDateStr = toYyyyMmDd(values.date)
      const endDateStr = toYyyyMmDd(values.endDate)
      if (endDateStr < startDateStr) {
        nextErrors.endTime = "End date must be on or after start date"
      } else if (endDateStr === startDateStr && start !== null && end !== null && end <= start) {
        nextErrors.endTime = "End time must be after start time"
      }

      const isSameDay = startDateStr === endDateStr
      if (!nextErrors.endTime && isSameDay && values.instructorId && start !== null && end !== null && instructorRosterWindows) {
        const maxEnd = getRosterMaxEndMinutes(values.startTime, values.instructorId, instructorRosterWindows)
        if (maxEnd !== null && end > maxEnd) {
          nextErrors.endTime = `Instructor is only available until ${minutesToHHmm(maxEnd)}`
        }
      }

      if (!values.purpose.trim()) {
        nextErrors.purpose = "Description is required"
      }

      if ((values.bookingType === "flight" || values.bookingType === "maintenance") && !values.aircraftId) {
        nextErrors.aircraftId = "Aircraft is required for flight and maintenance bookings"
      }

      if (mode === "trial") {
        if (!values.trialFirstName.trim()) nextErrors.trialFirstName = "First name is required"
        if (!values.trialLastName.trim()) nextErrors.trialLastName = "Last name is required"
        if (!values.trialEmail.trim()) {
          nextErrors.trialEmail = "Email is required"
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.trialEmail.trim())) {
          nextErrors.trialEmail = "Please enter a valid email"
        }
      } else if (mode !== "maintenance") {
        if (isStaff && !values.memberId) {
          nextErrors.memberId = "Member is required"
        }
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
    [isStaff, instructorRosterWindows]
  )

  const submit = React.useCallback(
    async (status: "unconfirmed" | "confirmed") => {
      if (!form) return

      const nextErrors = validate(form, bookingMode)
      setErrors(nextErrors)
      if (Object.keys(nextErrors).length > 0) {
        toast.error("Please fix the highlighted fields.")
        return
      }

      setSubmitting(true)
      try {
        if (bookingMode === "trial") {
          const startIso = combineSchoolDateAndTimeToIso({
            date: form.date,
            timeHHmm: form.startTime,
            timeZone,
          })
          const endIso = combineSchoolDateAndTimeToIso({
            date: form.endDate,
            timeHHmm: form.endTime,
            timeZone,
          })

          const response = await fetch("/api/bookings/trial", {
            method: "POST",
            headers: { "Content-Type": "application/json", "cache-control": "no-store" },
            body: JSON.stringify({
              guest_first_name: form.trialFirstName.trim(),
              guest_last_name: form.trialLastName.trim(),
              guest_email: form.trialEmail.trim(),
              guest_phone: form.trialPhone.trim() || undefined,
              voucher_number: form.voucherNumber.trim() || undefined,
              start_time: startIso,
              end_time: endIso,
              aircraft_id: form.aircraftId,
              instructor_id: shouldHideInstructor ? null : form.instructorId,
              flight_type_id: form.flightTypeId,
              purpose: form.purpose.trim(),
              remarks: form.remarks.trim() || null,
              status,
            }),
          })

          if (!response.ok) {
            const payload = (await response.json().catch(() => ({}))) as { error?: string }
            throw new Error(payload.error || "Failed to create trial flight booking")
          }

          toast.success("Trial flight booking created")
          onOpenChange(false)
          onCreated()
          return
        }

        const commonPayload = {
          aircraft_id: form.aircraftId,
          booking_type: form.bookingType,
          purpose: form.purpose.trim(),
          remarks: form.remarks.trim() || null,
          instructor_id: shouldHideInstructor ? null : form.instructorId,
          flight_type_id: isMemberOrStudent ? null : form.flightTypeId,
          lesson_id: isMemberOrStudent ? null : form.lessonId,
          user_id: isStaff ? form.memberId : currentUserId,
          status,
        }

        if (form.isRecurring && occurrences.length > 0) {
          if (hasConflicts) {
            toast.message("Some recurring occurrences have conflicts and will be skipped.")
          }

          const response = await fetch("/api/bookings/recurring", {
            method: "POST",
            headers: { "Content-Type": "application/json", "cache-control": "no-store" },
            body: JSON.stringify({
              ...commonPayload,
              occurrences: occurrences.map((occ) => ({ start_time: occ.startIso, end_time: occ.endIso })),
            }),
          })

          const payload = (await response.json().catch(() => ({}))) as {
            error?: string
            requestedCount?: number
            createdCount?: number
            failedCount?: number
            failed?: Array<{ start_time: string; end_time: string; status: number; error: string }>
          }

          const createdCount = payload.createdCount ?? 0
          const failedCount = payload.failedCount ?? 0

          if (!response.ok || createdCount === 0) {
            const firstFailure = payload.failed?.[0]?.error
            throw new Error(payload.error || firstFailure || "Failed to create recurring bookings")
          }

          if (failedCount > 0) {
            toast.success(`${createdCount} bookings created, ${failedCount} skipped`)
          } else {
            toast.success(`${createdCount} bookings created`)
          }

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
          date: form.endDate,
          timeHHmm: form.endTime,
          timeZone,
        })

        const response = await fetch("/api/bookings", {
          method: "POST",
          headers: { "Content-Type": "application/json", "cache-control": "no-store" },
          body: JSON.stringify({ ...commonPayload, start_time: startIso, end_time: endIso }),
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
      bookingMode,
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
          "[&_button]:cursor-pointer [&_button:disabled]:cursor-not-allowed",
          "w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] sm:w-full sm:max-w-[720px]",
          "top-4 sm:top-1/2 translate-y-0 sm:-translate-y-1/2",
          "h-[calc(100vh-2rem)] supports-[height:100dvh]:h-[calc(100dvh-2rem)] sm:h-auto sm:max-h-[calc(100vh-4rem)] sm:max-h-[calc(100dvh-4rem)]"
        )}
      >
        <div className="flex flex-1 min-h-0 flex-col overflow-hidden bg-white">
          <DialogHeader className="px-6 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-4 text-left sm:pt-6 shrink-0">
            <div className="flex items-center gap-4">
              <div className={cn(
                "flex h-10 w-10 items-center justify-center rounded-full",
                bookingMode === "trial" ? "bg-violet-50 text-violet-600" : bookingMode === "maintenance" ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-600"
              )}>
                {bookingMode === "trial" ? <Plane className="h-5 w-5" /> : bookingMode === "maintenance" ? <Wrench className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
              </div>
              <div>
                <DialogTitle className="text-xl font-bold tracking-tight text-slate-900">
                  {bookingMode === "trial" ? "Trial Flight Booking" : bookingMode === "maintenance" ? "Maintenance Booking" : "New Booking"}
                </DialogTitle>
                <DialogDescription className="mt-0.5 text-sm text-slate-500">
                  {bookingMode === "trial"
                    ? "Create a trial flight for a new guest. Guest details and booking will be saved together."
                    : bookingMode === "maintenance"
                      ? "Block out an aircraft for maintenance. Only aircraft and time details are required."
                      : <>Enter details for the new booking. Required fields are marked with <span className="text-destructive">*</span>.</>
                  }
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
                      <span className="text-[13px] font-semibold text-slate-900">Booking Mode</span>
                    </div>
                    <Tabs value={bookingMode} onValueChange={(value) => {
                      const newMode = value as "regular" | "trial" | "maintenance"
                      if (newMode === "regular" && bookingMode === "maintenance") {
                        setForm((prev) => prev ? { ...prev, bookingType: "flight" } : prev)
                      }
                      setBookingMode(newMode)
                      setErrors({})
                    }} className="w-full">
                      <TabsList className="grid h-10 w-full grid-cols-3 gap-1 overflow-hidden rounded-xl bg-slate-50 p-1 ring-1 ring-slate-200">
                        <TabsTrigger
                          value="regular"
                          className="h-8 min-w-0 gap-1.5 rounded-lg px-1.5 text-[11px] font-semibold text-slate-600 transition-colors sm:gap-2 sm:px-3 sm:text-xs data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-slate-200 hover:bg-white hover:text-slate-900"
                        >
                          <User className="h-3.5 w-3.5" />
                          <span className="truncate">Regular</span>
                        </TabsTrigger>
                        <TabsTrigger
                          value="trial"
                          className="h-8 min-w-0 gap-1.5 rounded-lg px-1.5 text-[11px] font-semibold text-slate-600 transition-colors sm:gap-2 sm:px-3 sm:text-xs data-[state=active]:bg-white data-[state=active]:text-violet-700 data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-violet-200 hover:bg-white hover:text-violet-700"
                        >
                          <Plane className="h-3.5 w-3.5" />
                          <span className="truncate">Trial</span>
                        </TabsTrigger>
                        <TabsTrigger
                          value="maintenance"
                          className="h-8 min-w-0 gap-1.5 rounded-lg px-1.5 text-[11px] font-semibold text-slate-600 transition-colors sm:gap-2 sm:px-3 sm:text-xs data-[state=active]:bg-white data-[state=active]:text-amber-700 data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-amber-200 hover:bg-white hover:text-amber-700"
                        >
                          <Wrench className="h-3.5 w-3.5" />
                          <span className="truncate">Maint</span>
                        </TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </section>
                ) : null}

                {bookingMode === "trial" ? (
                  <section>
                    <div className="mb-4 flex items-center gap-2 border-b border-slate-100 pb-3">
                      <User className="h-4 w-4 text-slate-500" />
                      <span className="text-[13px] font-semibold text-slate-900">Guest Details</span>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                          FIRST NAME <span className="text-destructive">*</span>
                        </label>
                        <div className="relative">
                          <User className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                          <Input
                            placeholder="First name"
                            value={form.trialFirstName}
                            onChange={(e) => updateForm("trialFirstName", e.target.value)}
                            className="h-10 rounded-xl border-slate-300 bg-white pl-9 text-base font-medium shadow-none placeholder:text-slate-300 hover:bg-slate-50 focus:ring-0"
                          />
                        </div>
                        {errors.trialFirstName ? <p className="mt-1 text-[10px] text-destructive">{errors.trialFirstName}</p> : null}
                      </div>
                      <div>
                        <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                          LAST NAME <span className="text-destructive">*</span>
                        </label>
                        <div className="relative">
                          <User className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                          <Input
                            placeholder="Last name"
                            value={form.trialLastName}
                            onChange={(e) => updateForm("trialLastName", e.target.value)}
                            className="h-10 rounded-xl border-slate-300 bg-white pl-9 text-base font-medium shadow-none placeholder:text-slate-300 hover:bg-slate-50 focus:ring-0"
                          />
                        </div>
                        {errors.trialLastName ? <p className="mt-1 text-[10px] text-destructive">{errors.trialLastName}</p> : null}
                      </div>
                      <div>
                        <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                          EMAIL <span className="text-destructive">*</span>
                        </label>
                        <div className="relative">
                          <Mail className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                          <Input
                            type="email"
                            placeholder="guest@example.com"
                            value={form.trialEmail}
                            onChange={(e) => updateForm("trialEmail", e.target.value)}
                            className="h-10 rounded-xl border-slate-300 bg-white pl-9 text-base font-medium shadow-none placeholder:text-slate-300 hover:bg-slate-50 focus:ring-0"
                          />
                        </div>
                        {errors.trialEmail ? <p className="mt-1 text-[10px] text-destructive">{errors.trialEmail}</p> : null}
                      </div>
                      <div>
                        <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                          PHONE
                        </label>
                        <div className="relative">
                          <Phone className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                          <Input
                            type="tel"
                            placeholder="Phone number (optional)"
                            value={form.trialPhone}
                            onChange={(e) => updateForm("trialPhone", e.target.value)}
                            className="h-10 rounded-xl border-slate-300 bg-white pl-9 text-base font-medium shadow-none placeholder:text-slate-300 hover:bg-slate-50 focus:ring-0"
                          />
                        </div>
                        {errors.trialPhone ? <p className="mt-1 text-[10px] text-destructive">{errors.trialPhone}</p> : null}
                      </div>
                      <div>
                        <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                          VOUCHER NUMBER
                        </label>
                        <div className="relative">
                          <Ticket className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                          <Input
                            placeholder="e.g. TF-2026-001"
                            value={form.voucherNumber}
                            onChange={(e) => updateForm("voucherNumber", e.target.value)}
                            className="h-10 rounded-xl border-slate-300 bg-white pl-9 text-base font-medium shadow-none placeholder:text-slate-300 hover:bg-slate-50 focus:ring-0"
                          />
                        </div>
                        {errors.voucherNumber ? <p className="mt-1 text-[10px] text-destructive">{errors.voucherNumber}</p> : null}
                      </div>
                    </div>
                  </section>
                ) : null}

                {optionsError ? (
                  <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-2.5 text-xs font-medium text-destructive">
                    Could not load booking options. Please refresh and try again.
                  </div>
                ) : null}
                {overlapsError ? (
                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-2.5 text-xs font-medium text-amber-700">
                    Could not verify aircraft/instructor availability. You can still try to save; the database will prevent invalid overlaps.
                  </div>
                ) : null}

                <section>
                  <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-slate-500" />
                      <span className="text-[13px] font-semibold text-slate-900">Date & Time</span>
                    </div>
                    {durationLabel ? (
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold tabular-nums text-slate-600">
                        {durationLabel}
                      </span>
                    ) : null}
                  </div>

                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    <div className={cn(form.isRecurring && "col-span-2 sm:col-span-1")}>
                      <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        START DATE <span className="text-destructive">*</span>
                      </label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            className="h-10 w-full justify-start rounded-xl border-slate-300 bg-white px-3 text-sm font-medium shadow-none hover:bg-slate-50 focus:ring-0"
                          >
                            <CalendarIcon className="mr-2 h-3.5 w-3.5 shrink-0 text-slate-400" />
                            <span className="truncate">{formatDate(form.date, timeZone)}</span>
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto rounded-2xl border-slate-200 p-0 shadow-2xl" align="start">
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
                      {errors.date ? <p className="mt-1 text-[11px] text-destructive">{errors.date}</p> : null}
                    </div>

                    <div>
                      <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        START TIME <span className="text-destructive">*</span>
                      </label>
                      <Select value={form.startTime} onValueChange={(value) => updateForm("startTime", value)}>
                        <SelectTrigger className="h-10 w-full rounded-xl border-slate-300 bg-white px-3 text-sm font-medium shadow-none hover:bg-slate-50 focus:ring-0">
                          <SelectValue placeholder="Start" />
                        </SelectTrigger>
                        <SelectContent position="popper" className="w-[var(--radix-select-trigger-width)] rounded-xl border-slate-200 shadow-xl">
                          {TIME_OPTIONS.map((time) => (
                            <SelectItem key={time} value={time} className="rounded-lg py-2 text-xs">
                              {time}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {errors.startTime ? <p className="mt-1 text-[11px] text-destructive">{errors.startTime}</p> : null}
                    </div>

                    {!form.isRecurring ? (
                      <div>
                        <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                          END DATE <span className="text-slate-400">(optional)</span>
                        </label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              type="button"
                              variant="outline"
                              className="h-10 w-full justify-start rounded-xl border-slate-300 bg-white px-3 text-sm font-medium shadow-none hover:bg-slate-50 focus:ring-0"
                            >
                              <CalendarIcon className="mr-2 h-3.5 w-3.5 shrink-0 text-slate-400" />
                              <span className="truncate">{formatDate(form.endDate, timeZone)}</span>
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto rounded-2xl border-slate-200 p-0 shadow-2xl" align="start">
                            <Calendar
                              mode="single"
                              selected={form.endDate}
                              onSelect={(value) => {
                                if (!value) return
                                const selected = new Date(value.getFullYear(), value.getMonth(), value.getDate(), 12, 0, 0, 0)
                                const startDay = new Date(form.date.getFullYear(), form.date.getMonth(), form.date.getDate(), 12, 0, 0, 0)
                                if (selected >= startDay) {
                                  updateForm("endDate", value)
                                }
                              }}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                    ) : null}

                    <div>
                      <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        END TIME <span className="text-destructive">*</span>
                        {sameDay && rosterMaxEndMinutes !== null ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex cursor-help text-slate-400 hover:text-slate-500">
                                <HelpCircle className="h-3 w-3" />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="font-normal normal-case">
                              Instructor available until {minutesToHHmm(rosterMaxEndMinutes)}
                            </TooltipContent>
                          </Tooltip>
                        ) : null}
                      </label>
                      <Select value={form.endTime} onValueChange={(value) => updateForm("endTime", value)}>
                        <SelectTrigger className="h-10 w-full rounded-xl border-slate-300 bg-white px-3 text-sm font-medium shadow-none hover:bg-slate-50 focus:ring-0">
                          <SelectValue placeholder="End" />
                        </SelectTrigger>
                        <SelectContent position="popper" className="w-[var(--radix-select-trigger-width)] rounded-xl border-slate-200 shadow-xl">
                          {filteredEndTimeOptions.map((time) => (
                            <SelectItem key={time} value={time} className="rounded-lg py-2 text-xs">
                              {time}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {errors.endTime ? <p className="mt-1 text-[11px] text-destructive">{errors.endTime}</p> : null}
                    </div>
                  </div>
                </section>

                {bookingMode === "maintenance" ? (
                  <section>
                    <div className="mb-4 flex items-center gap-2 border-b border-slate-100 pb-3">
                      <Wrench className="h-4 w-4 text-slate-500" />
                      <span className="text-[13px] font-semibold text-slate-900">Details</span>
                    </div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                          AIRCRAFT <span className="text-destructive">*</span>
                        </label>
                        <Select
                          disabled={optionsLoading || isCheckingAvailability}
                          value={form.aircraftId || "none"}
                          onValueChange={(value) => updateForm("aircraftId", value === "none" ? null : value)}
                        >
                          <SelectTrigger className="h-10 w-full rounded-xl border-slate-300 bg-white px-3 text-sm font-medium shadow-none hover:bg-slate-50 focus:ring-0">
                            <SelectValue
                              placeholder={
                                optionsLoading
                                  ? "Loading..."
                                  : isCheckingAvailability
                                    ? "Checking availability..."
                                    : "Select aircraft"
                              }
                            />
                          </SelectTrigger>
                          <SelectContent position="popper" className="w-[var(--radix-select-trigger-width)] rounded-xl border-slate-200 shadow-xl">
                            <SelectItem value="none" className="rounded-lg py-2 text-xs">
                              Select aircraft
                            </SelectItem>
                            {suggestedAircraft.length > 0 ? (
                              <>
                                <SelectGroup>
                                  <SelectLabel className="px-2 pb-0.5 pt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                                    Training type · {enrollmentAircraftTypeName}
                                  </SelectLabel>
                                  {suggestedAircraft.map((aircraft) => (
                                    <SelectItem key={aircraft.id} value={aircraft.id} className="rounded-lg py-2 text-xs">
                                      {aircraft.registration} ({aircraft.type})
                                    </SelectItem>
                                  ))}
                                </SelectGroup>
                                {otherAircraft.length > 0 && (
                                  <>
                                    <SelectSeparator />
                                    <SelectGroup>
                                      <SelectLabel className="px-2 pb-0.5 pt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                                        Other aircraft
                                      </SelectLabel>
                                      {otherAircraft.map((aircraft) => (
                                        <SelectItem key={aircraft.id} value={aircraft.id} className="rounded-lg py-2 text-xs">
                                          {aircraft.registration} ({aircraft.type})
                                        </SelectItem>
                                      ))}
                                    </SelectGroup>
                                  </>
                                )}
                              </>
                            ) : (
                              availableAircraft.map((aircraft) => (
                                <SelectItem key={aircraft.id} value={aircraft.id} className="rounded-lg py-2 text-xs">
                                  {aircraft.registration} ({aircraft.type})
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                        {errors.aircraftId ? <p className="mt-1 text-[11px] text-destructive">{errors.aircraftId}</p> : null}
                      </div>
                      <div>
                        <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                          DESCRIPTION <span className="text-destructive">*</span>
                        </label>
                        <Input
                          placeholder="e.g. Annual inspection, oil change..."
                          value={form.purpose}
                          onChange={(event) => updateForm("purpose", event.target.value)}
                          className="h-10 w-full rounded-xl border-slate-300 bg-white px-3 text-sm font-medium shadow-none placeholder:text-slate-300 hover:bg-slate-50 focus:ring-0"
                        />
                        {errors.purpose ? <p className="mt-1 text-[11px] text-destructive">{errors.purpose}</p> : null}
                      </div>
                    </div>
                  </section>
                ) : null}

                {bookingMode !== "maintenance" ? (
                <section>
                  <div className="mb-4 flex items-center gap-2 border-b border-slate-100 pb-3">
                    <Plane className="h-4 w-4 text-slate-500" />
                    <span className="text-[13px] font-semibold text-slate-900">Booking Details</span>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {bookingMode === "regular" ? (
                      <div>
                        <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                          MEMBER {isStaff ? <span className="text-destructive">*</span> : null}
                        </label>
                        {isStaff ? (
                          <>
                            <div className="flex items-center gap-1.5">
                              <div className="min-w-0 flex-1">
                                <MemberSelect
                                  members={members}
                                  value={selectedMember}
                                  onSelect={(member) => updateForm("memberId", member?.id ?? null)}
                                  disabled={optionsLoading || submitting}
                                  buttonClassName="rounded-xl border-slate-300 bg-white px-3 text-sm font-medium shadow-none hover:bg-slate-50 focus:ring-0"
                                  contentClassName="rounded-xl border-slate-200 shadow-xl"
                                  inputClassName="rounded-lg border-slate-200 bg-white text-xs font-medium placeholder:text-slate-300 focus:border-blue-500"
                                  listClassName="rounded-xl border-slate-200"
                                />
                              </div>
                              {form.memberId ? (
                                <MemberTrainingPeek memberId={form.memberId} timeZone={timeZone} variant="icon" />
                              ) : null}
                            </div>
                            {errors.memberId ? (
                              <p className="mt-1 text-[11px] text-destructive">{errors.memberId}</p>
                            ) : null}
                          </>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <div className="flex h-10 flex-1 items-center rounded-xl border border-slate-200 bg-slate-50/50 px-3 text-sm font-medium text-slate-600">
                              <User className="mr-2 h-3.5 w-3.5 shrink-0 text-slate-400" />
                              <span className="truncate">
                                {optionsLoading ? "Loading..." : options?.members?.[0] ? formatName(options.members[0]) : "your account"}
                              </span>
                            </div>
                            {form.memberId ? (
                              <MemberTrainingPeek memberId={form.memberId} timeZone={timeZone} variant="icon" />
                            ) : null}
                          </div>
                        )}
                      </div>
                    ) : null}

                    <div>
                      <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        AIRCRAFT {(form.bookingType === "flight" || form.bookingType === "maintenance") ? <span className="text-destructive">*</span> : null}
                      </label>
                      <Select
                        disabled={optionsLoading || isCheckingAvailability}
                        value={form.aircraftId || "none"}
                        onValueChange={(value) => updateForm("aircraftId", value === "none" ? null : value)}
                      >
                        <SelectTrigger className="h-10 w-full rounded-xl border-slate-300 bg-white px-3 text-sm font-medium shadow-none hover:bg-slate-50 focus:ring-0">
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
                        </SelectTrigger>
                        <SelectContent position="popper" className="w-[var(--radix-select-trigger-width)] rounded-xl border-slate-200 shadow-xl">
                          <SelectItem value="none" className="rounded-lg py-2 text-xs">
                            {(form.bookingType === "flight" || form.bookingType === "maintenance") ? "Select aircraft" : "No aircraft"}
                          </SelectItem>
                          {suggestedAircraft.length > 0 ? (
                            <>
                              <SelectGroup>
                                <SelectLabel className="px-2 pb-0.5 pt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                                  Training type · {enrollmentAircraftTypeName}
                                </SelectLabel>
                                {suggestedAircraft.map((aircraft) => (
                                  <SelectItem key={aircraft.id} value={aircraft.id} className="rounded-lg py-2 text-xs">
                                    {aircraft.registration} ({aircraft.type})
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                              {otherAircraft.length > 0 && (
                                <>
                                  <SelectSeparator />
                                  <SelectGroup>
                                    <SelectLabel className="px-2 pb-0.5 pt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                                      Other aircraft
                                    </SelectLabel>
                                    {otherAircraft.map((aircraft) => (
                                      <SelectItem key={aircraft.id} value={aircraft.id} className="rounded-lg py-2 text-xs">
                                        {aircraft.registration} ({aircraft.type})
                                      </SelectItem>
                                    ))}
                                  </SelectGroup>
                                </>
                              )}
                            </>
                          ) : (
                            availableAircraft.map((aircraft) => (
                              <SelectItem key={aircraft.id} value={aircraft.id} className="rounded-lg py-2 text-xs">
                                {aircraft.registration} ({aircraft.type})
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      {errors.aircraftId ? <p className="mt-1 text-[11px] text-destructive">{errors.aircraftId}</p> : null}
                    </div>

                    {!shouldHideInstructor ? (
                      <div>
                        <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">INSTRUCTOR</label>
                        <Select
                          disabled={optionsLoading || isCheckingAvailability}
                          value={form.instructorId || "none"}
                          onValueChange={(value) => updateForm("instructorId", value === "none" ? null : value)}
                        >
                          <SelectTrigger className="h-10 w-full rounded-xl border-slate-300 bg-white px-3 text-sm font-medium shadow-none hover:bg-slate-50 focus:ring-0">
                            <SelectValue
                              placeholder={
                                optionsLoading
                                  ? "Loading..."
                                  : isCheckingAvailability
                                    ? "Checking availability..."
                                    : "No instructor"
                              }
                            />
                          </SelectTrigger>
                          <SelectContent position="popper" className="w-[var(--radix-select-trigger-width)] rounded-xl border-slate-200 shadow-xl">
                            <SelectItem value="none" className="rounded-lg py-2 text-xs">
                              No instructor
                            </SelectItem>
                            {primaryInstructor ? (
                              <>
                                <SelectGroup>
                                  <SelectLabel className="px-2 pb-0.5 pt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                                    Primary instructor
                                  </SelectLabel>
                                  <SelectItem key={primaryInstructor.id} value={primaryInstructor.id} className="rounded-lg py-2 text-xs">
                                    {formatName({
                                      first_name: primaryInstructor.user?.first_name ?? primaryInstructor.first_name,
                                      last_name: primaryInstructor.user?.last_name ?? primaryInstructor.last_name,
                                      email: primaryInstructor.user?.email ?? null,
                                    })}
                                  </SelectItem>
                                </SelectGroup>
                                {otherInstructors.length > 0 && (
                                  <>
                                    <SelectSeparator />
                                    {otherInstructors.map((instructor) => (
                                      <SelectItem key={instructor.id} value={instructor.id} className="rounded-lg py-2 text-xs">
                                        {formatName({
                                          first_name: instructor.user?.first_name ?? instructor.first_name,
                                          last_name: instructor.user?.last_name ?? instructor.last_name,
                                          email: instructor.user?.email ?? null,
                                        })}
                                      </SelectItem>
                                    ))}
                                  </>
                                )}
                              </>
                            ) : (
                              availableInstructors.map((instructor) => (
                                <SelectItem key={instructor.id} value={instructor.id} className="rounded-lg py-2 text-xs">
                                  {formatName({
                                    first_name: instructor.user?.first_name ?? instructor.first_name,
                                    last_name: instructor.user?.last_name ?? instructor.last_name,
                                    email: instructor.user?.email ?? null,
                                  })}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                        {errors.instructorId ? <p className="mt-1 text-[11px] text-destructive">{errors.instructorId}</p> : null}
                      </div>
                    ) : null}

                    {!isMemberOrStudent && form.bookingType === "flight" && bookingMode !== "trial" ? (
                      <div>
                        <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                          FLIGHT TYPE <span className="text-destructive">*</span>
                        </label>
                        <Select
                          disabled={optionsLoading}
                          value={form.flightTypeId || "none"}
                          onValueChange={(value) => updateForm("flightTypeId", value === "none" ? null : value)}
                        >
                          <SelectTrigger className="h-10 w-full rounded-xl border-slate-300 bg-white px-3 text-sm font-medium shadow-none hover:bg-slate-50 focus:ring-0">
                            <SelectValue
                              placeholder={
                                optionsLoading
                                  ? "Loading..."
                                  : "Select flight type"
                              }
                            />
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
                        {errors.flightTypeId ? <p className="mt-1 text-[11px] text-destructive">{errors.flightTypeId}</p> : null}
                      </div>
                    ) : null}

                    {bookingMode === "regular" ? (
                      <div>
                        <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                          BOOKING TYPE
                        </label>
                        <Select value={form.bookingType} onValueChange={handleBookingTypeChange}>
                          <SelectTrigger className="h-10 w-full rounded-xl border-slate-300 bg-white px-3 text-sm font-medium shadow-none hover:bg-slate-50 focus:ring-0">
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent position="popper" className="w-[var(--radix-select-trigger-width)] rounded-xl border-slate-200 shadow-xl">
                            {BOOKING_TYPE_OPTIONS.map((item) => (
                              <SelectItem key={item.value} value={item.value} className="rounded-lg py-2 text-xs">
                                {item.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : null}

                    {bookingMode === "regular" && isStaff ? (
                      <div>
                        <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                          LESSON
                        </label>
                        <LessonSearchDropdown
                          lessons={options?.lessons ?? []}
                          syllabi={options?.syllabi ?? []}
                          value={form.lessonId}
                          onSelect={(lessonId) => updateForm("lessonId", lessonId)}
                          disabled={optionsLoading}
                          placeholder={optionsLoading ? "Loading..." : "Select lesson"}
                          triggerClassName="h-10 w-full rounded-xl border-slate-300 bg-white px-3 text-sm font-medium shadow-none hover:bg-slate-50 focus:ring-0"
                        />
                      </div>
                    ) : null}
                  </div>
                </section>
                ) : null}

                {bookingMode !== "maintenance" ? (
                <section>
                  <div>
                    <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      DESCRIPTION <span className="text-destructive">*</span>
                    </label>
                    <Input
                      placeholder="e.g. Dual circuits..."
                      value={form.purpose}
                      onChange={(event) => updateForm("purpose", event.target.value)}
                      className="h-10 w-full rounded-xl border-slate-300 bg-white px-3 text-sm font-medium shadow-none placeholder:text-slate-300 hover:bg-slate-50 focus:ring-0"
                    />
                    {errors.purpose ? <p className="mt-1 text-[11px] text-destructive">{errors.purpose}</p> : null}
                  </div>
                </section>
                ) : null}

                {bookingMode !== "maintenance" ? (
                <section>
                  <div className="rounded-xl border border-slate-200 bg-white">
                    <Collapsible
                      open={moreOptionsOpen}
                      onOpenChange={setMoreOptionsOpen}
                    >
                      <CollapsibleTrigger asChild>
                        <button
                          type="button"
                          className={cn(
                            "flex w-full items-center justify-between gap-4 px-4 py-3 text-left shadow-none transition-colors hover:bg-slate-50",
                            "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-slate-900/10 focus-visible:ring-inset"
                          )}
                        >
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-slate-900">More options</div>
                            <div className="mt-0.5 text-[11px] font-medium text-slate-500">
                              Notes, remarks, and recurring options.
                            </div>
                          </div>
                          <ChevronDown
                            className={cn(
                              "h-4 w-4 shrink-0 text-slate-400 transition-transform",
                              moreOptionsOpen && "rotate-180"
                            )}
                          />
                        </button>
                      </CollapsibleTrigger>

                      <CollapsibleContent className="space-y-4 border-t border-slate-100 bg-slate-50/40 p-4">
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        {bookingMode === "trial" && !isMemberOrStudent && form.bookingType === "flight" ? (
                          <div className="w-full sm:col-span-1">
                            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                              FLIGHT TYPE <span className="text-destructive">*</span>
                            </label>
                            <Select
                              disabled={optionsLoading}
                              value={form.flightTypeId || "none"}
                              onValueChange={(value) => updateForm("flightTypeId", value === "none" ? null : value)}
                            >
                              <SelectTrigger className="h-10 w-full rounded-xl border-slate-300 bg-white px-3 text-sm font-medium shadow-none hover:bg-slate-50 focus:ring-0">
                                <SelectValue
                                  placeholder={
                                    optionsLoading
                                      ? "Loading..."
                                      : "Select flight type"
                                  }
                                />
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
                            {errors.flightTypeId ? <p className="mt-1 text-[11px] text-destructive">{errors.flightTypeId}</p> : null}
                          </div>
                        ) : null}

                      </div>

                      <div>
                        <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                          NOTES / REMARKS
                        </label>
                        <Textarea
                          rows={2}
                          placeholder="Internal notes or operational remarks..."
                          className="w-full rounded-xl border-slate-200 bg-white text-sm placeholder:text-slate-400 focus:ring-slate-900"
                          value={form.remarks}
                          onChange={(event) => updateForm("remarks", event.target.value)}
                        />
                      </div>

                      {bookingMode === "regular" ? (
                        <div className="rounded-xl border border-slate-200 bg-white p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <Label htmlFor="recurring" className="text-sm font-semibold text-slate-900">Recurring booking</Label>
                              <p className="mt-0.5 text-[11px] font-medium text-slate-500">
                                Repeat this booking automatically
                              </p>
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
                                  updateForm("endDate", form.date)
                                }
                              }}
                            />
                          </div>

                          {form.isRecurring ? (
                            <div className="mt-4 space-y-4 border-t border-slate-100 pt-4">
                              <div className="space-y-2">
                                <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Repeat on</Label>
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

                              <div className="flex items-center justify-between gap-4 rounded-xl bg-slate-50/60 p-3 ring-1 ring-slate-100">
                                <div className="space-y-0.5">
                                  <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Until date</Label>
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
                                        <span className="truncate">{form.repeatUntil ? formatDate(form.repeatUntil, timeZone) : "End date"}</span>
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

                              {form.isRecurring && occurrences.length > 0 ? (
                                <div className="space-y-3">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[11px] font-semibold text-slate-700">
                                      Occurrences ({occurrences.length})
                                    </span>
                                    {checkingOccurrences ? (
                                      <span className="animate-pulse text-[10px] text-slate-500">Checking availability...</span>
                                    ) : null}
                                  </div>

                                  {hasConflicts ? (
                                    <div className="space-y-3 rounded-xl border border-destructive/20 bg-destructive/5 p-4">
                                      <div className="flex items-center gap-2 text-destructive">
                                        <AlertCircle className="h-4 w-4" />
                                        <span className="text-xs font-bold">Conflicting Occurrences</span>
                                      </div>
                                      <p className="text-[10px] leading-relaxed text-destructive/80">
                                        Bookings will be skipped for the occurrences below. All other occurrences will still be created.
                                      </p>
                                      <div className="max-h-[160px] space-y-1 overflow-y-auto pr-2">
                                        {occurrences.map((occ) => {
                                          const conflict = occurrenceConflicts[occ.startIso]
                                          if (!conflict) return null
                                          return (
                                            <div key={occ.startIso} className="flex items-center justify-between rounded-lg bg-white/50 px-3 py-2 text-[10px] ring-1 ring-destructive/10">
                                              <span className="font-semibold text-slate-700">{formatEeeDdMmm(occ.date, timeZone)}</span>
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
                                </div>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      ) : null}

                      </CollapsibleContent>
                    </Collapsible>
                  </div>
                </section>
                ) : null}
              </div>
            </form>
          )}

          <div className="border-t border-slate-100 bg-white px-6 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pb-4 shrink-0">
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                disabled={submitting}
                className="h-11 rounded-xl px-5 text-sm font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              >
                Cancel
              </Button>
              <div className="flex flex-1 items-center justify-end gap-2">
                <Button
                  type="button"
                  disabled={submitting}
                  onClick={() => {
                    void submit("unconfirmed")
                  }}
                  className="h-11 rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 shadow-sm shadow-slate-200/60 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 hover:shadow-md hover:shadow-slate-300/40"
                >
                  {submitting ? "Saving..." : bookingMode === "trial" ? "Save Trial Flight" : bookingMode === "maintenance" ? "Save Maintenance" : "Save Booking"}
                </Button>
                {isStaff ? (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={submitting}
                    onClick={() => {
                      void submit("confirmed")
                    }}
                    className="h-11 rounded-xl bg-slate-900 px-6 text-sm font-semibold text-white shadow-lg shadow-slate-900/10 transition-shadow hover:bg-slate-900 hover:text-white hover:shadow-xl hover:shadow-slate-900/20"
                  >
                    Save as confirmed
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export type { SchedulerBookingDraft, InstructorRosterWindow }
