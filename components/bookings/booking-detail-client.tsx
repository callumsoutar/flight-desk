"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import {
  IconAddressBook,
  IconCheck,
  IconChevronDown,
  IconDotsVertical,
  IconFileDescription,
  IconMail,
  IconPlane,
  IconPlaneDeparture,
  IconTrash,
  IconUsers,
} from "@tabler/icons-react"
import { toast } from "sonner"

import { updateBookingAction, updateBookingStatusAction } from "@/app/bookings/actions"
import {
  BookingEditDetailsCard,
  createBookingEditInitialState,
  normalizeBookingEditFormState,
  type BookingEditFormState,
} from "@/components/bookings/booking-edit-details-card"
import { BookingAuditTimeline } from "@/components/bookings/booking-audit-timeline"
import { BookingHeader } from "@/components/bookings/booking-header"
import { BookingPageContent } from "@/components/bookings/booking-page-content"
import {
  BookingStatusTracker,
  deriveBookingTrackerState,
  getBookingTrackerStages,
} from "@/components/bookings/booking-status-tracker"
import { CancelBookingModal, type CancelBookingPayload } from "@/components/bookings/cancel-booking-modal"
import { ContactDetailsModal } from "@/components/members/contact-details-modal"
import { runAsyncProgressToast } from "@/components/ui/async-progress-toast"
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
import { bookingQueryKey, sendBookingConfirmationEmailMutation, useBookingQuery } from "@/hooks/use-booking-query"
import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"
import type { AuditLog, AuditLookupMaps, BookingOptions, BookingStatus, BookingWithRelations } from "@/lib/types/bookings"
import type { UserRole } from "@/lib/types/roles"

function toIso(value: string) {
  if (!value) return ""
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "" : date.toISOString()
}

function formatUser(user: { first_name: string | null; last_name: string | null; email: string | null }) {
  return [user.first_name, user.last_name].filter(Boolean).join(" ") || user.email || "Unknown"
}

export function BookingDetailClient({
  bookingId,
  booking: initialBooking,
  options,
  auditLogs,
  auditLookupMaps,
  role,
}: {
  bookingId: string
  booking: BookingWithRelations
  options: BookingOptions
  auditLogs: AuditLog[]
  auditLookupMaps: AuditLookupMaps
  role: UserRole | null
}) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { data: liveBooking } = useBookingQuery(bookingId, initialBooking)
  const booking = liveBooking ?? initialBooking
  const isMobile = useIsMobile()
  const serverInitialForm = React.useMemo(() => createBookingEditInitialState(booking), [booking])
  const [form, setForm] = React.useState<BookingEditFormState>(() => serverInitialForm)
  const [savedForm, setSavedForm] = React.useState<BookingEditFormState>(() => serverInitialForm)
  const savedFormRef = React.useRef(savedForm)
  const [isPending, startTransition] = React.useTransition()
  const [cancelOpen, setCancelOpen] = React.useState(false)
  const [sendingConfirmation, setSendingConfirmation] = React.useState(false)
  const [contactOpen, setContactOpen] = React.useState(false)
  const [contactMemberId, setContactMemberId] = React.useState<string | null>(null)
  const [auditOpen, setAuditOpen] = React.useState(true)

  React.useEffect(() => {
    savedFormRef.current = savedForm
  }, [savedForm])

  React.useEffect(() => {
    const prevSaved = savedFormRef.current
    setSavedForm(serverInitialForm)
    savedFormRef.current = serverInitialForm

    setForm((current) =>
      JSON.stringify(current) === JSON.stringify(prevSaved) ? serverInitialForm : current
    )
  }, [serverInitialForm])

  const isDirty = React.useMemo(() => {
    return JSON.stringify(form) !== JSON.stringify(savedForm)
  }, [form, savedForm])

  const isAdminOrInstructor = role === "owner" || role === "admin" || role === "instructor"
  const isMemberOrStudent = role === "member" || role === "student"
  const isReadOnly = booking.status === "complete" || booking.status === "cancelled"

  const openContactDetails = React.useCallback(
    (memberId: string) => {
      setContactMemberId(memberId)
      setContactOpen(true)
    },
    []
  )

  const updateField = <K extends keyof BookingEditFormState>(key: K, value: BookingEditFormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const handleSave = () => {
    if (isReadOnly || !isDirty) return
    startTransition(async () => {
      const nextSaved = normalizeBookingEditFormState({
        ...form,
        start_time: toIso(form.start_time),
        end_time: toIso(form.end_time),
      })

      const result = await updateBookingAction(bookingId, {
        ...nextSaved,
      })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success("Booking updated")
      setForm(nextSaved)
      setSavedForm(nextSaved)
      savedFormRef.current = nextSaved
      await queryClient.invalidateQueries({ queryKey: bookingQueryKey(bookingId) })
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
      await queryClient.invalidateQueries({ queryKey: bookingQueryKey(bookingId) })
    })
  }

  const handleSendConfirmationEmail = React.useCallback(async () => {
    setSendingConfirmation(true)
    try {
      await runAsyncProgressToast({
        promise: () => sendBookingConfirmationEmailMutation(bookingId),
        loading: "Sending confirmation email",
        loadingDescription: "Preparing the booking confirmation for the member.",
        success: "Confirmation email sent",
        successDescription: booking.student?.email?.trim() || undefined,
        error: (error) => error instanceof Error ? error.message : "Failed to send confirmation email",
      })
    } catch {
      return
    } finally {
      setSendingConfirmation(false)
    }
  }, [booking.student?.email, bookingId])

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
      await queryClient.invalidateQueries({ queryKey: bookingQueryKey(bookingId) })
    })
  }

  const canSendConfirmationEmail =
    Boolean(booking.student?.email?.trim()) && booking.status !== "cancelled"

  const isFlightBooking = booking.booking_type === "flight"
  const studentName = booking.student ? formatUser(booking.student) : "—"
  const studentMemberId = booking.user_id
  const isGroundwork = booking.booking_type === "groundwork"
  const headerTitle = isGroundwork ? "Groundwork Session" : studentName
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
  const includeDebriefStage = isFlightBooking && booking.flight_type?.instruction_type !== "solo"
  const trackerStages = React.useMemo(
    () => getBookingTrackerStages(Boolean(booking.briefing_completed), includeDebriefStage),
    [booking.briefing_completed, includeDebriefStage]
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

  const showDebriefAction = isFlightBooking && lessonProgressExists
  const showStatusActions = isFlightBooking && isAdminOrInstructor

  const headerActions =
    showDebriefAction || showStatusActions ? (
      <>
        {showDebriefAction ? (
          <Button
            variant="outline"
            asChild
            className="h-10 gap-2 font-medium shadow-sm transition-all hover:bg-muted/60 hover:shadow"
          >
            <Link href={`/bookings/${bookingId}/debrief`}>
              <IconFileDescription className="h-4 w-4" />
              View Debrief
            </Link>
          </Button>
        ) : null}
        {showStatusActions && (
          <>
            {booking.status === "unconfirmed" ? (
              <Button
                className="h-10 flex-1 gap-2 px-5 font-semibold shadow-md ring-1 ring-inset ring-primary/20 transition-all hover:shadow-lg hover:-translate-y-px active:translate-y-0 sm:flex-none"
                onClick={() => handleStatusChange("confirmed")}
                disabled={isPending}
              >
                <IconCheck className="h-4 w-4" />
                Confirm
              </Button>
            ) : null}
            {booking.status === "confirmed" ? (
              <Button
                className="h-10 flex-1 gap-2 px-5 font-semibold shadow-md ring-1 ring-inset ring-primary/20 transition-all hover:shadow-lg hover:-translate-y-px active:translate-y-0 sm:flex-none"
                onClick={() => router.push(`/bookings/checkout/${bookingId}`)}
                disabled={isPending}
              >
                <IconPlaneDeparture className="h-4 w-4" />
                Check Out
              </Button>
            ) : null}
            {booking.status === "flying" ? (
              <Button
                className="h-10 flex-1 gap-2 px-5 font-semibold shadow-md ring-1 ring-inset ring-primary/20 transition-all hover:shadow-lg hover:-translate-y-px active:translate-y-0 sm:flex-none"
                onClick={() => router.push(`/bookings/checkin/${bookingId}`)}
                disabled={isPending}
              >
                <IconCheck className="h-4 w-4" />
                Check In
              </Button>
            ) : null}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="More actions"
                  className="hidden h-10 w-10 shadow-sm transition-all hover:bg-muted/60 hover:shadow sm:inline-flex"
                >
                  <IconDotsVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem
                  disabled={!canSendConfirmationEmail || sendingConfirmation}
                  onClick={() => void handleSendConfirmationEmail()}
                >
                  <IconMail className="mr-2 h-4 w-4" />
                  Send confirmation email
                </DropdownMenuItem>
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
          </>
        )}
      </>
    ) : null

  return (
    <div className="flex flex-1 flex-col bg-muted/30">
      <BookingHeader
        booking={booking}
        title={headerTitle}
        backHref="/bookings"
        actions={headerActions}
        showRecordLinks={!isMemberOrStudent}
      />

      <div className="w-full max-w-none flex-1 px-4 pt-6 pb-28 sm:px-6 lg:px-8">
        {isFlightBooking ? (
          <BookingStatusTracker
            stages={trackerStages}
            activeStageId={trackerState.activeStageId}
            completedStageIds={trackerState.completedStageIds}
            className="mb-6"
          />
        ) : null}

        <BookingPageContent className="space-y-8">
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
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span className="text-sm font-medium">Member</span>
                        <div className="flex items-center gap-1.5">
                          {isAdminOrInstructor && studentMemberId ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => openContactDetails(studentMemberId)}
                              aria-label="View contact details"
                            >
                              <IconAddressBook className="h-4 w-4" />
                            </Button>
                          ) : null}
                          <Badge variant="outline" className="text-xs">Student</Badge>
                        </div>
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
                      <h3 className="text-sm font-bold uppercase tracking-wider">{isGroundwork ? "Session" : "Aircraft"}</h3>
                    </div>
                    <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900/50">
                      {isGroundwork ? (
                        <div className="text-sm text-muted-foreground">Groundwork sessions do not use an aircraft.</div>
                      ) : booking.aircraft ? (
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

          {!isMemberOrStudent ? (
            <Card className="rounded-xl border border-border/50 shadow-md">
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
                <CardContent className="px-0 pt-4 pb-2">
                  <BookingAuditTimeline logs={auditLogs} maps={auditLookupMaps} />
                </CardContent>
              ) : null}
            </Card>
          ) : null}
        </BookingPageContent>
      </div>

      {!isReadOnly ? (
        <StickyFormActions
          isDirty={isDirty}
          isSaving={isPending}
          onUndo={() => setForm(savedFormRef.current)}
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
              <Button
                variant="default"
                size="icon"
                className="h-12 w-12 rounded-full shadow-xl ring-1 ring-border/40"
                aria-label="Open booking actions"
              >
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
                  variant="outline"
                  className="w-full justify-start"
                  disabled={!canSendConfirmationEmail || sendingConfirmation}
                  onClick={() => void handleSendConfirmationEmail()}
                >
                  <IconMail className="mr-2 h-4 w-4" />
                  Send confirmation email
                </Button>
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

      <ContactDetailsModal
        open={contactOpen}
        onOpenChange={(open) => {
          setContactOpen(open)
          if (!open) setContactMemberId(null)
        }}
        memberId={contactMemberId}
      />

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
