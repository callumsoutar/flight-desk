"use client"

import * as React from "react"
import { ArrowRightLeft, Calendar, Check, Loader2, Plane, User, X } from "lucide-react"

import { useTimezone } from "@/contexts/timezone-context"
import { useBookingOptionsQuery } from "@/hooks/use-booking-options-query"
import { patchBookingMutation } from "@/hooks/use-booking-query"
import { cn } from "@/lib/utils"
import { formatDate, formatTime } from "@/lib/utils/date-format"
import type { AircraftWithType } from "@/lib/types/aircraft"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type AvailabilityResponse = {
  unavailableAircraftIds: string[]
  unavailableInstructorIds: string[]
}

export type SwitchAircraftBooking = {
  id: string
  start_time: string | null
  end_time: string | null
  student: {
    first_name: string | null
    last_name: string | null
    email?: string | null
  } | null
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  booking: SwitchAircraftBooking | null
  currentAircraft: AircraftWithType
  onSuccess: () => void
}

function formatStudentName(booking: SwitchAircraftBooking | null): string {
  if (!booking?.student) return "—"
  const fullName = [booking.student.first_name, booking.student.last_name]
    .filter(Boolean)
    .join(" ")
    .trim()
  return fullName || booking.student.email || "—"
}

function formatBookingWindow(
  booking: SwitchAircraftBooking | null,
  timeZone: string
): string {
  if (!booking?.start_time) return "—"
  const date = formatDate(booking.start_time, timeZone)
  const startTime = formatTime(booking.start_time, timeZone)
  const endTime = booking.end_time ? formatTime(booking.end_time, timeZone) : null
  if (!date) return "—"
  return endTime ? `${date} · ${startTime} – ${endTime}` : `${date} · ${startTime}`
}

async function fetchAvailability(
  bookingId: string,
  startIso: string,
  endIso: string,
  signal?: AbortSignal
): Promise<AvailabilityResponse> {
  const params = new URLSearchParams({
    start_time: startIso,
    end_time: endIso,
    exclude_booking_id: bookingId,
  })
  const response = await fetch(`/api/bookings/availability?${params.toString()}`, {
    method: "GET",
    cache: "no-store",
    headers: { "cache-control": "no-store" },
    signal,
  })
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null
    throw new Error(payload?.error || "Failed to check availability")
  }
  const payload = (await response.json().catch(() => null)) as AvailabilityResponse | null
  return {
    unavailableAircraftIds: payload?.unavailableAircraftIds ?? [],
    unavailableInstructorIds: payload?.unavailableInstructorIds ?? [],
  }
}

export function SwitchAircraftModal({
  open,
  onOpenChange,
  booking,
  currentAircraft,
  onSuccess,
}: Props) {
  const { timeZone } = useTimezone()
  const {
    data: options,
    isLoading: optionsLoading,
    error: optionsError,
  } = useBookingOptionsQuery(open)

  const [unavailableIds, setUnavailableIds] = React.useState<Set<string>>(new Set())
  const [availabilityLoading, setAvailabilityLoading] = React.useState(false)
  const [availabilityError, setAvailabilityError] = React.useState<string | null>(null)
  const [selectedAircraftId, setSelectedAircraftId] = React.useState<string | null>(null)
  const [submitError, setSubmitError] = React.useState<string | null>(null)
  const [pending, setPending] = React.useState(false)

  React.useEffect(() => {
    if (!open) {
      setUnavailableIds(new Set())
      setAvailabilityError(null)
      setAvailabilityLoading(false)
      setSelectedAircraftId(null)
      setSubmitError(null)
      setPending(false)
    }
  }, [open])

  React.useEffect(() => {
    if (!open || !booking?.id || !booking.start_time || !booking.end_time) return

    const controller = new AbortController()
    setAvailabilityLoading(true)
    setAvailabilityError(null)

    void fetchAvailability(booking.id, booking.start_time, booking.end_time, controller.signal)
      .then((payload) => {
        if (controller.signal.aborted) return
        setUnavailableIds(new Set(payload.unavailableAircraftIds))
      })
      .catch((error) => {
        if (controller.signal.aborted) return
        setAvailabilityError(
          error instanceof Error ? error.message : "Failed to check availability"
        )
      })
      .finally(() => {
        if (!controller.signal.aborted) setAvailabilityLoading(false)
      })

    return () => controller.abort()
  }, [open, booking?.id, booking?.start_time, booking?.end_time])

  const candidateAircraft = React.useMemo(() => {
    const all = options?.aircraft ?? []
    return all.filter((a) => a.id !== currentAircraft.id)
  }, [options?.aircraft, currentAircraft.id])

  // Sort: same type first (suggested), then alphabetically by registration.
  const sortedAircraft = React.useMemo(() => {
    const currentTypeId = currentAircraft.aircraft_type_id ?? null
    return [...candidateAircraft].sort((a, b) => {
      const aSame = currentTypeId && a.aircraft_type_id === currentTypeId ? 1 : 0
      const bSame = currentTypeId && b.aircraft_type_id === currentTypeId ? 1 : 0
      if (aSame !== bSame) return bSame - aSame
      return a.registration.localeCompare(b.registration)
    })
  }, [candidateAircraft, currentAircraft.aircraft_type_id])

  const isAvailable = React.useCallback(
    (id: string) => !unavailableIds.has(id),
    [unavailableIds]
  )

  // Auto-clear the selection if the chosen aircraft becomes unavailable.
  React.useEffect(() => {
    if (selectedAircraftId && unavailableIds.has(selectedAircraftId)) {
      setSelectedAircraftId(null)
    }
  }, [selectedAircraftId, unavailableIds])

  const handleSubmit = React.useCallback(async () => {
    if (!booking?.id || !selectedAircraftId || pending) return
    setPending(true)
    setSubmitError(null)
    try {
      await patchBookingMutation(booking.id, { aircraft_id: selectedAircraftId })
      onSuccess()
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Failed to switch aircraft")
    } finally {
      setPending(false)
    }
  }, [booking?.id, selectedAircraftId, pending, onSuccess])

  const optionsErrorMessage =
    optionsError instanceof Error ? optionsError.message : null

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          "p-0 border-none shadow-2xl rounded-[24px] overflow-hidden",
          "w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] sm:w-full sm:max-w-[600px]",
          "top-[calc(env(safe-area-inset-top)+1rem)] sm:top-[50%] translate-y-0 sm:translate-y-[-50%]",
          "h-auto sm:max-h-[calc(100dvh-4rem)]"
        )}
      >
        <div className="flex h-full min-h-0 flex-col bg-white">
          <DialogHeader className="px-6 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-4 text-left sm:pt-6">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
                  <ArrowRightLeft className="h-5 w-5" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-bold tracking-tight text-slate-900">
                    Switch Aircraft
                  </DialogTitle>
                  <DialogDescription className="mt-0.5 text-sm text-slate-500">
                    Click an available aircraft below to move this booking to.
                  </DialogDescription>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                disabled={pending}
                className="-mr-1 -mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-6 pb-6">
            <div className="space-y-6">
              <section>
                <div className="mb-3 flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                  <span className="text-xs font-semibold tracking-tight text-slate-900">
                    Booking Summary
                  </span>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                  <SummaryRow
                    icon={<Plane className="h-4 w-4 text-slate-400" />}
                    label="Current aircraft"
                    value={
                      currentAircraft.type
                        ? `${currentAircraft.registration} · ${currentAircraft.type}`
                        : currentAircraft.registration
                    }
                  />
                  <SummaryRow
                    icon={<User className="h-4 w-4 text-slate-400" />}
                    label="Member"
                    value={formatStudentName(booking)}
                  />
                  <SummaryRow
                    icon={<Calendar className="h-4 w-4 text-slate-400" />}
                    label="Date & Time"
                    value={formatBookingWindow(booking, timeZone)}
                    isLast
                  />
                </div>
              </section>

              <section>
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                    <span className="text-xs font-semibold tracking-tight text-slate-900">
                      Select replacement aircraft
                    </span>
                  </div>
                  {availabilityLoading ? (
                    <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-500">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Checking availability…
                    </span>
                  ) : null}
                </div>

                {optionsErrorMessage ? (
                  <ErrorState message={optionsErrorMessage} />
                ) : availabilityError ? (
                  <ErrorState message={availabilityError} />
                ) : optionsLoading ? (
                  <SkeletonList />
                ) : sortedAircraft.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-6 text-center text-sm text-slate-500">
                    No other aircraft are configured for this club.
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {sortedAircraft.map((aircraft) => {
                      const available = isAvailable(aircraft.id)
                      const selected = selectedAircraftId === aircraft.id
                      const sameType =
                        currentAircraft.aircraft_type_id != null &&
                        aircraft.aircraft_type_id === currentAircraft.aircraft_type_id
                      return (
                        <li key={aircraft.id}>
                          <button
                            type="button"
                            disabled={!available || pending}
                            onClick={() => setSelectedAircraftId(aircraft.id)}
                            className={cn(
                              "group relative flex w-full items-center gap-3 rounded-xl border bg-white px-4 py-3 text-left transition-all",
                              "focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300",
                              available
                                ? "border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/30"
                                : "cursor-not-allowed border-slate-200 bg-slate-50/60 opacity-70",
                              selected && "border-indigo-500 ring-2 ring-indigo-200 bg-indigo-50/40"
                            )}
                          >
                            <div
                              className={cn(
                                "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg",
                                available
                                  ? "bg-slate-100 text-slate-700 group-hover:bg-indigo-100 group-hover:text-indigo-700"
                                  : "bg-slate-100 text-slate-400",
                                selected && "bg-indigo-100 text-indigo-700"
                              )}
                            >
                              <Plane className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-sm font-semibold text-slate-900">
                                  {aircraft.registration}
                                </span>
                                {sameType ? (
                                  <Badge
                                    variant="outline"
                                    className="border-emerald-200 bg-emerald-50 px-1.5 py-0 text-[10px] font-medium text-emerald-700"
                                  >
                                    Same type
                                  </Badge>
                                ) : null}
                              </div>
                              <div className="truncate text-xs text-slate-500">
                                {aircraft.type || aircraft.model || "—"}
                              </div>
                            </div>
                            <div className="flex flex-shrink-0 items-center gap-3">
                              {available ? (
                                <Badge
                                  variant="outline"
                                  className="border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700"
                                >
                                  Available
                                </Badge>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className="border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-700"
                                >
                                  Unavailable
                                </Badge>
                              )}
                              <div
                                className={cn(
                                  "flex h-5 w-5 items-center justify-center rounded-full border transition-colors",
                                  selected
                                    ? "border-indigo-600 bg-indigo-600 text-white"
                                    : available
                                    ? "border-slate-300 bg-white group-hover:border-indigo-400"
                                    : "border-slate-200 bg-slate-50 opacity-50"
                                )}
                              >
                                {selected && <Check className="h-3 w-3" strokeWidth={3} />}
                              </div>
                            </div>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}

                {submitError ? (
                  <p className="mt-3 text-[11px] text-destructive">{submitError}</p>
                ) : null}
              </section>
            </div>
          </div>

          <div className="border-t border-slate-100 bg-white px-6 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-[0_-4px_12px_rgba(0,0,0,0.05)] sm:pb-4 shrink-0">
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                disabled={pending}
                className="h-11 rounded-xl px-5 text-sm font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              >
                Cancel
              </Button>
              <div className="flex flex-1 items-center justify-end gap-2">
                <Button
                  type="button"
                  onClick={() => void handleSubmit()}
                  disabled={
                    pending ||
                    optionsLoading ||
                    availabilityLoading ||
                    !selectedAircraftId ||
                    Boolean(optionsErrorMessage) ||
                    Boolean(availabilityError)
                  }
                  className={cn(
                    "h-11 rounded-xl px-6 text-sm font-semibold shadow-lg transition-all",
                    !selectedAircraftId
                      ? "bg-slate-200 text-slate-500 shadow-none"
                      : "bg-indigo-600 text-white shadow-indigo-900/10 hover:bg-indigo-700"
                  )}
                >
                  {pending ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Switching…
                    </span>
                  ) : !selectedAircraftId ? (
                    "Select an aircraft"
                  ) : (
                    `Confirm Switch to ${
                      sortedAircraft.find((a) => a.id === selectedAircraftId)?.registration
                    }`
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function SummaryRow({
  icon,
  label,
  value,
  isLast,
}: {
  icon: React.ReactNode
  label: string
  value: string
  isLast?: boolean
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 py-2.5",
        !isLast && "border-b border-slate-200/70"
      )}
    >
      <div className="flex items-center gap-2 text-sm text-slate-500">
        {icon}
        <span>{label}</span>
      </div>
      <span className="text-sm font-semibold text-slate-900">{value}</span>
    </div>
  )
}

function SkeletonList() {
  return (
    <ul className="space-y-2">
      {[0, 1, 2].map((i) => (
        <li
          key={i}
          className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3"
        >
          <div className="h-9 w-9 animate-pulse rounded-lg bg-slate-100" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-24 animate-pulse rounded bg-slate-100" />
            <div className="h-2.5 w-32 animate-pulse rounded bg-slate-100" />
          </div>
          <div className="h-5 w-20 animate-pulse rounded-full bg-slate-100" />
        </li>
      ))}
    </ul>
  )
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
      {message}
    </div>
  )
}
