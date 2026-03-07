"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import * as Tabs from "@radix-ui/react-tabs"
import { IconClock, IconListDetails, IconLoader2, IconSettings } from "@tabler/icons-react"
import { toast } from "sonner"

import { CancellationCategoriesTab } from "@/components/settings/bookings/cancellation-categories-tab"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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

const bookingTabs = [
  { id: "defaults", label: "Defaults", icon: IconSettings },
  { id: "cancellations", label: "Cancellation categories", icon: IconListDetails },
] as const

export function BookingsTab() {
  const router = useRouter()
  const [activeTab, setActiveTab] =
    React.useState<(typeof bookingTabs)[number]["id"]>("defaults")
  const [loading, setLoading] = React.useState(true)
  const [loadError, setLoadError] = React.useState<string | null>(null)
  const [isSaving, setIsSaving] = React.useState(false)
  const [baseSettings, setBaseSettings] = React.useState<BookingsSettings | null>(null)
  const [form, setForm] = React.useState(() => createFormState(null))
  const tabRefs = React.useRef<Record<string, HTMLButtonElement | null>>({})
  const tabsListRef = React.useRef<HTMLDivElement>(null)
  const [underlineStyle, setUnderlineStyle] = React.useState({ left: 0, width: 0 })
  const [showScrollLeft, setShowScrollLeft] = React.useState(false)
  const [showScrollRight, setShowScrollRight] = React.useState(false)

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

  React.useEffect(() => {
    const activeElement = tabRefs.current[activeTab]
    if (activeElement && tabsListRef.current) {
      const listRect = tabsListRef.current.getBoundingClientRect()
      const activeRect = activeElement.getBoundingClientRect()
      setUnderlineStyle({
        left: activeRect.left - listRect.left,
        width: activeRect.width,
      })
    }
  }, [activeTab])

  React.useEffect(() => {
    const checkScroll = () => {
      if (!tabsListRef.current) return
      const { scrollLeft, scrollWidth, clientWidth } = tabsListRef.current
      setShowScrollLeft(scrollLeft > 0)
      setShowScrollRight(scrollLeft + clientWidth < scrollWidth)
    }

    checkScroll()
    const listElement = tabsListRef.current
    listElement?.addEventListener("scroll", checkScroll)
    window.addEventListener("resize", checkScroll)
    return () => {
      listElement?.removeEventListener("scroll", checkScroll)
      window.removeEventListener("resize", checkScroll)
    }
  }, [])

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
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground">
            Configure booking defaults and cancellation metadata.
          </p>
        </div>
      </div>

      <Tabs.Root
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as typeof activeTab)}
        className="flex w-full flex-col"
      >
        <div className="relative -mx-4 border-b border-slate-200 px-4 pb-1 pt-2 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <div className="relative flex items-center">
            {showScrollLeft ? (
              <div className="pointer-events-none absolute top-0 bottom-0 left-0 z-10 w-8 bg-gradient-to-r from-muted/30 to-transparent" />
            ) : null}
            {showScrollRight ? (
              <div className="pointer-events-none absolute top-0 right-0 bottom-0 z-10 w-8 bg-gradient-to-l from-muted/30 to-transparent" />
            ) : null}

            <div className="w-full overflow-x-auto scrollbar-hide scroll-smooth">
              <Tabs.List
                ref={tabsListRef}
                className="relative flex min-h-[44px] min-w-max flex-row gap-1"
                aria-label="Booking settings categories"
              >
                <div
                  className="absolute bottom-0 h-0.5 bg-indigo-700 transition-all duration-300 ease-out"
                  style={{
                    left: `${underlineStyle.left}px`,
                    width: `${underlineStyle.width}px`,
                  }}
                />
                {bookingTabs.map((tab) => {
                  const Icon = tab.icon
                  return (
                    <Tabs.Trigger
                      key={tab.id}
                      ref={(el) => {
                        tabRefs.current[tab.id] = el
                      }}
                      value={tab.id}
                      className="inline-flex min-h-[44px] min-w-[44px] flex-shrink-0 cursor-pointer touch-manipulation items-center gap-2 border-b-2 border-transparent px-3 py-2.5 pb-1 text-sm font-semibold whitespace-nowrap text-slate-600 transition-all duration-200 hover:text-indigo-600 data-[state=active]:text-indigo-800"
                      style={{ background: "none", boxShadow: "none", borderRadius: 0 }}
                    >
                      <Icon className="h-4 w-4 flex-shrink-0" />
                      <span>{tab.label}</span>
                    </Tabs.Trigger>
                  )
                })}
              </Tabs.List>
            </div>
          </div>
        </div>

        <div className="w-full pt-6">
          <Tabs.Content value="defaults" className="outline-none">
            <Card className="border border-border/50 bg-card shadow-sm overflow-hidden rounded-2xl">
              <CardHeader className="border-b border-border/40">
                <div className="space-y-1">
                  <CardTitle className="text-lg text-slate-900">Booking defaults</CardTitle>
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
              </CardContent>
            </Card>
          </Tabs.Content>

          <Tabs.Content value="cancellations" className="outline-none">
            <CancellationCategoriesTab />
          </Tabs.Content>
        </div>
      </Tabs.Root>

      {activeTab === "defaults" ? (
        <StickyFormActions
          isDirty={dirty}
          isSaving={isSaving}
          isSaveDisabled={!dirty || isSaving}
          onUndo={onUndo}
          onSave={onSave}
          message="You have unsaved booking duration changes."
          saveLabel="Save booking settings"
        />
      ) : null}
    </div>
  )
}
