"use client"

import * as React from "react"
import { AlertTriangle } from "lucide-react"

import type { BookingWithRelations } from "@/lib/types/bookings"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

type CancellationCategory = {
  id: string
  name: string
  description: string | null
}

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
  const fullName = [booking.student.first_name, booking.student.last_name].filter(Boolean).join(" ").trim()
  return fullName || booking.student.email || "—"
}

function formatBookingStartLabel(booking: BookingWithRelations) {
  const start = new Date(booking.start_time)
  if (Number.isNaN(start.getTime())) return "—"

  const dateLabel = start.toLocaleDateString("en-NZ", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
  const timeLabel = start.toLocaleTimeString("en-NZ", {
    hour: "2-digit",
    minute: "2-digit",
  })
  return `${dateLabel} @ ${timeLabel}`
}

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
  const [categories, setCategories] = React.useState<CancellationCategory[]>([])
  const [categoriesLoading, setCategoriesLoading] = React.useState(false)
  const [categoriesError, setCategoriesError] = React.useState<string | null>(null)
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

  React.useEffect(() => {
    if (!open) return

    const controller = new AbortController()
    setCategoriesLoading(true)
    setCategoriesError(null)

    void fetch("/api/cancellation-categories", {
      method: "GET",
      cache: "no-store",
      headers: { "cache-control": "no-store" },
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          const payload = (await response.json().catch(() => ({}))) as { error?: string }
          throw new Error(payload.error || "Failed to load cancellation categories")
        }

        const payload = (await response.json()) as { categories?: CancellationCategory[] }
        setCategories(payload.categories ?? [])
      })
      .catch((error) => {
        if (controller.signal.aborted) return
        setCategories([])
        setCategoriesError(error instanceof Error ? error.message : "Failed to load cancellation categories")
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setCategoriesLoading(false)
        }
      })

    return () => controller.abort()
  }, [open])

  const selectedCategory = React.useMemo(
    () => categories.find((category) => category.id === cancellationCategoryId) ?? null,
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="overflow-hidden p-0 sm:max-w-[520px]">
        <div className="flex flex-col bg-background">
          <DialogHeader className="border-b px-6 py-5 text-left">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-50 text-red-600">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-foreground">Cancel Booking</DialogTitle>
                <DialogDescription className="mt-0.5 text-sm text-muted-foreground">
                  Please select a cancellation reason before cancelling this booking.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="flex flex-col">
            <div className="space-y-6 px-6 py-5">
              {booking ? (
                <section className="rounded-xl border border-border/70 bg-muted/20 p-4">
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Booking Summary
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Aircraft</span>
                      <span className="font-medium text-foreground">
                        {booking.aircraft?.registration ? `${booking.aircraft.registration} (${booking.aircraft.type})` : "—"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Student</span>
                      <span className="font-medium text-foreground">{formatStudentName(booking)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Date &amp; Time</span>
                      <span className="font-medium text-foreground">{formatBookingStartLabel(booking)}</span>
                    </div>
                  </div>
                </section>
              ) : null}

              <section className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Cancellation Reason <span className="text-destructive">*</span>
                  </Label>
                  {categoriesLoading ? (
                    <div className="flex h-10 items-center rounded-md border border-border bg-muted/20 px-3 text-sm text-muted-foreground">
                      Loading reasons...
                    </div>
                  ) : (
                    <Select
                      value={cancellationCategoryId || undefined}
                      onValueChange={(value) => {
                        setCancellationCategoryId(value)
                        setErrors((prev) => ({ ...prev, cancellationCategoryId: undefined }))
                      }}
                      disabled={pending || Boolean(categoriesError) || categories.length === 0}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue
                          placeholder={categories.length > 0 ? "Select a reason" : "No reasons available"}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {categoriesError ? (
                    <p className="text-xs text-destructive">{categoriesError}</p>
                  ) : null}
                  {errors.cancellationCategoryId ? (
                    <p className="text-xs text-destructive">{errors.cancellationCategoryId}</p>
                  ) : null}
                  {selectedCategory?.description ? (
                    <p className="text-xs text-muted-foreground">{selectedCategory.description}</p>
                  ) : null}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Additional Notes (Optional)
                  </Label>
                  <Textarea
                    rows={4}
                    value={cancelledNotes}
                    onChange={(event) => {
                      setCancelledNotes(event.target.value)
                      setErrors((prev) => ({ ...prev, cancelledNotes: undefined }))
                    }}
                    maxLength={2000}
                    placeholder="Any additional notes..."
                    disabled={pending}
                  />
                  <div className="flex items-center justify-between">
                    {errors.cancelledNotes ? (
                      <p className="text-xs text-destructive">{errors.cancelledNotes}</p>
                    ) : (
                      <span />
                    )}
                    <p className="text-xs text-muted-foreground">{cancelledNotes.length}/2000</p>
                  </div>
                </div>
              </section>
            </div>

            <div className="flex items-center justify-end gap-3 border-t bg-muted/20 px-6 py-4">
              <Button type="button" variant="ghost" disabled={pending} onClick={() => onOpenChange(false)}>
                Close
              </Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={pending || categoriesLoading || Boolean(categoriesError) || categories.length === 0}
              >
                {pending ? "Cancelling..." : "Cancel Booking"}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  )
}
