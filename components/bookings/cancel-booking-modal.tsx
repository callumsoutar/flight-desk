"use client"

import * as React from "react"
import { AlertTriangle, Calendar, Plane, User, X } from "lucide-react"

import { useCancellationCategoriesQuery } from "@/hooks/use-cancellation-categories-query"
import { useTimezone } from "@/contexts/timezone-context"
import type { BookingWithRelations } from "@/lib/types/bookings"
import type { CancellationCategory } from "@/lib/types/cancellations"
import { formatDate, formatTime } from "@/lib/utils/date-format"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

export type CancelBookingPayload = {
  cancellationCategoryId: string
  cancellationReason: string
  cancelledNotes: string | null
}

type FormErrors = {
  cancellationCategoryId?: string
  cancelledNotes?: string
}

function formatStudentName(booking: BookingWithRelations) {
  if (!booking.student) return "—"
  const fullName = [booking.student.first_name, booking.student.last_name]
    .filter(Boolean)
    .join(" ")
    .trim()
  return fullName || booking.student.email || "—"
}

function formatAircraftLabel(booking: BookingWithRelations) {
  if (!booking.aircraft?.registration) return "—"
  return booking.aircraft.type
    ? `${booking.aircraft.registration} · ${booking.aircraft.type}`
    : booking.aircraft.registration
}

function formatBookingStartLabel(
  booking: BookingWithRelations,
  timeZone: string
) {
  const dateLabel = formatDate(booking.start_time, timeZone)
  const timeLabel = formatTime(booking.start_time, timeZone)
  if (!dateLabel) return "—"
  return `${dateLabel} @ ${timeLabel}`
}

const FORM_ID = "cancel-booking-form"

export function CancelBookingModal({
  open,
  onOpenChange,
  booking,
  onConfirm,
  pending,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  booking: BookingWithRelations | null
  onConfirm: (payload: CancelBookingPayload) => void
  pending: boolean
}) {
  const { timeZone } = useTimezone()
  const {
    data: categoriesData,
    isLoading: categoriesLoading,
    error: categoriesErrorState,
  } = useCancellationCategoriesQuery(open)
  const categories = React.useMemo<CancellationCategory[]>(
    () => categoriesData ?? [],
    [categoriesData]
  )
  const categoriesError =
    categoriesErrorState instanceof Error ? categoriesErrorState.message : null
  const [cancellationCategoryId, setCancellationCategoryId] = React.useState("")
  const [cancelledNotes, setCancelledNotes] = React.useState("")
  const [errors, setErrors] = React.useState<FormErrors>({})

  const resetForm = React.useCallback(() => {
    setCancellationCategoryId("")
    setCancelledNotes("")
    setErrors({})
  }, [])

  React.useEffect(() => {
    if (!open) {
      resetForm()
    }
  }, [open, resetForm])

  const selectedCategory = React.useMemo(
    () =>
      categories.find((category) => category.id === cancellationCategoryId) ??
      null,
    [categories, cancellationCategoryId]
  )

  const validate = React.useCallback(() => {
    const nextErrors: FormErrors = {}

    if (!cancellationCategoryId) {
      nextErrors.cancellationCategoryId = "Please select a cancellation reason."
    }

    if (cancelledNotes.length > 2000) {
      nextErrors.cancelledNotes = "Notes are too long. Maximum 2000 characters."
    }

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }, [cancellationCategoryId, cancelledNotes.length])

  const handleSubmit = React.useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      if (pending) return
      if (!validate()) return
      if (!selectedCategory) return

      onConfirm({
        cancellationCategoryId: selectedCategory.id,
        cancellationReason: selectedCategory.name,
        cancelledNotes: cancelledNotes.trim() ? cancelledNotes.trim() : null,
      })
    },
    [cancelledNotes, onConfirm, pending, selectedCategory, validate]
  )

  if (booking?.cancelled_at) {
    return null
  }

  const selectDisabled =
    pending || Boolean(categoriesError) || categories.length === 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          "p-0 border-none shadow-2xl rounded-[24px] overflow-hidden",
          "w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] sm:w-full sm:max-w-[560px]",
          "top-[calc(env(safe-area-inset-top)+1rem)] sm:top-[50%] translate-y-0 sm:translate-y-[-50%]",
          "h-auto sm:max-h-[calc(100dvh-4rem)]"
        )}
      >
        <div className="flex h-full min-h-0 flex-col bg-white">
          <DialogHeader className="px-6 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-4 text-left sm:pt-6">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-50 text-rose-600">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-bold tracking-tight text-slate-900">
                    Cancel Booking
                  </DialogTitle>
                  <DialogDescription className="mt-0.5 text-sm text-slate-500">
                    Choose a reason and add optional context. Required fields
                    are marked with{" "}
                    <span className="text-destructive">*</span>.
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

          <form
            id={FORM_ID}
            onSubmit={handleSubmit}
            className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-6 pb-6"
          >
            <div className="space-y-6">
              {booking ? (
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
                      label="Aircraft"
                      value={formatAircraftLabel(booking)}
                    />
                    <SummaryRow
                      icon={<User className="h-4 w-4 text-slate-400" />}
                      label="Member"
                      value={formatStudentName(booking)}
                    />
                    <SummaryRow
                      icon={<Calendar className="h-4 w-4 text-slate-400" />}
                      label="Date & Time"
                      value={formatBookingStartLabel(booking, timeZone)}
                      isLast
                    />
                  </div>
                </section>
              ) : null}

              <section>
                <div className="mb-3 flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                  <span className="text-xs font-semibold tracking-tight text-slate-900">
                    Cancellation Details
                  </span>
                </div>

                <div className="space-y-5">
                  <div>
                    <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      Cancellation Reason{" "}
                      <span className="text-destructive">*</span>
                    </label>
                    {categoriesLoading ? (
                      <div className="flex h-10 items-center rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500">
                        Loading reasons...
                      </div>
                    ) : (
                      <Select
                        value={cancellationCategoryId || undefined}
                        onValueChange={(value) => {
                          setCancellationCategoryId(value)
                          setErrors((prev) => ({
                            ...prev,
                            cancellationCategoryId: undefined,
                          }))
                        }}
                        disabled={selectDisabled}
                      >
                        <SelectTrigger className="h-10 w-full rounded-xl border-slate-200 bg-white px-3 text-sm font-medium shadow-none hover:bg-slate-50 focus:ring-0">
                          <SelectValue
                            placeholder={
                              categories.length > 0
                                ? "Select a reason"
                                : "No reasons available"
                            }
                          />
                        </SelectTrigger>
                        <SelectContent
                          position="popper"
                          className="w-[var(--radix-select-trigger-width)] rounded-xl border-slate-200 shadow-xl"
                        >
                          {categories.map((category) => (
                            <SelectItem key={category.id} value={category.id}>
                              {category.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    {categoriesError ? (
                      <p className="mt-1.5 text-[11px] text-destructive">
                        {categoriesError}
                      </p>
                    ) : null}
                    {errors.cancellationCategoryId ? (
                      <p className="mt-1.5 text-[11px] text-destructive">
                        {errors.cancellationCategoryId}
                      </p>
                    ) : null}
                    {selectedCategory?.description ? (
                      <p className="mt-1.5 text-[11px] text-slate-500">
                        {selectedCategory.description}
                      </p>
                    ) : null}
                  </div>

                  <div>
                    <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      Additional Notes{" "}
                      <span className="font-normal normal-case tracking-normal text-slate-400">
                        (Optional)
                      </span>
                    </label>
                    <Textarea
                      rows={4}
                      value={cancelledNotes}
                      onChange={(event) => {
                        setCancelledNotes(event.target.value)
                        setErrors((prev) => ({
                          ...prev,
                          cancelledNotes: undefined,
                        }))
                      }}
                      maxLength={2000}
                      placeholder="Any additional context for this cancellation..."
                      disabled={pending}
                      className="w-full rounded-xl border-slate-200 bg-white text-sm placeholder:text-slate-400 focus:ring-slate-900"
                    />
                    <div className="mt-1.5 flex items-center justify-between">
                      {errors.cancelledNotes ? (
                        <p className="text-[11px] text-destructive">
                          {errors.cancelledNotes}
                        </p>
                      ) : (
                        <span />
                      )}
                      <p className="text-[11px] text-slate-400">
                        {cancelledNotes.length}/2000
                      </p>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </form>

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
                  type="submit"
                  form={FORM_ID}
                  variant="destructive"
                  disabled={
                    pending ||
                    categoriesLoading ||
                    Boolean(categoriesError) ||
                    categories.length === 0
                  }
                  className="h-11 rounded-xl px-6 text-sm font-semibold shadow-lg shadow-rose-900/10"
                >
                  {pending ? "Cancelling..." : "Cancel Booking"}
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
