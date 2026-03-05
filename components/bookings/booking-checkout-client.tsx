"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { IconCheck, IconPlane } from "@tabler/icons-react"
import { toast } from "sonner"

import {
  authorizeBookingCheckoutAction,
  updateBookingCheckoutDetailsAction,
} from "@/app/bookings/actions"
import {
  BookingEditDetailsCard,
  createBookingEditInitialState,
  normalizeBookingEditFormState,
  type BookingEditFormState,
} from "@/components/bookings/booking-edit-details-card"
import { BookingHeader } from "@/components/bookings/booking-header"
import { BookingPageContent } from "@/components/bookings/booking-page-content"
import {
  BookingStatusTracker,
  deriveBookingTrackerState,
  getBookingTrackerStages,
} from "@/components/bookings/booking-status-tracker"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { StickyFormActions } from "@/components/ui/sticky-form-actions"
import { Switch } from "@/components/ui/switch"
import type { BookingOptions, BookingWithRelations } from "@/lib/types/bookings"
import type { UserRole } from "@/lib/types/roles"

type CheckoutFormState = {
  checked_out_aircraft_id: string | null
  eta: string
  fuel_on_board: string
  route: string
  passengers: string
  flight_remarks: string
  briefing_completed: boolean
  authorization_completed: boolean
}

function formatUser(user: { first_name: string | null; last_name: string | null; email: string | null }) {
  return [user.first_name, user.last_name].filter(Boolean).join(" ") || user.email || "Unknown"
}

function toIso(value: string) {
  if (!value) return ""
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "" : date.toISOString()
}

function toIsoOrNull(value: string) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function toDatetimeLocal(value: string | null) {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function normalizeText(value: string) {
  const trimmed = value.trim()
  return trimmed.length ? trimmed : null
}

function formatDurationMinutes(totalMinutes: number): string {
  const minutes = Math.max(0, Math.round(totalMinutes))
  const hoursPart = Math.floor(minutes / 60)
  const minutesPart = minutes % 60
  if (hoursPart <= 0) return `${minutesPart}m`
  if (minutesPart === 0) return `${hoursPart}h`
  return `${hoursPart}h ${minutesPart}m`
}

function createCheckoutInitialState(booking: BookingWithRelations): CheckoutFormState {
  return {
    checked_out_aircraft_id: booking.checked_out_aircraft_id ?? booking.aircraft_id ?? null,
    eta: toDatetimeLocal(booking.eta ?? booking.end_time),
    fuel_on_board:
      typeof booking.fuel_on_board === "number" && Number.isFinite(booking.fuel_on_board)
        ? String(booking.fuel_on_board)
        : "",
    route: booking.route ?? "",
    passengers: booking.passengers ?? "",
    flight_remarks: booking.flight_remarks ?? "",
    briefing_completed: Boolean(booking.briefing_completed),
    authorization_completed: Boolean(booking.authorization_completed),
  }
}

export function BookingCheckoutClient({
  bookingId,
  booking,
  options,
  role,
}: {
  bookingId: string
  booking: BookingWithRelations
  options: BookingOptions
  role: UserRole | null
}) {
  const router = useRouter()
  const [isPending, startTransition] = React.useTransition()
  const serverInitialBookingForm = React.useMemo(() => createBookingEditInitialState(booking), [booking])
  const serverInitialCheckoutForm = React.useMemo(() => createCheckoutInitialState(booking), [booking])

  const [bookingForm, setBookingForm] = React.useState<BookingEditFormState>(() => serverInitialBookingForm)
  const [checkoutForm, setCheckoutForm] = React.useState<CheckoutFormState>(() => serverInitialCheckoutForm)
  const [isEtaAuto, setIsEtaAuto] = React.useState(() => {
    const endTimeLocal = toDatetimeLocal(serverInitialBookingForm.end_time)
    return !serverInitialCheckoutForm.eta || serverInitialCheckoutForm.eta === endTimeLocal
  })
  const [savedBookingForm, setSavedBookingForm] = React.useState<BookingEditFormState>(() => serverInitialBookingForm)
  const [savedCheckoutForm, setSavedCheckoutForm] = React.useState<CheckoutFormState>(() => serverInitialCheckoutForm)
  const savedBookingFormRef = React.useRef(savedBookingForm)
  const savedCheckoutFormRef = React.useRef(savedCheckoutForm)
  const bookingFormRef = React.useRef(bookingForm)
  const checkoutFormRef = React.useRef(checkoutForm)

  React.useEffect(() => {
    savedBookingFormRef.current = savedBookingForm
  }, [savedBookingForm])

  React.useEffect(() => {
    savedCheckoutFormRef.current = savedCheckoutForm
  }, [savedCheckoutForm])

  React.useEffect(() => {
    bookingFormRef.current = bookingForm
  }, [bookingForm])

  React.useEffect(() => {
    checkoutFormRef.current = checkoutForm
  }, [checkoutForm])

  React.useEffect(() => {
    const prevSavedBooking = savedBookingFormRef.current
    const prevSavedCheckout = savedCheckoutFormRef.current
    const currentBooking = bookingFormRef.current
    const currentCheckout = checkoutFormRef.current
    const shouldResetBookingForm = JSON.stringify(currentBooking) === JSON.stringify(prevSavedBooking)
    const shouldResetCheckoutForm = JSON.stringify(currentCheckout) === JSON.stringify(prevSavedCheckout)

    setSavedBookingForm(serverInitialBookingForm)
    setSavedCheckoutForm(serverInitialCheckoutForm)
    savedBookingFormRef.current = serverInitialBookingForm
    savedCheckoutFormRef.current = serverInitialCheckoutForm

    if (shouldResetBookingForm) setBookingForm(serverInitialBookingForm)
    if (shouldResetCheckoutForm) setCheckoutForm(serverInitialCheckoutForm)
    if (shouldResetCheckoutForm) {
      const endTimeLocal = toDatetimeLocal(serverInitialBookingForm.end_time)
      setIsEtaAuto(!serverInitialCheckoutForm.eta || serverInitialCheckoutForm.eta === endTimeLocal)
    }
  }, [serverInitialBookingForm, serverInitialCheckoutForm])

  const bookingEndTimeLocal = React.useMemo(
    () => toDatetimeLocal(bookingForm.end_time || null),
    [bookingForm.end_time]
  )

  const checkedOutAircraftId = checkoutForm.checked_out_aircraft_id

  const selectedAircraft = React.useMemo(() => {
    const aircraftId = checkedOutAircraftId
    if (!aircraftId) return null
    return options.aircraft.find((item) => item.id === aircraftId) ?? null
  }, [checkedOutAircraftId, options.aircraft])

  const fuelConsumption = React.useMemo(() => {
    const aircraftId = checkedOutAircraftId
    if (!aircraftId) return null

    if (typeof selectedAircraft?.fuel_consumption === "number") {
      return selectedAircraft.fuel_consumption
    }

    if (booking.aircraft?.id === aircraftId) return booking.aircraft.fuel_consumption ?? null
    if (booking.checked_out_aircraft?.id === aircraftId) return booking.checked_out_aircraft.fuel_consumption ?? null

    return null
  }, [booking.aircraft, booking.checked_out_aircraft, checkedOutAircraftId, selectedAircraft])

  const enduranceSummary = React.useMemo(() => {
    const fuelText = checkoutForm.fuel_on_board.trim()
    const fuel = fuelText.length ? Number.parseFloat(fuelText) : null
    const burn = fuelConsumption
    if (typeof burn !== "number" || !Number.isFinite(burn) || burn <= 0) {
      return { label: "Endurance: —", detail: "Fuel consumption not set for this aircraft." }
    }

    if (fuel === null) {
      return { label: "Endurance: —", detail: `Based on ${burn.toFixed(1)}/hr.` }
    }

    if (!Number.isFinite(fuel) || fuel < 0) {
      return { label: "Endurance: —", detail: `Based on ${burn.toFixed(1)}/hr.` }
    }

    const totalMinutes = (fuel / burn) * 60
    if (!Number.isFinite(totalMinutes)) {
      return { label: "Endurance: —", detail: `Based on ${burn.toFixed(1)}/hr.` }
    }

    return {
      label: `Est. endurance: ${formatDurationMinutes(totalMinutes)}`,
      detail: `Based on ${burn.toFixed(1)}/hr.`,
    }
  }, [checkoutForm.fuel_on_board, fuelConsumption])

  React.useEffect(() => {
    if (!isEtaAuto) return
    setCheckoutForm((current) => {
      if (current.eta === bookingEndTimeLocal) return current
      return { ...current, eta: bookingEndTimeLocal }
    })
  }, [bookingEndTimeLocal, isEtaAuto])

  const isStaff = role === "owner" || role === "admin" || role === "instructor"
  const isMemberOrStudent = role === "member" || role === "student"
  const canCheckOut = isStaff && booking.status === "confirmed"
  const canCheckIn = isStaff && booking.status === "flying"
  const isReadOnly = booking.status === "complete" || booking.status === "cancelled"
  const isDirty =
    JSON.stringify(bookingForm) !== JSON.stringify(savedBookingForm) ||
    JSON.stringify(checkoutForm) !== JSON.stringify(savedCheckoutForm)

  const studentName = booking.student ? formatUser(booking.student) : "Booking Checkout"
  const canSubmitCheckout = canCheckOut && checkoutForm.authorization_completed
  const stickySaveLabel = canCheckOut ? "Check Flight Out" : "Save Changes"
  const stickyMessage = canCheckOut
    ? "You have unsaved checkout details. Checking flight out will save changes and set status to flying."
    : "You have unsaved checkout details."
  const lessonProgressExists = React.useMemo(() => {
    if (!booking.lesson_progress) return false
    return Array.isArray(booking.lesson_progress) ? booking.lesson_progress.length > 0 : true
  }, [booking.lesson_progress])
  const trackerStages = React.useMemo(
    () => getBookingTrackerStages(Boolean(checkoutForm.briefing_completed)),
    [checkoutForm.briefing_completed]
  )
  const trackerState = React.useMemo(
    () =>
      deriveBookingTrackerState({
        stages: trackerStages,
        status: booking.status,
        briefingCompleted: checkoutForm.briefing_completed,
        authorizationCompleted: checkoutForm.authorization_completed,
        checkedOutAt: booking.checked_out_at,
        checkedInAt: booking.checked_in_at,
        checkinApprovedAt: booking.checkin_approved_at,
        hasDebrief: lessonProgressExists,
      }),
    [
      booking.checkin_approved_at,
      booking.checked_in_at,
      booking.checked_out_at,
      booking.status,
      checkoutForm.authorization_completed,
      checkoutForm.briefing_completed,
      lessonProgressExists,
      trackerStages,
    ]
  )

  const updateBookingField = <K extends keyof BookingEditFormState>(
    key: K,
    value: BookingEditFormState[K]
  ) => {
    setBookingForm((prev) => ({ ...prev, [key]: value }))
  }

  const updateCheckoutField = <K extends keyof CheckoutFormState>(
    key: K,
    value: CheckoutFormState[K]
  ) => {
    setCheckoutForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleUndo = () => {
    const nextBookingForm = savedBookingFormRef.current
    const nextCheckoutForm = savedCheckoutFormRef.current
    setBookingForm(nextBookingForm)
    setCheckoutForm(nextCheckoutForm)
    const endTimeLocal = toDatetimeLocal(nextBookingForm.end_time || null)
    setIsEtaAuto(!nextCheckoutForm.eta || nextCheckoutForm.eta === endTimeLocal)
  }

  const buildCheckoutPayload = React.useCallback(() => {
    const parsedFuel = checkoutForm.fuel_on_board.trim()
    const nextFuel = parsedFuel.length ? Number.parseFloat(parsedFuel) : null
    const etaValue = isEtaAuto ? bookingEndTimeLocal : checkoutForm.eta

    return {
      ...bookingForm,
      start_time: toIso(bookingForm.start_time),
      end_time: toIso(bookingForm.end_time),
      checked_out_aircraft_id: checkoutForm.checked_out_aircraft_id,
      eta: toIsoOrNull(etaValue),
      fuel_on_board: Number.isNaN(nextFuel ?? Number.NaN) ? null : nextFuel,
      route: normalizeText(checkoutForm.route),
      passengers: normalizeText(checkoutForm.passengers),
      flight_remarks: normalizeText(checkoutForm.flight_remarks),
      briefing_completed: checkoutForm.briefing_completed,
      authorization_completed: checkoutForm.authorization_completed,
    }
  }, [bookingEndTimeLocal, bookingForm, checkoutForm, isEtaAuto])

  const handleSave = () => {
    if (isReadOnly || !isDirty) return

    startTransition(async () => {
      const result = await updateBookingCheckoutDetailsAction(bookingId, buildCheckoutPayload())

      if (!result.ok) {
        toast.error(result.error)
        return
      }

      toast.success("Checkout details updated")
      const nextSavedBooking = normalizeBookingEditFormState({
        ...bookingForm,
        start_time: toIso(bookingForm.start_time),
        end_time: toIso(bookingForm.end_time),
      })
      setBookingForm(nextSavedBooking)
      setSavedBookingForm(nextSavedBooking)
      savedBookingFormRef.current = nextSavedBooking

      setSavedCheckoutForm(checkoutForm)
      savedCheckoutFormRef.current = checkoutForm
      router.refresh()
    })
  }

  const handleAuthorize = () => {
    if (!canSubmitCheckout) return

    startTransition(async () => {
      const result = await authorizeBookingCheckoutAction(bookingId, buildCheckoutPayload())

      if (!result.ok) {
        toast.error(result.error)
        return
      }

      toast.success("Flight authorized and marked as flying")
      const nextSavedBooking = normalizeBookingEditFormState({
        ...bookingForm,
        start_time: toIso(bookingForm.start_time),
        end_time: toIso(bookingForm.end_time),
      })
      setBookingForm(nextSavedBooking)
      setSavedBookingForm(nextSavedBooking)
      savedBookingFormRef.current = nextSavedBooking

      setSavedCheckoutForm(checkoutForm)
      savedCheckoutFormRef.current = checkoutForm
      router.refresh()
    })
  }

  const handleOpenCheckIn = () => {
    if (!canCheckIn) return
    router.push(`/bookings/checkin/${bookingId}`)
  }

  const headerActions = isStaff ? (
    <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
      {canCheckOut ? (
        <Button
          className="w-full sm:w-auto"
          onClick={handleAuthorize}
          disabled={isPending || !canSubmitCheckout}
        >
          <IconPlane className="mr-2 h-4 w-4" />
          {isPending ? "Checking Out..." : "Check Out"}
        </Button>
      ) : null}
      {canCheckIn ? (
        <Button className="w-full sm:w-auto" onClick={handleOpenCheckIn} disabled={isPending}>
          <IconCheck className="mr-2 h-4 w-4" />
          Check In
        </Button>
      ) : null}
    </div>
  ) : null

  return (
    <div className="flex flex-1 flex-col bg-muted/30">
      <BookingHeader
        booking={booking}
        title={studentName}
        backHref="/bookings"
        backLabel="Back to Bookings"
        actions={headerActions}
      />

      <div className="w-full max-w-none flex-1 px-4 pt-6 pb-28 sm:px-6 lg:px-8">
        <BookingStatusTracker
          stages={trackerStages}
          activeStageId={trackerState.activeStageId}
          completedStageIds={trackerState.completedStageIds}
          className="mb-6"
        />

        <BookingPageContent>
          {!isStaff ? (
            <Card className="mb-6 border border-border/50">
              <CardHeader>
                <CardTitle className="text-lg">Checkout access required</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Only staff users can check bookings out and in.
              </CardContent>
            </Card>
          ) : null}

          {isStaff && !canCheckOut && !canCheckIn && !isReadOnly ? (
            <Card className="mb-6 border border-border/50">
              <CardHeader>
                <CardTitle className="text-lg">Status actions unavailable</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Check out is available when status is confirmed. Check in is available when status is flying.
              </CardContent>
            </Card>
          ) : null}

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:gap-8">
            <div className="space-y-6 lg:col-span-2">
              <BookingEditDetailsCard
                form={bookingForm}
                options={options}
                isReadOnly={isReadOnly}
                isAdminOrInstructor={isStaff}
                isMemberOrStudent={isMemberOrStudent}
                onFieldChange={updateBookingField}
                aircraftValue={checkoutForm.checked_out_aircraft_id}
                onAircraftChange={(value) => updateCheckoutField("checked_out_aircraft_id", value)}
                title="Confirm Booking Details"
              />
            </div>

            <div className="space-y-6">
              <Card className="border border-border/50 shadow-sm">
                <CardHeader className="border-b border-border/20 pb-5">
                  <CardTitle className="text-xl font-bold">Checkout Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-5 pt-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">ETA</label>
                    <Input
                      type="datetime-local"
                      value={checkoutForm.eta}
                      disabled={isReadOnly}
                      onChange={(event) => {
                        const nextValue = event.target.value
                        updateCheckoutField("eta", nextValue)
                        setIsEtaAuto(!nextValue || nextValue === bookingEndTimeLocal)
                      }}
                    />
                  </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Fuel On Board</label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.1"
                    value={checkoutForm.fuel_on_board}
                    disabled={isReadOnly}
                    onChange={(event) => updateCheckoutField("fuel_on_board", event.target.value)}
                  />
                  <p className="text-xs leading-snug text-muted-foreground" title={enduranceSummary.detail}>
                    {enduranceSummary.label}
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Route</label>
                  <Input
                    value={checkoutForm.route}
                    disabled={isReadOnly}
                    onChange={(event) => updateCheckoutField("route", event.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Passengers</label>
                  <Input
                    value={checkoutForm.passengers}
                    disabled={isReadOnly}
                    onChange={(event) => updateCheckoutField("passengers", event.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Flight Remarks</label>
                  <textarea
                    className="min-h-[112px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={checkoutForm.flight_remarks}
                    disabled={isReadOnly}
                    onChange={(event) => updateCheckoutField("flight_remarks", event.target.value)}
                  />
                </div>

                <div className="rounded-md border border-border/50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <label className="text-sm font-medium">Briefing Completed</label>
                    <Switch
                      checked={checkoutForm.briefing_completed}
                      disabled={isReadOnly}
                      onCheckedChange={(value) => updateCheckoutField("briefing_completed", Boolean(value))}
                    />
                  </div>
                </div>

                <div className="rounded-md border border-border/50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <label className="text-sm font-medium">Authorization Completed</label>
                    <Switch
                      checked={checkoutForm.authorization_completed}
                      disabled={isReadOnly}
                      onCheckedChange={(value) => updateCheckoutField("authorization_completed", Boolean(value))}
                    />
                  </div>
                </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </BookingPageContent>
      </div>

      {!isReadOnly ? (
        <StickyFormActions
          isDirty={isDirty}
          isSaving={isPending}
          isSaveDisabled={canCheckOut ? !canSubmitCheckout : false}
          onUndo={handleUndo}
          onSave={canCheckOut ? handleAuthorize : handleSave}
          message={stickyMessage}
          undoLabel="Undo Changes"
          saveLabel={stickySaveLabel}
        />
      ) : null}
    </div>
  )
}
