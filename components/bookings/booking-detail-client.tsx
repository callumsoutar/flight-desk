"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  IconCheck,
  IconChevronDown,
  IconDotsVertical,
  IconPlane,
  IconTrash,
  IconUsers,
} from "@tabler/icons-react"
import { toast } from "sonner"

import { updateBookingAction, updateBookingStatusAction } from "@/app/bookings/actions"
import {
  BookingEditDetailsCard,
  createBookingEditInitialState,
  type BookingEditFormState,
} from "@/components/bookings/booking-edit-details-card"
import { BookingHeader } from "@/components/bookings/booking-header"
import {
  BookingStatusTracker,
  deriveBookingTrackerState,
  getBookingTrackerStages,
} from "@/components/bookings/booking-status-tracker"
import { CancelBookingModal, type CancelBookingPayload } from "@/components/bookings/cancel-booking-modal"
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
import { StickyFormActions } from "@/components/ui/sticky-form-actions"
import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"
import type { AuditLog, BookingOptions, BookingStatus, BookingWithRelations } from "@/lib/types/bookings"
import type { UserRole } from "@/lib/types/roles"

function toIso(value: string) {
  if (!value) return ""
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "" : date.toISOString()
}

function formatUser(user: { first_name: string | null; last_name: string | null; email: string | null }) {
  return [user.first_name, user.last_name].filter(Boolean).join(" ") || user.email || "Unknown"
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
  const [form, setForm] = React.useState<BookingEditFormState>(() => createBookingEditInitialState(booking))
  const [isPending, startTransition] = React.useTransition()
  const [cancelOpen, setCancelOpen] = React.useState(false)
  const [auditOpen, setAuditOpen] = React.useState(true)

  const initial = React.useMemo(() => createBookingEditInitialState(booking), [booking])
  const isDirty = JSON.stringify(form) !== JSON.stringify(initial)

  const isAdminOrInstructor = role === "owner" || role === "admin" || role === "instructor"
  const isMemberOrStudent = role === "member" || role === "student"
  const isReadOnly = booking.status === "complete" || booking.status === "cancelled"

  const updateField = <K extends keyof BookingEditFormState>(key: K, value: BookingEditFormState[K]) =>
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

  const handleCancel = (payload: CancelBookingPayload) => {
    startTransition(async () => {
      const response = await fetch(`/api/bookings/${bookingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "cancelled",
          cancellation_category_id: payload.cancellationCategoryId,
          cancellation_reason: payload.cancellationReason,
          cancelled_notes: payload.cancelledNotes,
        }),
      })

      if (!response.ok) {
        const json = (await response.json().catch(() => ({}))) as { error?: string }
        toast.error(json.error || "Failed to cancel booking")
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
  const lessonProgressExists = React.useMemo(() => {
    if (!booking.lesson_progress) return false
    return Array.isArray(booking.lesson_progress) ? booking.lesson_progress.length > 0 : true
  }, [booking.lesson_progress])
  const trackerStages = React.useMemo(
    () => getBookingTrackerStages(Boolean(booking.briefing_completed)),
    [booking.briefing_completed]
  )
  const trackerState = React.useMemo(
    () =>
      deriveBookingTrackerState({
        stages: trackerStages,
        status: booking.status,
        briefingCompleted: booking.briefing_completed,
        authorizationCompleted: booking.authorization_completed,
        checkedOutAt: booking.checked_out_at,
        checkedInAt: booking.checked_in_at,
        checkinApprovedAt: booking.checkin_approved_at,
        hasDebrief: lessonProgressExists,
      }),
    [
      booking.authorization_completed,
      booking.briefing_completed,
      booking.checkin_approved_at,
      booking.checked_in_at,
      booking.checked_out_at,
      booking.status,
      lessonProgressExists,
      trackerStages,
    ]
  )

  const headerActions = isAdminOrInstructor ? (
    <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
      {booking.status === "unconfirmed" ? (
        <Button
          size="sm"
          className="w-full sm:w-auto"
          onClick={() => handleStatusChange("confirmed")}
          disabled={isPending}
        >
          <IconCheck className="mr-2 h-4 w-4" />
          Confirm
        </Button>
      ) : null}
      {booking.status === "confirmed" ? (
        <Button
          size="sm"
          className="w-full sm:w-auto"
          onClick={() => router.push(`/bookings/checkout/${bookingId}`)}
          disabled={isPending}
        >
          <IconPlane className="mr-2 h-4 w-4" />
          Check Out
        </Button>
      ) : null}
      {booking.status === "flying" ? (
        <Button
          size="sm"
          className="w-full sm:w-auto"
          onClick={() => router.push(`/bookings/checkin/${bookingId}`)}
          disabled={isPending}
        >
          <IconCheck className="mr-2 h-4 w-4" />
          Check In
        </Button>
      ) : null}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="w-full sm:w-auto">
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

  return (
    <div className="flex flex-1 flex-col bg-muted/30">
      <BookingHeader
        booking={booking}
        title={studentName}
        backHref="/bookings"
        actions={headerActions}
      />

      <div className="mx-auto w-full max-w-7xl flex-1 px-4 pt-6 pb-28 sm:px-6 lg:px-8">
        <BookingStatusTracker
          stages={trackerStages}
          activeStageId={trackerState.activeStageId}
          completedStageIds={trackerState.completedStageIds}
          className="mb-6"
        />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:gap-8">
          <div className="space-y-6 lg:col-span-2">
            <BookingEditDetailsCard
              form={form}
              options={options}
              isReadOnly={isReadOnly}
              isAdminOrInstructor={isAdminOrInstructor}
              isMemberOrStudent={isMemberOrStudent}
              onFieldChange={updateField}
            />
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

      {!isReadOnly ? (
        <StickyFormActions
          isDirty={isDirty}
          isSaving={isPending}
          onUndo={() => setForm(initial)}
          onSave={handleSave}
          message="You have unsaved booking details."
          undoLabel="Undo Changes"
          saveLabel="Save Changes"
        />
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
        booking={booking}
        onConfirm={handleCancel}
        pending={isPending}
      />
    </div>
  )
}
