"use client"

import * as React from "react"
import {
  CalendarIcon,
  ChevronDown,
  Clock,
  HelpCircle,
  Plane,
  Plus,
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
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { LessonSearchDropdown } from "@/components/bookings/lesson-search-dropdown"
import { MemberTrainingPeek } from "@/components/bookings/member-training-peek"
import { NewBookingModeTabs } from "@/components/scheduler/new-booking-mode-tabs"
import { RecurringBookingSection } from "@/components/scheduler/recurring-booking-section"
import { TrialGuestDetailsSection } from "@/components/scheduler/trial-guest-details-section"
import { useBookingAvailability, type BookingOccurrence } from "@/hooks/use-booking-availability"
import {
  createBookingMutation,
  createRecurringBookingsMutation,
  createTrialBookingMutation,
} from "@/hooks/use-booking-query"
import { useBookingOptionsQuery } from "@/hooks/use-booking-options-query"
import { useMemberTrainingPeekQuery } from "@/hooks/use-member-training-peek-query"
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

  const {
    data: options,
    isLoading: optionsLoading,
    error: optionsErrorState,
  } = useBookingOptionsQuery(open)

  React.useEffect(() => {
    if (!open || !draft) return
    setForm(buildInitialState({ draft, isStaff, currentUserId }))
    setBookingMode("regular")
    setErrors({})
    setMoreOptionsOpen(false)
  }, [open, draft, isStaff, currentUserId])

  const memberId = form?.memberId ?? null
  const members = React.useMemo(() => options?.members ?? [], [options?.members])
  const { data: memberTrainingPeek } = useMemberTrainingPeekQuery(memberId, open)
  const memberEnrollment = memberTrainingPeek?.enrollment ?? null
  const optionsError = optionsErrorState instanceof Error ? optionsErrorState.message : null

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

  const occurrences = React.useMemo<BookingOccurrence[]>(() => {
    if (!form?.isRecurring || !form.repeatUntil || form.recurringDays.length === 0 || !isValidTimeRange) {
      return []
    }

    const list: BookingOccurrence[] = []
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
  const {
    unavailableAircraftIds,
    unavailableInstructorIds,
    overlapsFetching,
    overlapsError,
    occurrenceConflicts,
    checkingOccurrences,
    hasConflicts,
  } = useBookingAvailability({
    open,
    isValidTimeRange,
    startIso: computedRangeStartIso,
    endIso: computedRangeEndIso,
    recurringEnabled: Boolean(form?.isRecurring),
    occurrences,
    aircraftId: form?.aircraftId ?? null,
    instructorId: form?.instructorId ?? null,
  })

  const isCheckingAvailability = open && isValidTimeRange && overlapsFetching

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

          await createTrialBookingMutation({
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
          })

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

          const payload = await createRecurringBookingsMutation({
            ...commonPayload,
            occurrences: occurrences.map((occ) => ({ start_time: occ.startIso, end_time: occ.endIso })),
          })

          const createdCount = payload.createdCount ?? 0
          const failedCount = payload.failedCount ?? 0

          if (createdCount === 0) {
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

        await createBookingMutation({ ...commonPayload, start_time: startIso, end_time: endIso })

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
                  <NewBookingModeTabs
                    bookingMode={bookingMode}
                    onBookingModeChange={(newMode) => {
                      if (newMode === "regular" && bookingMode === "maintenance") {
                        setForm((prev) => prev ? { ...prev, bookingType: "flight" } : prev)
                      }
                      setBookingMode(newMode)
                      setErrors({})
                    }}
                  />
                ) : null}

                {bookingMode === "trial" ? (
                  <TrialGuestDetailsSection
                    values={{
                      trialFirstName: form.trialFirstName,
                      trialLastName: form.trialLastName,
                      trialEmail: form.trialEmail,
                      trialPhone: form.trialPhone,
                      voucherNumber: form.voucherNumber,
                    }}
                    errors={errors}
                    onChange={updateForm}
                  />
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
                        <RecurringBookingSection
                          isRecurring={form.isRecurring}
                          date={form.date}
                          repeatUntil={form.repeatUntil}
                          recurringDays={form.recurringDays}
                          timeZone={timeZone}
                          checkingOccurrences={checkingOccurrences}
                          occurrences={occurrences}
                          occurrenceConflicts={occurrenceConflicts}
                          recurringDaysError={errors.recurringDays}
                          repeatUntilError={errors.repeatUntil}
                          onRecurringToggle={(checked) => {
                            updateForm("isRecurring", checked)
                            if (!checked) {
                              updateForm("recurringDays", [])
                              updateForm("repeatUntil", null)
                            } else {
                              updateForm("recurringDays", [form.date.getDay()])
                              updateForm("endDate", form.date)
                            }
                          }}
                          onRecurringDaysChange={(days) => updateForm("recurringDays", days)}
                          onRepeatUntilChange={(value) => updateForm("repeatUntil", value)}
                        />
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
