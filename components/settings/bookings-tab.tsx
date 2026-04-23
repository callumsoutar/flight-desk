"use client"

import * as React from "react"
import * as Tabs from "@radix-ui/react-tabs"
import {
  IconClock,
  IconGift,
  IconListDetails,
  IconLoader2,
  IconPlane,
  IconSettings,
} from "@tabler/icons-react"
import { toast } from "sonner"

import ChargeableSearchDropdown from "@/components/invoices/chargeable-search-dropdown"
import { CancellationCategoriesTab } from "@/components/settings/bookings/cancellation-categories-tab"
import { FlightTypesConfig } from "@/components/settings/bookings/flight-types-config"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { StickyFormActions } from "@/components/ui/sticky-form-actions"
import { Switch } from "@/components/ui/switch"
import { useChargeablesQuery } from "@/hooks/use-chargeables-query"
import { useDefaultTaxRateQuery } from "@/hooks/use-default-tax-rate-query"
import { updateBookingsSettings } from "@/hooks/use-bookings-settings-query"
import type { XeroStatusQueryData } from "@/hooks/use-xero-status-query"
import type { BookingsSettings } from "@/lib/settings/bookings-settings"

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message
  return "Something went wrong."
}

function roundToQuarterHour(value: number) {
  return Math.round(value * 4) / 4
}

function createFormState(settings: BookingsSettings | null) {
  return {
    default_booking_duration_hours: roundToQuarterHour(settings?.default_booking_duration_hours ?? 2),
    minimum_booking_duration_minutes: settings?.minimum_booking_duration_minutes ?? 30,
    default_booking_briefing_charge_enabled: settings?.default_booking_briefing_charge_enabled ?? false,
    default_booking_briefing_chargeable_id: settings?.default_booking_briefing_chargeable_id ?? "",
    aircraft_daily_available_hours: roundToQuarterHour(settings?.aircraft_daily_available_hours ?? 10),
  }
}

const bookingTabs = [
  { id: "defaults", label: "Defaults", icon: IconSettings },
  { id: "flight-types", label: "Flight types", icon: IconPlane },
  { id: "trial-flights", label: "Trial flights", icon: IconGift },
  { id: "cancellations", label: "Cancellation categories", icon: IconListDetails },
] as const

// Contract:
// - the defaults form is server-bootstrapped from `app/settings/page.tsx`
// - nested collection editors can stay client-owned and query-backed
export function BookingsTab({
  initialSettings = null,
  initialLoadError = null,
  initialXeroStatus,
}: {
  initialSettings?: BookingsSettings | null
  initialLoadError?: string | null
  initialXeroStatus: XeroStatusQueryData
}) {
  const [activeTab, setActiveTab] =
    React.useState<(typeof bookingTabs)[number]["id"]>("defaults")
  const [loadError, setLoadError] = React.useState<string | null>(initialLoadError)
  const [isSaving, setIsSaving] = React.useState(false)
  const [baseSettings, setBaseSettings] = React.useState<BookingsSettings | null>(initialSettings)
  const [form, setForm] = React.useState(() => createFormState(initialSettings))
  const tabRefs = React.useRef<Record<string, HTMLButtonElement | null>>({})
  const tabsListRef = React.useRef<HTMLDivElement>(null)
  const [underlineStyle, setUnderlineStyle] = React.useState({ left: 0, width: 0 })
  const [showScrollLeft, setShowScrollLeft] = React.useState(false)
  const [showScrollRight, setShowScrollRight] = React.useState(false)
  const [chargeablesLoadError, setChargeablesLoadError] = React.useState<string | null>(null)
  const {
    data: chargeables = [],
    isLoading: chargeablesLoading,
    error: chargeablesQueryError,
  } = useChargeablesQuery({ includeInactive: true, pageSize: 100 })
  const { data: taxRate = 0.15 } = useDefaultTaxRateQuery()

  React.useEffect(() => {
    if (!chargeablesQueryError) {
      setChargeablesLoadError(null)
      return
    }
    setChargeablesLoadError(getErrorMessage(chargeablesQueryError))
  }, [chargeablesQueryError])

  React.useEffect(() => {
    setBaseSettings(initialSettings)
    setForm(createFormState(initialSettings))
    setLoadError(initialLoadError)
  }, [initialLoadError, initialSettings])

  const baseForm = React.useMemo(() => createFormState(baseSettings), [baseSettings])

  const dirty =
    roundToQuarterHour(form.default_booking_duration_hours) !==
      roundToQuarterHour(baseForm.default_booking_duration_hours) ||
    form.minimum_booking_duration_minutes !== baseForm.minimum_booking_duration_minutes ||
    form.default_booking_briefing_charge_enabled !== baseForm.default_booking_briefing_charge_enabled ||
    form.default_booking_briefing_chargeable_id !== baseForm.default_booking_briefing_chargeable_id ||
    roundToQuarterHour(form.aircraft_daily_available_hours) !==
      roundToQuarterHour(baseForm.aircraft_daily_available_hours)

  const onUndo = () => setForm(baseForm)

  const onSave = async () => {
    if (form.default_booking_briefing_charge_enabled && !form.default_booking_briefing_chargeable_id) {
      toast.error("Select a default briefing chargeable before enabling this setting")
      return
    }

    setIsSaving(true)
    try {
      const result = await updateBookingsSettings({
        bookings: {
          default_booking_duration_hours: roundToQuarterHour(form.default_booking_duration_hours),
          minimum_booking_duration_minutes: form.minimum_booking_duration_minutes,
          default_booking_briefing_charge_enabled: form.default_booking_briefing_charge_enabled,
          default_booking_briefing_chargeable_id: form.default_booking_briefing_chargeable_id || null,
          aircraft_daily_available_hours: roundToQuarterHour(form.aircraft_daily_available_hours),
        },
      })
      setBaseSettings(result.settings)
      setForm(createFormState(result.settings))
      toast.success("Booking settings saved")
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

  if (loadError) {
    return (
      <div className="space-y-1 py-2">
        <h3 className="text-lg font-semibold text-slate-900">Bookings</h3>
        <p className="text-sm text-muted-foreground">{loadError}</p>
      </div>
    )
  }

  if (!baseSettings) {
    return (
      <div className="space-y-1 py-2">
        <h3 className="text-lg font-semibold text-slate-900">Bookings</h3>
        <p className="text-sm text-muted-foreground">Booking settings are not available yet for this tenant.</p>
      </div>
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
            Configure booking defaults, dual and solo flight types, trial experiences, and cancellation metadata.
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
            <div className="w-full min-w-0 space-y-6">
              <div className="space-y-1">
                <h3 className="text-lg font-semibold text-slate-900">Booking defaults</h3>
                <p className="text-sm text-muted-foreground">Defaults that apply when creating new bookings.</p>
              </div>

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

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="aircraft-daily-available-hours" className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Aircraft Daily Available Hours
                  </Label>
                  <Input
                    id="aircraft-daily-available-hours"
                    type="number"
                    min={1}
                    max={24}
                    step={0.5}
                    value={form.aircraft_daily_available_hours}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        aircraft_daily_available_hours: Number.parseFloat(e.target.value) || 1,
                      }))
                    }
                    className="h-11 rounded-xl border-slate-200 bg-white sm:max-w-xs"
                  />
                  <p className="text-[11px] font-medium text-slate-500">
                    Used to calculate aircraft utilisation rate. Represents the total hours per day each aircraft
                    is available for flying (e.g. 10 hours/day). Utilisation = hours flown ÷ (this value ×
                    operating days).
                  </p>
                </div>
              </div>

              <div className="space-y-4 border-t border-slate-200 pt-5">
                <div className="space-y-1">
                  <h3 className="text-lg font-semibold text-slate-900">Default briefing charge</h3>
                  <p className="text-sm text-muted-foreground">
                    When enabled, completed booking briefings add the selected chargeable by default during check-in.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1 pr-4">
                      <Label
                        htmlFor="default-booking-briefing-charge-enabled"
                        className="text-xs font-bold uppercase tracking-wider text-slate-500"
                      >
                        Enable automatic briefing charge
                      </Label>
                      <p className="text-[11px] font-medium text-slate-500">
                        If disabled, no briefing charge is added when briefing is completed.
                      </p>
                    </div>
                    <Switch
                      id="default-booking-briefing-charge-enabled"
                      checked={form.default_booking_briefing_charge_enabled}
                      onCheckedChange={(checked) =>
                        setForm((prev) => ({
                          ...prev,
                          default_booking_briefing_charge_enabled: checked,
                        }))
                      }
                    />
                  </div>

                  <div className="grid gap-2 sm:max-w-xl">
                    <Label
                      htmlFor="default-booking-briefing-chargeable"
                      className="text-xs font-bold uppercase tracking-wider text-slate-500"
                    >
                      Briefing chargeable
                    </Label>
                    {chargeablesLoading ? (
                      <div className="flex h-11 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-500">
                        <IconLoader2 className="h-4 w-4 animate-spin text-slate-400" />
                        Loading chargeables…
                      </div>
                    ) : chargeablesLoadError ? (
                      <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                        {chargeablesLoadError}
                      </div>
                    ) : (
                      <div id="default-booking-briefing-chargeable">
                        <ChargeableSearchDropdown
                          chargeables={chargeables}
                          value={form.default_booking_briefing_chargeable_id}
                          taxRate={taxRate}
                          disabled={!form.default_booking_briefing_charge_enabled}
                          onSelect={(chargeable) =>
                            setForm((prev) => ({
                              ...prev,
                              default_booking_briefing_chargeable_id: chargeable?.id ?? "",
                            }))
                          }
                          placeholder="Select a chargeable"
                        />
                      </div>
                    )}
                    <p className="text-[11px] font-medium text-slate-500">
                      Search and choose the chargeable used for preflight briefing charges on check-in.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </Tabs.Content>

          <Tabs.Content value="flight-types" className="outline-none">
            <div className="w-full min-w-0">
              <FlightTypesConfig initialXeroStatus={initialXeroStatus} scope="dual_solo" />
            </div>
          </Tabs.Content>

          <Tabs.Content value="trial-flights" className="outline-none">
            <div className="w-full min-w-0">
              <FlightTypesConfig initialXeroStatus={initialXeroStatus} scope="trial" />
            </div>
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
          message="You have unsaved booking settings changes."
          saveLabel="Save booking settings"
        />
      ) : null}
    </div>
  )
}
