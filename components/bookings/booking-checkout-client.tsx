"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { IconCheck, IconPlane } from "@tabler/icons-react"
import { toast } from "sonner"

import {
  authorizeBookingCheckoutAction,
  updateBookingCheckoutDetailsAction,
  updateBookingStatusAction,
} from "@/app/bookings/actions"
import {
  BookingEditDetailsCard,
  createBookingEditInitialState,
  type BookingEditFormState,
} from "@/components/bookings/booking-edit-details-card"
import { BookingHeader } from "@/components/bookings/booking-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { StickyFormActions } from "@/components/ui/sticky-form-actions"
import { Switch } from "@/components/ui/switch"
import type { BookingOptions, BookingWithRelations } from "@/lib/types/bookings"
import type { UserRole } from "@/lib/types/roles"

type CheckoutFormState = {
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

function createCheckoutInitialState(booking: BookingWithRelations): CheckoutFormState {
  return {
    eta: toDatetimeLocal(booking.eta),
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
  const [bookingForm, setBookingForm] = React.useState<BookingEditFormState>(() =>
    createBookingEditInitialState(booking)
  )
  const [checkoutForm, setCheckoutForm] = React.useState<CheckoutFormState>(() =>
    createCheckoutInitialState(booking)
  )

  const initialBookingForm = React.useMemo(() => createBookingEditInitialState(booking), [booking])
  const initialCheckoutForm = React.useMemo(() => createCheckoutInitialState(booking), [booking])

  const isStaff = role === "owner" || role === "admin" || role === "instructor"
  const isMemberOrStudent = role === "member" || role === "student"
  const canCheckOut = isStaff && booking.status === "confirmed"
  const canCheckIn = isStaff && booking.status === "flying"
  const isReadOnly = booking.status === "complete" || booking.status === "cancelled"
  const isDirty =
    JSON.stringify(bookingForm) !== JSON.stringify(initialBookingForm) ||
    JSON.stringify(checkoutForm) !== JSON.stringify(initialCheckoutForm)

  const studentName = booking.student ? formatUser(booking.student) : "Booking Checkout"
  const canSubmitCheckout = canCheckOut && checkoutForm.authorization_completed

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
    setBookingForm(initialBookingForm)
    setCheckoutForm(initialCheckoutForm)
  }

  const buildCheckoutPayload = React.useCallback(() => {
    const parsedFuel = checkoutForm.fuel_on_board.trim()
    const nextFuel = parsedFuel.length ? Number.parseFloat(parsedFuel) : null

    return {
      ...bookingForm,
      start_time: toIso(bookingForm.start_time),
      end_time: toIso(bookingForm.end_time),
      eta: toIsoOrNull(checkoutForm.eta),
      fuel_on_board: Number.isNaN(nextFuel ?? Number.NaN) ? null : nextFuel,
      route: normalizeText(checkoutForm.route),
      passengers: normalizeText(checkoutForm.passengers),
      flight_remarks: normalizeText(checkoutForm.flight_remarks),
      briefing_completed: checkoutForm.briefing_completed,
      authorization_completed: checkoutForm.authorization_completed,
    }
  }, [bookingForm, checkoutForm])

  const handleSave = () => {
    if (isReadOnly || !isDirty) return

    startTransition(async () => {
      const result = await updateBookingCheckoutDetailsAction(bookingId, buildCheckoutPayload())

      if (!result.ok) {
        toast.error(result.error)
        return
      }

      toast.success("Checkout details updated")
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
      router.refresh()
    })
  }

  const handleCheckIn = () => {
    if (!canCheckIn) return

    startTransition(async () => {
      const result = await updateBookingStatusAction(bookingId, "complete")

      if (!result.ok) {
        toast.error(result.error)
        return
      }

      toast.success("Flight checked in and marked complete")
      router.refresh()
    })
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
        <Button className="w-full sm:w-auto" onClick={handleCheckIn} disabled={isPending}>
          <IconCheck className="mr-2 h-4 w-4" />
          {isPending ? "Checking In..." : "Check In"}
        </Button>
      ) : null}
    </div>
  ) : null

  return (
    <div className="flex flex-1 flex-col bg-muted/30">
      <BookingHeader
        booking={booking}
        title={studentName}
        backHref={`/bookings/${bookingId}`}
        backLabel="Back to Booking"
        actions={headerActions}
      />

      <div className="mx-auto w-full max-w-7xl flex-1 px-4 pt-6 pb-28 sm:px-6 lg:px-8">
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
                    onChange={(event) => updateCheckoutField("eta", event.target.value)}
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
      </div>

      {!isReadOnly ? (
        <StickyFormActions
          isDirty={isDirty}
          isSaving={isPending}
          onUndo={handleUndo}
          onSave={handleSave}
          message="You have unsaved checkout details."
          undoLabel="Undo Changes"
          saveLabel="Save Changes"
        />
      ) : null}
    </div>
  )
}
