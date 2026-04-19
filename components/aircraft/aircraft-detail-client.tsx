"use client"

import * as React from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { Tabs } from "radix-ui"
import {
  IconAlertTriangle,
  IconArrowLeft,
  IconCalendarStats,
  IconChartBar,
  IconClockHour4,
  IconGauge,
  IconHistory,
  IconPlane,
  IconSettings,
  IconTool,
} from "@tabler/icons-react"

import { AircraftOverviewTab } from "@/components/aircraft/aircraft-overview-tab"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import {
  Tabs as InnerTabs,
  TabsContent as InnerTabsContent,
  TabsList as InnerTabsList,
  TabsTrigger as InnerTabsTrigger,
} from "@/components/ui/tabs"
import type { AircraftDetailData } from "@/lib/types/aircraft-detail"

const AircraftTechLogTab = dynamic(
  () => import("@/components/aircraft/aircraft-tech-log-tab").then((mod) => mod.AircraftTechLogTab),
  { ssr: false }
)

const AircraftFlightHistoryTab = dynamic(
  () =>
    import("@/components/aircraft/aircraft-flight-history-tab").then(
      (mod) => mod.AircraftFlightHistoryTab
    ),
  { ssr: false }
)

const AircraftUpcomingBookingsTab = dynamic(
  () =>
    import("@/components/aircraft/aircraft-upcoming-bookings-tab").then(
      (mod) => mod.AircraftUpcomingBookingsTab
    ),
  { ssr: false }
)

const AircraftObservationsTab = dynamic(
  () =>
    import("@/components/aircraft/aircraft-observations-tab").then(
      (mod) => mod.AircraftObservationsTab
    ),
  { ssr: false }
)

const AircraftMaintenanceItemsTab = dynamic(
  () =>
    import("@/components/aircraft/aircraft-maintenance-items-tab").then(
      (mod) => mod.AircraftMaintenanceItemsTab
    ),
  { ssr: false }
)

const AircraftMaintenanceHistoryTab = dynamic(
  () =>
    import("@/components/aircraft/aircraft-maintenance-history-tab").then(
      (mod) => mod.AircraftMaintenanceHistoryTab
    ),
  { ssr: false }
)

const AircraftSettingsTab = dynamic(
  () =>
    import("@/components/aircraft/aircraft-settings-tab").then((mod) => mod.AircraftSettingsTab),
  { ssr: false }
)

function formatTotalHours(hours: number | null | undefined): string {
  if (hours === null || hours === undefined) return "0.0h"
  return `${hours.toFixed(1)}h`
}

type Props = {
  aircraftId: string
  data: AircraftDetailData
  loadErrors?: string[]
  canVoidAircraft?: boolean
}

const tabItems = [
  { id: "overview", label: "Overview", icon: IconChartBar },
  { id: "upcoming-bookings", label: "Upcoming Bookings", icon: IconCalendarStats },
  { id: "tech-log", label: "Tech Log", icon: IconGauge },
  { id: "flight-history", label: "Flight History", icon: IconHistory },
  { id: "observations", label: "Observations", icon: IconAlertTriangle },
  { id: "maintenance", label: "Maintenance", icon: IconTool },
  { id: "settings", label: "Settings", icon: IconSettings },
] as const

type TabId = (typeof tabItems)[number]["id"]

export function AircraftDetailClient({
  aircraftId,
  data,
  loadErrors = [],
  canVoidAircraft = false,
}: Props) {
  const [activeTab, setActiveTab] = React.useState<TabId>("overview")
  const [underlineStyle, setUnderlineStyle] = React.useState({ left: 0, width: 0 })
  const tabRefs = React.useRef<Record<string, HTMLButtonElement | null>>({})
  const tabsListRef = React.useRef<HTMLDivElement>(null)
  const [showScrollLeft, setShowScrollLeft] = React.useState(false)
  const [showScrollRight, setShowScrollRight] = React.useState(false)

  const {
    flights,
    observations,
    components,
    maintenanceVisits,
    upcomingBookings,
    upcomingMaintenance,
  } = data
  const [aircraft, setAircraft] = React.useState(data.aircraft)

  React.useEffect(() => {
    setAircraft(data.aircraft)
  }, [data.aircraft])

  const registration = aircraft.registration || ""
  const model = aircraft.model || ""
  const imageUrl = aircraft.aircraft_image_url
  const availableForBookings = aircraft.on_line ?? true
  const totalHours = aircraft.total_time_in_service || 0

  const activeObservations = observations.filter((o) => !o.resolved_at).length
  const overdueComponents = components.filter((c) => {
    if (!c.current_due_date && !c.current_due_hours) return false
    if (c.current_due_date) {
      return new Date(c.current_due_date) < new Date()
    }
    if (c.current_due_hours !== null && c.current_due_hours !== undefined) {
      return aircraft.total_time_in_service >= c.current_due_hours
    }
    return false
  }).length

  React.useEffect(() => {
    const activeTabElement = tabRefs.current[activeTab]
    const tabsList = tabsListRef.current

    if (activeTabElement && tabsList) {
      const tabsListRect = tabsList.getBoundingClientRect()
      const activeTabRect = activeTabElement.getBoundingClientRect()

      setUnderlineStyle({
        left: activeTabRect.left - tabsListRect.left,
        width: activeTabRect.width,
      })

      if (window.innerWidth < 768) {
        const scrollLeft = tabsList.scrollLeft
        const tabLeft = activeTabRect.left - tabsListRect.left
        const tabWidth = activeTabRect.width
        const containerWidth = tabsListRect.width

        const targetScroll =
          scrollLeft + tabLeft - containerWidth / 2 + tabWidth / 2

        tabsList.scrollTo({
          left: Math.max(0, targetScroll),
          behavior: "smooth",
        })
      }
    }
  }, [activeTab])

  React.useEffect(() => {
    const timer = setTimeout(() => {
      const activeTabElement = tabRefs.current[activeTab]
      const tabsList = tabsListRef.current

      if (activeTabElement && tabsList) {
        const tabsListRect = tabsList.getBoundingClientRect()
        const activeTabRect = activeTabElement.getBoundingClientRect()

        setUnderlineStyle({
          left: activeTabRect.left - tabsListRect.left,
          width: activeTabRect.width,
        })
      }
    }, 100)

    return () => clearTimeout(timer)
  }, [activeTab])

  React.useEffect(() => {
    const tabsList = tabsListRef.current
    if (!tabsList) return

    const checkScroll = () => {
      const { scrollLeft, scrollWidth, clientWidth } = tabsList
      setShowScrollLeft(scrollLeft > 0)
      setShowScrollRight(scrollLeft < scrollWidth - clientWidth - 1)
    }

    checkScroll()
    tabsList.addEventListener("scroll", checkScroll)
    window.addEventListener("resize", checkScroll)

    return () => {
      tabsList.removeEventListener("scroll", checkScroll)
      window.removeEventListener("resize", checkScroll)
    }
  }, [activeTab])

  return (
    <div className="flex flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-8 sm:px-6 lg:px-8">
        <Link
          href="/aircraft"
          className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <IconArrowLeft className="h-4 w-4" />
          Back to Aircraft
        </Link>

        {loadErrors.length ? (
          <p className="mb-4 text-sm text-amber-700">
            Some sections failed to load: {loadErrors.join(", ")}
          </p>
        ) : null}

        <Card className="mb-6 overflow-hidden border-border/60 bg-card py-0 shadow-none">
          <CardContent className="p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-center gap-4">
                <div className="relative">
                  <Avatar className="h-14 w-14 border border-border bg-muted">
                    {imageUrl ? <AvatarImage src={imageUrl} alt={registration} /> : null}
                    <AvatarFallback className="bg-muted text-muted-foreground">
                      <IconPlane className="h-6 w-6" strokeWidth={1.25} />
                    </AvatarFallback>
                  </Avatar>
                  <span
                    aria-hidden
                    className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-card ${
                      availableForBookings ? "bg-emerald-500" : "bg-amber-500"
                    }`}
                  />
                </div>
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                    <h1 className="truncate text-[22px] font-semibold leading-tight tracking-tight text-foreground">
                      {registration || "Unknown aircraft"}
                    </h1>
                    {aircraft.aircraft_type?.name ? (
                      <span className="font-mono text-xs text-muted-foreground">
                        {aircraft.aircraft_type.name}
                      </span>
                    ) : null}
                  </div>
                  <p className="truncate text-sm text-muted-foreground">
                    {model || "Aircraft"}
                  </p>
                </div>
              </div>

              <Badge
                variant="outline"
                className="hidden h-7 shrink-0 items-center gap-1.5 rounded-full px-2.5 font-normal text-foreground sm:inline-flex"
              >
                <span
                  aria-hidden
                  className={`h-1.5 w-1.5 rounded-full ${
                    availableForBookings ? "bg-emerald-500" : "bg-amber-500"
                  }`}
                />
                {availableForBookings ? "Available" : "Not available"}
              </Badge>
            </div>

            <Separator className="my-5" />

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-2">
                <IconClockHour4 className="h-4 w-4 text-muted-foreground/70" />
                <span>
                  Total time{" "}
                  <span className="font-mono text-foreground">
                    {formatTotalHours(totalHours)}
                  </span>
                </span>
              </span>
              {activeObservations > 0 ? (
                <span className="inline-flex items-center gap-2">
                  <IconAlertTriangle className="h-4 w-4 text-amber-500" />
                  <span>
                    <span className="text-foreground">{activeObservations}</span> active{" "}
                    {activeObservations === 1 ? "observation" : "observations"}
                  </span>
                </span>
              ) : null}
              {overdueComponents > 0 ? (
                <span className="inline-flex items-center gap-2">
                  <IconTool className="h-4 w-4 text-rose-500" />
                  <span>
                    <span className="text-foreground">{overdueComponents}</span> overdue{" "}
                    {overdueComponents === 1 ? "item" : "items"}
                  </span>
                </span>
              ) : null}
              <span className="inline-flex items-center gap-2">
                <IconGauge className="h-4 w-4 text-muted-foreground/70" />
                <span>
                  {availableForBookings
                    ? "Available for bookings"
                    : "Not available for bookings"}
                </span>
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/50 bg-card py-0 shadow-sm">
          <CardContent className="p-0">
            <Tabs.Root
              value={activeTab}
              onValueChange={(value: string) => setActiveTab(value as TabId)}
              className="flex w-full min-w-0 flex-col"
            >
              <div className="relative w-full min-w-0 overflow-hidden border-b border-gray-200 bg-white">
                <div className="px-4 pt-3 pb-3 md:hidden">
                  <Select value={activeTab} onValueChange={(value) => setActiveTab(value as TabId)}>
                    <SelectTrigger className="h-11 w-full border-2 border-gray-300 hover:border-indigo-400 focus:border-indigo-500">
                      <SelectValue>
                        {(() => {
                          const activeTabItem = tabItems.find((tab) => tab.id === activeTab)
                          const Icon = activeTabItem?.icon || IconChartBar
                          return (
                            <div className="flex items-center gap-2">
                              <Icon className="h-4 w-4 text-indigo-600" />
                              <span className="font-medium">
                                {activeTabItem?.label || "Select tab"}
                              </span>
                            </div>
                          )
                        })()}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {tabItems.map((tab) => {
                        const Icon = tab.icon
                        const isCurrent = activeTab === tab.id
                        return (
                          <SelectItem
                            key={tab.id}
                            value={tab.id}
                            className={isCurrent ? "bg-indigo-50" : ""}
                          >
                            <div className="flex items-center gap-2">
                              <Icon
                                className={`h-4 w-4 ${
                                  isCurrent ? "text-indigo-600" : "text-gray-500"
                                }`}
                              />
                              <span
                                className={
                                  isCurrent ? "font-semibold text-indigo-900" : ""
                                }
                              >
                                {tab.label}
                              </span>
                            </div>
                          </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
                </div>

                <div className="relative hidden min-w-0 items-center px-6 pt-2 md:flex">
                  {showScrollLeft ? (
                    <div className="pointer-events-none absolute top-0 bottom-0 left-0 z-10 w-8 bg-gradient-to-r from-white to-transparent" />
                  ) : null}
                  {showScrollRight ? (
                    <div className="pointer-events-none absolute top-0 right-0 bottom-0 z-10 w-8 bg-gradient-to-l from-white to-transparent" />
                  ) : null}
                  <div className="scrollbar-hide flex w-full min-w-0 items-center overflow-x-auto scroll-smooth">
                    <Tabs.List
                      ref={tabsListRef}
                      className="relative flex min-h-[48px] min-w-max flex-row gap-1"
                      aria-label="Aircraft tabs"
                    >
                      <div
                        className="absolute bottom-0 h-0.5 bg-indigo-700 transition-all duration-300 ease-out"
                        style={{
                          left: `${underlineStyle.left}px`,
                          width: `${underlineStyle.width}px`,
                        }}
                      />
                      {tabItems.map((tab) => {
                        const Icon = tab.icon
                        return (
                          <Tabs.Trigger
                            key={tab.id}
                            ref={(el: HTMLButtonElement | null) => {
                              tabRefs.current[tab.id] = el
                            }}
                            value={tab.id}
                            className="inline-flex min-h-[48px] min-w-[44px] flex-shrink-0 touch-manipulation cursor-pointer items-center gap-2 border-b-2 border-transparent bg-none px-4 py-3 pb-1 text-base font-medium whitespace-nowrap text-gray-500 transition-all duration-200 hover:text-indigo-600 focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none active:bg-gray-50 data-[state=active]:text-indigo-800"
                            style={{ boxShadow: "none", borderRadius: 0 }}
                            aria-label={`${tab.label} tab`}
                            role="tab"
                            aria-selected={activeTab === tab.id}
                          >
                            <Icon className="h-5 w-5 flex-shrink-0" />
                            <span>{tab.label}</span>
                          </Tabs.Trigger>
                        )
                      })}
                    </Tabs.List>
                  </div>
                </div>
              </div>

              <div className="w-full p-4 sm:p-6">
                <Tabs.Content value="overview">
                  <AircraftOverviewTab
                    aircraft={aircraft}
                    flights={flights}
                    observations={observations}
                    components={components}
                    activeObservations={activeObservations}
                    overdueComponents={overdueComponents}
                  />
                </Tabs.Content>

                <Tabs.Content value="upcoming-bookings">
                  <AircraftUpcomingBookingsTab
                    aircraft={aircraft}
                    upcomingBookings={upcomingBookings}
                    upcomingMaintenance={upcomingMaintenance}
                    components={components}
                  />
                </Tabs.Content>

                <Tabs.Content value="flight-history">
                  <AircraftFlightHistoryTab flights={flights} />
                </Tabs.Content>

                <Tabs.Content value="tech-log">
                  <AircraftTechLogTab aircraftId={aircraftId} aircraft={aircraft} />
                </Tabs.Content>

                <Tabs.Content value="observations">
                  <AircraftObservationsTab aircraftId={aircraftId} observations={observations} />
                </Tabs.Content>

                <Tabs.Content value="maintenance">
                  <InnerTabs defaultValue="items" className="w-full">
                    <InnerTabsList variant="line" className="mb-4 h-9 gap-2">
                      <InnerTabsTrigger value="items" className="px-3 text-sm">
                        <IconTool className="h-4 w-4" />
                        Maintenance Items
                      </InnerTabsTrigger>
                      <InnerTabsTrigger value="history" className="px-3 text-sm">
                        <IconHistory className="h-4 w-4" />
                        Maintenance History
                      </InnerTabsTrigger>
                    </InnerTabsList>
                    <InnerTabsContent value="items" className="mt-2">
                      <AircraftMaintenanceItemsTab components={components} aircraft={aircraft} />
                    </InnerTabsContent>
                    <InnerTabsContent value="history" className="mt-2">
                      <AircraftMaintenanceHistoryTab
                        aircraftId={aircraftId}
                        initialVisits={maintenanceVisits}
                      />
                    </InnerTabsContent>
                  </InnerTabs>
                </Tabs.Content>

                <Tabs.Content value="settings">
                  <AircraftSettingsTab
                    aircraft={aircraft}
                    aircraftId={aircraftId}
                    canVoidAircraft={canVoidAircraft}
                    onSaved={(updatedAircraft) => setAircraft(updatedAircraft)}
                  />
                </Tabs.Content>
              </div>
            </Tabs.Root>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
