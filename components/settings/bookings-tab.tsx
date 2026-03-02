"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { IconClock, IconLoader2 } from "@tabler/icons-react"
import { toast } from "sonner"

import { CancellationCategoriesConfig } from "@/components/settings/bookings/cancellation-categories-config"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { StickyFormActions } from "@/components/ui/sticky-form-actions"
import type { BookingsSettings } from "@/lib/settings/bookings-settings"

type BookingsSettingsResponse = { settings: BookingsSettings }

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message
  return "Something went wrong."
}

async function fetchBookingsSettings(signal?: AbortSignal): Promise<BookingsSettingsResponse> {
  const response = await fetch("/api/settings/bookings", { cache: "no-store", signal })
  if (!response.ok) {
    const data = await response.json().catch(() => null)
    const message =
      data && typeof data === "object" && typeof data.error === "string"
        ? data.error
        : "Failed to load booking settings"
    throw new Error(message)
  }

  return (await response.json()) as BookingsSettingsResponse
}

async function patchBookingsSettings(payload: unknown): Promise<BookingsSettingsResponse> {
  const response = await fetch("/api/settings/bookings", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const data = await response.json().catch(() => null)
    const message =
      data && typeof data === "object" && typeof data.error === "string"
        ? data.error
        : "Failed to update booking settings"
    throw new Error(message)
  }

  return (await response.json()) as BookingsSettingsResponse
}

function roundToQuarterHour(value: number) {
  return Math.round(value * 4) / 4
}

function createFormState(settings: BookingsSettings | null) {
  return {
    default_booking_duration_hours: roundToQuarterHour(settings?.default_booking_duration_hours ?? 2),
    minimum_booking_duration_minutes: settings?.minimum_booking_duration_minutes ?? 30,
  }
}

export function BookingsTab() {
  const router = useRouter()
  const [loading, setLoading] = React.useState(true)
  const [loadError, setLoadError] = React.useState<string | null>(null)
  const [isSaving, setIsSaving] = React.useState(false)
  const [baseSettings, setBaseSettings] = React.useState<BookingsSettings | null>(null)
  const [form, setForm] = React.useState(() => createFormState(null))

  React.useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setLoadError(null)

    void fetchBookingsSettings(controller.signal)
      .then((result) => {
        setBaseSettings(result.settings)
        setForm(createFormState(result.settings))
      })
      .catch((error) => {
        if (controller.signal.aborted) return
        setLoadError(getErrorMessage(error))
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [])

  const baseForm = React.useMemo(() => createFormState(baseSettings), [baseSettings])

  const dirty =
    roundToQuarterHour(form.default_booking_duration_hours) !==
      roundToQuarterHour(baseForm.default_booking_duration_hours) ||
    form.minimum_booking_duration_minutes !== baseForm.minimum_booking_duration_minutes

  const onUndo = () => setForm(baseForm)

  const onSave = async () => {
    setIsSaving(true)
    try {
      const result = await patchBookingsSettings({
        bookings: {
          default_booking_duration_hours: roundToQuarterHour(form.default_booking_duration_hours),
          minimum_booking_duration_minutes: form.minimum_booking_duration_minutes,
        },
      })
      setBaseSettings(result.settings)
      setForm(createFormState(result.settings))
      toast.success("Booking settings saved")
      router.refresh()
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setIsSaving(false)
    }
  }

  if (loading) {
    return (
      <Card className="border border-border/50 bg-card shadow-sm">
        <CardContent className="flex items-center justify-center gap-2 py-12 text-slate-600">
          <IconLoader2 className="h-5 w-5 animate-spin text-slate-400" />
          <span className="text-sm font-medium">Loading booking settings…</span>
        </CardContent>
      </Card>
    )
  }

  if (loadError) {
    return (
      <Card className="border border-border/50 bg-card shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg text-slate-900">Bookings</CardTitle>
          <CardDescription>{loadError}</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold tracking-tight text-slate-900">Bookings</h2>
            {dirty ? (
              <Badge className="border-amber-200 bg-amber-50 text-amber-700" variant="outline">
                Unsaved changes
              </Badge>
            ) : (
              <Badge className="border-slate-200 bg-white text-slate-600" variant="outline">
                Up to date
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Configure booking defaults and cancellation metadata.
          </p>
        </div>
      </div>

      <Card className="border border-border/50 bg-card shadow-sm overflow-hidden rounded-2xl">
        <CardHeader className="border-b border-border/40">
          <div className="space-y-1">
            <CardTitle className="text-lg text-slate-900">Booking duration</CardTitle>
            <CardDescription>
              Defaults that apply when creating new bookings.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <IconClock className="h-4 w-4 text-slate-500" />
            Duration defaults
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="default-booking-duration" className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Default duration (hours)
              </Label>
              <Input
                id="default-booking-duration"
                type="number"
                min={0}
                step={0.5}
                value={form.default_booking_duration_hours}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    default_booking_duration_hours: Number.parseFloat(e.target.value) || 0,
                  }))
                }
                className="h-11 rounded-xl border-slate-200 bg-white"
              />
              <p className="text-[11px] font-medium text-slate-500">
                Used to prefill the end time when staff create bookings.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="minimum-booking-duration" className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Minimum duration (minutes)
              </Label>
              <Input
                id="minimum-booking-duration"
                type="number"
                min={0}
                step={5}
                value={form.minimum_booking_duration_minutes}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    minimum_booking_duration_minutes: Number.parseInt(e.target.value, 10) || 0,
                  }))
                }
                className="h-11 rounded-xl border-slate-200 bg-white"
              />
              <p className="text-[11px] font-medium text-slate-500">
                Helps prevent very short bookings from being created accidentally.
              </p>
            </div>
          </div>

          <Separator />
          <CancellationCategoriesConfig />
        </CardContent>
      </Card>

      <StickyFormActions
        isDirty={dirty}
        isSaving={isSaving}
        isSaveDisabled={!dirty || isSaving}
        onUndo={onUndo}
        onSave={onSave}
        message="You have unsaved booking duration changes."
        saveLabel="Save booking settings"
      />
    </div>
  )
}
