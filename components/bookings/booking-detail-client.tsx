"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  IconBook,
  IconCheck,
  IconChevronDown,
  IconClock,
  IconDeviceFloppy,
  IconDotsVertical,
  IconPlane,
  IconRotateClockwise,
  IconSchool,
  IconTrash,
  IconUser,
  IconUsers,
} from "@tabler/icons-react"
import { toast } from "sonner"

import { cancelBookingAction, updateBookingAction, updateBookingStatusAction } from "@/app/bookings/actions"
import { BookingHeader } from "@/components/bookings/booking-header"
import { CancelBookingModal } from "@/components/bookings/cancel-booking-modal"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"
import type { AuditLog, BookingOptions, BookingStatus, BookingType, BookingWithRelations } from "@/lib/types/bookings"
import type { UserRole } from "@/lib/types/roles"

type BookingFormState = {
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

function createInitialState(booking: BookingWithRelations): BookingFormState {
  return {
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
  }
}

function formatUser(user: { first_name: string | null; last_name: string | null; email: string | null }) {
  return [user.first_name, user.last_name].filter(Boolean).join(" ") || user.email || "Unknown"
}

function formatDate(value: string | null) {
  if (!value) return "—"
  return new Date(value).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function formatAuditDescription(log: AuditLog): string {
  if (log.action === "INSERT") return "Booking Created"
  if (!log.column_changes || typeof log.column_changes !== "object") return log.action
  const changes = Object.keys(log.column_changes as Record<string, unknown>)
  return changes.length ? `${log.action}: ${changes.join(", ")}` : log.action
}

export function BookingDetailClient({
  bookingId,
  booking,
  options,
  auditLogs,
  role,
}: {
  bookingId: string
  booking: BookingWithRelations
  options: BookingOptions
  auditLogs: AuditLog[]
  role: UserRole | null
}) {
  const router = useRouter()
  const isMobile = useIsMobile()
  const [form, setForm] = React.useState<BookingFormState>(() => createInitialState(booking))
  const [isPending, startTransition] = React.useTransition()
  const [cancelOpen, setCancelOpen] = React.useState(false)
  const [auditOpen, setAuditOpen] = React.useState(true)

  const initial = React.useMemo(() => createInitialState(booking), [booking])
  const isDirty = JSON.stringify(form) !== JSON.stringify(initial)
  const startParts = React.useMemo(() => parseIsoParts(form.start_time), [form.start_time])
  const endParts = React.useMemo(() => parseIsoParts(form.end_time), [form.end_time])

  const isAdminOrInstructor = role === "owner" || role === "admin" || role === "instructor"
  const isMemberOrStudent = role === "member" || role === "student"
  const isReadOnly = booking.status === "complete" || booking.status === "cancelled"

  const updateField = <K extends keyof BookingFormState>(key: K, value: BookingFormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const handleSave = () => {
    if (isReadOnly) return
    startTransition(async () => {
      const result = await updateBookingAction(bookingId, {
        ...form,
        start_time: toIso(form.start_time),
        end_time: toIso(form.end_time),
      })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success("Booking updated")
      router.refresh()
    })
  }

  const handleStatusChange = (status: BookingStatus) => {
    startTransition(async () => {
      const result = await updateBookingStatusAction(bookingId, status)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success("Booking updated")
      router.refresh()
    })
  }

  const handleCancel = (reason: string | null) => {
    startTransition(async () => {
      const result = await cancelBookingAction(bookingId, reason)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success("Booking cancelled")
      setCancelOpen(false)
      router.refresh()
    })
  }

  const studentName = booking.student ? formatUser(booking.student) : "—"
  const instructorName = booking.instructor
    ? formatUser({
        first_name: booking.instructor.user?.first_name ?? booking.instructor.first_name,
        last_name: booking.instructor.user?.last_name ?? booking.instructor.last_name,
        email: booking.instructor.user?.email ?? null,
      })
    : "—"

  const headerActions = isAdminOrInstructor ? (
    <div className="flex items-center gap-2">
      {booking.status === "unconfirmed" ? (
        <Button size="sm" onClick={() => handleStatusChange("confirmed")} disabled={isPending}>
          <IconCheck className="mr-2 h-4 w-4" />
          Confirm
        </Button>
      ) : null}
      {booking.status === "confirmed" ? (
        <Button size="sm" onClick={() => handleStatusChange("flying")} disabled={isPending}>
          <IconPlane className="mr-2 h-4 w-4" />
          Check Out
        </Button>
      ) : null}
      {booking.status === "flying" ? (
        <Button size="sm" onClick={() => handleStatusChange("complete")} disabled={isPending}>
          <IconCheck className="mr-2 h-4 w-4" />
          Check In
        </Button>
      ) : null}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            Quick Actions
            <IconChevronDown className="ml-2 h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            className="text-red-600 focus:text-red-600"
            disabled={isReadOnly || !!booking.cancelled_at}
            onClick={() => setCancelOpen(true)}
          >
            <IconTrash className="mr-2 h-4 w-4" />
            Cancel Booking
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  ) : null

  const fieldLabelClass = "text-sm font-medium leading-none text-foreground"
  const controlClass = "h-10 w-full"

  return (
    <div className="flex flex-1 flex-col bg-muted/30">
      <BookingHeader
        title={studentName}
        status={booking.status}
        subtitle={formatDate(booking.start_time)}
        backHref="/bookings"
        actions={headerActions}
      />

      <div className="mx-auto w-full max-w-7xl flex-1 px-4 pt-6 pb-28 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:gap-8">
          <div className="space-y-6 lg:col-span-2">
            <Card className="border border-border/50 shadow-sm">
              <CardHeader className="border-b border-border/20 pb-6">
                <CardTitle className="flex items-center gap-3 text-2xl font-bold">
                  <IconClock className="h-6 w-6" />
                  {isReadOnly ? "Booking Details" : "Edit Booking Details"}
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
                          updateField("start_time", combineDateAndTime(nextDate, nextTime))
                        }}
                      />
                      <div className="w-32">
                        <Select
                          value={startParts.time || "none"}
                          onValueChange={(value) => {
                            const nextTime = value === "none" ? "" : value
                            updateField("start_time", combineDateAndTime(startParts.date, nextTime))
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
                          updateField("end_time", combineDateAndTime(nextDate, nextTime))
                        }}
                      />
                      <div className="w-32">
                        <Select
                          value={endParts.time || "none"}
                          onValueChange={(value) => {
                            const nextTime = value === "none" ? "" : value
                            updateField("end_time", combineDateAndTime(endParts.date, nextTime))
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
                    <Select
                      value={form.user_id ?? "none"}
                      onValueChange={(value) => updateField("user_id", value === "none" ? null : value)}
                      disabled={isReadOnly || !isAdminOrInstructor}
                    >
                      <SelectTrigger className={controlClass}>
                        <SelectValue placeholder="Select member" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No member</SelectItem>
                        {options.members.map((member) => (
                          <SelectItem key={member.id ?? ""} value={member.id ?? ""}>
                            {formatUser(member)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className={cn(fieldLabelClass, "flex items-center gap-2")}>
                      <IconSchool className="h-4 w-4" />
                      Instructor
                    </label>
                    <Select
                      value={form.instructor_id ?? "none"}
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
                      value={form.aircraft_id ?? "none"}
                      onValueChange={(value) => updateField("aircraft_id", value === "none" ? null : value)}
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
                      value={form.flight_type_id ?? "none"}
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
                      value={form.booking_type}
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
                    <Select
                      value={form.lesson_id ?? "none"}
                      onValueChange={(value) => updateField("lesson_id", value === "none" ? null : value)}
                      disabled={isReadOnly || isMemberOrStudent}
                    >
                      <SelectTrigger className={controlClass}>
                        <SelectValue placeholder="Select lesson" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No lesson</SelectItem>
                        {options.lessons.map((lesson) => (
                          <SelectItem key={lesson.id} value={lesson.id}>{lesson.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
          </div>

          <div className="space-y-6">
            <Card className="rounded-xl border border-border/50 shadow-md">
              <CardHeader className="border-b border-border/20 pb-5">
                <CardTitle className="text-xl font-bold">Resources</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6 pt-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <IconUsers className="h-4 w-4" />
                    <h3 className="text-sm font-bold uppercase tracking-wider">People</h3>
                  </div>
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900/50">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm font-medium">Member</span>
                      <Badge variant="outline" className="text-xs">Student</Badge>
                    </div>
                    <div className="font-bold">{studentName}</div>
                    {booking.student?.email ? <div className="text-sm text-muted-foreground">{booking.student.email}</div> : null}
                  </div>
                  {booking.instructor ? (
                    <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900/50">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-sm font-medium">Instructor</span>
                        <Badge variant="outline" className="text-xs">Staff</Badge>
                      </div>
                      <div className="font-bold">{instructorName}</div>
                      {booking.instructor.user?.email ? (
                        <div className="text-sm text-muted-foreground">{booking.instructor.user.email}</div>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <IconPlane className="h-4 w-4" />
                    <h3 className="text-sm font-bold uppercase tracking-wider">Aircraft</h3>
                  </div>
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900/50">
                    {booking.aircraft ? (
                      <>
                        <div className="font-bold">{booking.aircraft.registration} ({booking.aircraft.type})</div>
                        <div className="text-sm text-muted-foreground">
                          {booking.aircraft.manufacturer}{booking.aircraft.model ? `, ${booking.aircraft.model}` : ""}
                        </div>
                      </>
                    ) : (
                      <div className="text-sm text-muted-foreground">No aircraft assigned</div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <Card className="mt-8 rounded-xl border border-border/50 shadow-md">
          <CardHeader className="border-b border-border/20 p-0">
            <Button
              variant="ghost"
              className="h-auto w-full justify-start gap-2 rounded-none px-6 py-4 text-left"
              onClick={() => setAuditOpen((prev) => !prev)}
            >
              <IconChevronDown className={cn("h-4 w-4 transition-transform", !auditOpen && "-rotate-90")} />
              <CardTitle className="text-base sm:text-lg">Booking History</CardTitle>
            </Button>
          </CardHeader>
          {auditOpen ? (
            <CardContent className="px-0 pt-4 sm:px-6">
              {auditLogs.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No history available
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border/30">
                        <th className="px-4 py-2 text-left text-sm font-semibold">Date</th>
                        <th className="px-4 py-2 text-left text-sm font-semibold">User</th>
                        <th className="px-4 py-2 text-left text-sm font-semibold">Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditLogs.map((log) => (
                        <tr key={log.id} className="border-b border-border/20 last:border-0">
                          <td className="px-4 py-2 text-sm">
                            {new Date(log.created_at).toLocaleString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                          </td>
                          <td className="px-4 py-2 text-sm">{log.user ? formatUser(log.user) : "Unknown"}</td>
                          <td className="px-4 py-2 text-sm">{formatAuditDescription(log)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          ) : null}
        </Card>
      </div>

      {isDirty && !isReadOnly ? (
        <div className="fixed inset-x-0 bottom-0 z-50 border-t border-gray-200 bg-white shadow-xl dark:border-gray-800 dark:bg-gray-900">
          <div className="mx-auto flex w-full max-w-7xl items-center justify-end gap-4 px-4 py-4 sm:px-6 lg:px-8">
            <Button
              variant="outline"
              onClick={() => setForm(initial)}
              disabled={isPending}
            >
              <IconRotateClockwise className="mr-2 h-4 w-4" />
              Undo Changes
            </Button>
            <Button onClick={handleSave} disabled={isPending}>
              <IconDeviceFloppy className="mr-2 h-4 w-4" />
              {isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      ) : null}

      {isMobile && isAdminOrInstructor && !isReadOnly ? (
        <div className="fixed bottom-0 right-0 z-40 p-4">
          <Drawer>
            <DrawerTrigger asChild>
              <Button variant="outline" size="icon" className="rounded-full shadow-lg">
                <IconDotsVertical className="h-5 w-5" />
              </Button>
            </DrawerTrigger>
            <DrawerContent>
              <DrawerHeader>
                <DrawerTitle>Booking actions</DrawerTitle>
                <DrawerDescription>Manage this booking.</DrawerDescription>
              </DrawerHeader>
              <div className="space-y-2 px-4 pb-4">
                <Button
                  variant="destructive"
                  className="w-full justify-start"
                  disabled={isReadOnly || !!booking.cancelled_at}
                  onClick={() => setCancelOpen(true)}
                >
                  <IconTrash className="mr-2 h-4 w-4" />
                  Cancel Booking
                </Button>
                <DrawerClose asChild>
                  <Button variant="outline" className="w-full">Close</Button>
                </DrawerClose>
              </div>
            </DrawerContent>
          </Drawer>
        </div>
      ) : null}

      <CancelBookingModal
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        onConfirm={handleCancel}
        pending={isPending}
      />
    </div>
  )
}
