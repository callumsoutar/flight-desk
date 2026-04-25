"use client"

import * as React from "react"
import { IconBook, IconClock, IconPlane, IconSchool, IconUser, IconX } from "@tabler/icons-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { LessonSearchDropdown } from "@/components/bookings/lesson-search-dropdown"
import MemberSelect, { type UserResult } from "@/components/invoices/member-select"
import { cn } from "@/lib/utils"
import type { BookingOptions, BookingType, BookingWithRelations } from "@/lib/types/bookings"

export type BookingEditFormState = {
  start_time: string
  end_time: string
  aircraft_id: string | null
  user_id: string | null
  instructor_id: string | null
  flight_type_id: string | null
  lesson_id: string | null
  booking_type: BookingType
  purpose: string
  remarks: string | null
}

function toIso(value: string) {
  if (!value) return ""
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "" : date.toISOString()
}

export function normalizeBookingEditFormState(state: BookingEditFormState): BookingEditFormState {
  return {
    ...state,
    start_time: toIso(state.start_time),
    end_time: toIso(state.end_time),
    purpose: state.purpose ?? "",
    remarks: state.remarks ?? null,
  }
}

function generateTimeOptions(): string[] {
  const times: string[] = []
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      const h = String(hour).padStart(2, "0")
      const m = String(minute).padStart(2, "0")
      times.push(`${h}:${m}`)
    }
  }
  return times
}

const TIME_OPTIONS = generateTimeOptions()

function formatTimeForDisplay(time: string): string {
  if (!time) return "Select time"
  const [hours, minutes] = time.split(":")
  const hour = Number.parseInt(hours, 10)
  const ampm = hour >= 12 ? "pm" : "am"
  const displayHour = hour % 12 || 12
  return `${displayHour}:${minutes} ${ampm}`
}

function parseIsoParts(value: string) {
  if (!value) return { date: "", time: "" }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return { date: "", time: "" }
  const pad = (n: number) => String(n).padStart(2, "0")
  return {
    date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    time: `${pad(date.getHours())}:${pad(date.getMinutes())}`,
  }
}

function combineDateAndTime(dateValue: string, timeValue: string): string {
  if (!dateValue || !timeValue) return ""
  const [year, month, day] = dateValue.split("-").map((part) => Number.parseInt(part, 10))
  const [hours, minutes] = timeValue.split(":").map((part) => Number.parseInt(part, 10))
  const date = new Date(year, month - 1, day, hours, minutes, 0, 0)
  return Number.isNaN(date.getTime()) ? "" : date.toISOString()
}

function parseIsoDate(value: string): Date | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function isAfter(a: string, b: string): boolean {
  const aDate = parseIsoDate(a)
  const bDate = parseIsoDate(b)
  if (!aDate || !bDate) return false
  return aDate.getTime() > bDate.getTime()
}

function formatUser(user: { first_name: string | null; last_name: string | null; email: string | null }) {
  return [user.first_name, user.last_name].filter(Boolean).join(" ") || user.email || "Unknown"
}

export function createBookingEditInitialState(booking: BookingWithRelations): BookingEditFormState {
  return normalizeBookingEditFormState({
    start_time: booking.start_time,
    end_time: booking.end_time,
    aircraft_id: booking.aircraft_id,
    user_id: booking.user_id,
    instructor_id: booking.instructor_id,
    flight_type_id: booking.flight_type_id,
    lesson_id: booking.lesson_id,
    booking_type: booking.booking_type,
    purpose: booking.purpose ?? "",
    remarks: booking.remarks,
  })
}

export function BookingEditDetailsCard({
  form,
  options,
  isReadOnly,
  isAdminOrInstructor,
  isMemberOrStudent,
  onFieldChange,
  title,
  aircraftValue,
  onAircraftChange,
}: {
  form: BookingEditFormState
  options: BookingOptions
  isReadOnly: boolean
  isAdminOrInstructor: boolean
  isMemberOrStudent: boolean
  onFieldChange: <K extends keyof BookingEditFormState>(key: K, value: BookingEditFormState[K]) => void
  title?: string
  aircraftValue?: string | null
  onAircraftChange?: (value: string | null) => void
}) {
  const startParts = parseIsoParts(form.start_time)
  const endParts = parseIsoParts(form.end_time)

  const updateField = <K extends keyof BookingEditFormState>(
    key: K,
    value: BookingEditFormState[K]
  ) => onFieldChange(key, value)

  const aircraftSelectValue = aircraftValue !== undefined ? aircraftValue : form.aircraft_id
  const handleAircraftChange =
    onAircraftChange ?? ((value: string | null) => updateField("aircraft_id", value))

  const memberDisabled = isReadOnly || !isAdminOrInstructor
  const selectedMember = React.useMemo<UserResult | null>(() => {
    if (!form.user_id) return null
    return options.members.find((member) => member.id === form.user_id) ?? null
  }, [form.user_id, options.members])

  const updateStartTime = (nextStartIso: string) => {
    updateField("start_time", nextStartIso)
    if (nextStartIso && isAfter(nextStartIso, form.end_time)) {
      updateField("end_time", nextStartIso)
    }
  }

  const fieldLabelClass = "text-sm font-medium leading-none text-foreground"
  const controlClass = "h-10 w-full"

  return (
    <Card className="border border-border/50 shadow-sm">
      <CardHeader className="border-b border-border/20 pb-6">
        <CardTitle className="flex items-center gap-3 text-2xl font-bold">
          <IconClock className="h-6 w-6" />
          {title ?? (isReadOnly ? "Booking Details" : "Edit Booking Details")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5 pt-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label className={fieldLabelClass}>Start Time</label>
            <div className="flex gap-2">
              <Input
                type="date"
                value={startParts.date}
                disabled={isReadOnly}
                className={cn(controlClass, "flex-1")}
                onChange={(event) => {
                  const nextDate = event.target.value
                  const nextTime = startParts.time || "00:00"
                  const nextStartIso = combineDateAndTime(nextDate, nextTime)
                  updateField("start_time", nextStartIso)

                  if (nextStartIso && isAfter(nextStartIso, form.end_time)) {
                    const nextEndTime = endParts.time || nextTime || "00:00"
                    const nextEndIso = combineDateAndTime(nextDate, nextEndTime) || nextStartIso
                    updateField("end_time", isAfter(nextStartIso, nextEndIso) ? nextStartIso : nextEndIso)
                  }
                }}
              />
              <div className="w-32">
                <Select
                  value={startParts.time || "none"}
                  onValueChange={(value) => {
                    const nextTime = value === "none" ? "" : value
                    updateStartTime(combineDateAndTime(startParts.date, nextTime))
                  }}
                  disabled={isReadOnly}
                >
                  <SelectTrigger className={controlClass}>
                    <SelectValue placeholder="Time">
                      {startParts.time ? formatTimeForDisplay(startParts.time) : "Time"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="max-h-[200px]">
                    <SelectItem value="none">Select time</SelectItem>
                    {TIME_OPTIONS.map((time) => (
                      <SelectItem key={time} value={time}>
                        {formatTimeForDisplay(time)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <label className={fieldLabelClass}>End Time</label>
            <div className="flex gap-2">
              <Input
                type="date"
                value={endParts.date}
                disabled={isReadOnly}
                className={cn(controlClass, "flex-1")}
                onChange={(event) => {
                  const nextDate = event.target.value
                  const nextTime = endParts.time || "00:00"
                  const nextEndIso = combineDateAndTime(nextDate, nextTime)
                  updateField("end_time", nextEndIso)
                  if (nextEndIso && isAfter(form.start_time, nextEndIso)) {
                    updateField("end_time", form.start_time)
                  }
                }}
              />
              <div className="w-32">
                <Select
                  value={endParts.time || "none"}
                  onValueChange={(value) => {
                    const nextTime = value === "none" ? "" : value
                    const nextEndIso = combineDateAndTime(endParts.date, nextTime)
                    updateField("end_time", nextEndIso)
                    if (nextEndIso && isAfter(form.start_time, nextEndIso)) {
                      updateField("end_time", form.start_time)
                    }
                  }}
                  disabled={isReadOnly}
                >
                  <SelectTrigger className={controlClass}>
                    <SelectValue placeholder="Time">
                      {endParts.time ? formatTimeForDisplay(endParts.time) : "Time"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="max-h-[200px]">
                    <SelectItem value="none">Select time</SelectItem>
                    {TIME_OPTIONS.map((time) => (
                      <SelectItem key={time} value={time}>
                        {formatTimeForDisplay(time)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className={cn(fieldLabelClass, "flex items-center gap-2")}>
              <IconUser className="h-4 w-4" />
              Member
            </label>
            <div className="flex items-center gap-1.5">
              <div className="min-w-0 flex-1">
                <MemberSelect
                  members={options.members}
                  value={selectedMember}
                  onSelect={(member) => updateField("user_id", member?.id ?? null)}
                  disabled={memberDisabled}
                  buttonClassName={controlClass}
                />
              </div>
              {selectedMember && !memberDisabled ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 shrink-0 text-muted-foreground hover:text-foreground"
                  onClick={() => updateField("user_id", null)}
                  aria-label="Clear member"
                >
                  <IconX className="h-4 w-4" />
                </Button>
              ) : null}
            </div>
          </div>

          <div className="space-y-2">
            <label className={cn(fieldLabelClass, "flex items-center gap-2")}>
              <IconSchool className="h-4 w-4" />
              Instructor
            </label>
            <Select
              value={form.instructor_id || "none"}
              onValueChange={(value) => updateField("instructor_id", value === "none" ? null : value)}
              disabled={isReadOnly}
            >
              <SelectTrigger className={controlClass}>
                <SelectValue placeholder="Select instructor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No instructor</SelectItem>
                {options.instructors.map((instructor) => (
                  <SelectItem key={instructor.id} value={instructor.id}>
                    {formatUser({
                      first_name: instructor.user?.first_name ?? instructor.first_name,
                      last_name: instructor.user?.last_name ?? instructor.last_name,
                      email: instructor.user?.email ?? null,
                    })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className={cn(fieldLabelClass, "flex items-center gap-2")}>
              <IconPlane className="h-4 w-4" />
              Aircraft
            </label>
            <Select
              value={aircraftSelectValue || "none"}
              onValueChange={(value) => handleAircraftChange(value === "none" ? null : value)}
              disabled={isReadOnly}
            >
              <SelectTrigger className={controlClass}>
                <SelectValue placeholder="Select aircraft" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No aircraft</SelectItem>
                {options.aircraft.map((aircraft) => (
                  <SelectItem key={aircraft.id} value={aircraft.id}>
                    {aircraft.registration} - {aircraft.manufacturer} {aircraft.type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className={cn(fieldLabelClass, "flex items-center gap-2")}>
              <IconClock className="h-4 w-4" />
              Flight Type
            </label>
            <Select
              value={form.flight_type_id || "none"}
              onValueChange={(value) => updateField("flight_type_id", value === "none" ? null : value)}
              disabled={isReadOnly || isMemberOrStudent}
            >
              <SelectTrigger className={controlClass}>
                <SelectValue placeholder="Select flight type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No flight type</SelectItem>
                {options.flightTypes.map((item) => (
                  <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className={fieldLabelClass}>Booking Type</label>
            <Select
              value={form.booking_type ?? "flight"}
              onValueChange={(value) => updateField("booking_type", value as BookingType)}
              disabled={isReadOnly}
            >
              <SelectTrigger className={controlClass}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="flight">Flight</SelectItem>
                <SelectItem value="groundwork">Ground Work</SelectItem>
                <SelectItem value="maintenance">Maintenance</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className={cn(fieldLabelClass, "flex items-center gap-2")}>
              <IconBook className="h-4 w-4" />
              Lesson
            </label>
            <LessonSearchDropdown
              lessons={options.lessons}
              syllabi={options.syllabi}
              value={form.lesson_id}
              onSelect={(lessonId) => updateField("lesson_id", lessonId)}
              disabled={isReadOnly || isMemberOrStudent}
              placeholder="Select lesson"
              triggerClassName={cn(controlClass, "justify-between")}
            />
          </div>

          <div className="space-y-2">
            <label className={fieldLabelClass}>Description</label>
            <textarea
              className="min-h-[112px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={form.purpose}
              disabled={isReadOnly}
              onChange={(event) => updateField("purpose", event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className={fieldLabelClass}>Operational Remarks</label>
            <textarea
              className="min-h-[112px] w-full rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm dark:border-amber-800/50 dark:bg-amber-950/30"
              value={form.remarks ?? ""}
              disabled={isReadOnly}
              onChange={(event) => updateField("remarks", event.target.value || null)}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
