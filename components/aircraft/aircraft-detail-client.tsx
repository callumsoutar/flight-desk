"use client"

import * as React from "react"
import Link from "next/link"
import { Tabs } from "radix-ui"
import {
  IconAlertTriangle,
  IconArrowLeft,
  IconChartBar,
  IconHistory,
  IconSettings,
  IconTool,
} from "@tabler/icons-react"

import { AircraftFlightHistoryTab } from "@/components/aircraft/aircraft-flight-history-tab"
import { AircraftMaintenanceHistoryTab } from "@/components/aircraft/aircraft-maintenance-history-tab"
import { AircraftMaintenanceItemsTab } from "@/components/aircraft/aircraft-maintenance-items-tab"
import { AircraftObservationsTab } from "@/components/aircraft/aircraft-observations-tab"
import { AircraftOverviewTab } from "@/components/aircraft/aircraft-overview-tab"
import { AircraftSettingsTab } from "@/components/aircraft/aircraft-settings-tab"
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
import type { AircraftDetailData } from "@/lib/types/aircraft-detail"

function formatTotalHours(hours: number | null | undefined): string {
  if (hours === null || hours === undefined) return "0.0h"
  return `${hours.toFixed(1)}h`
}

type Props = {
  aircraftId: string
  data: AircraftDetailData
  loadErrors?: string[]
}

const tabItems = [
  { id: "overview", label: "Overview", icon: IconChartBar },
  { id: "flight-history", label: "Flight History", icon: IconHistory },
  { id: "observations", label: "Observations", icon: IconAlertTriangle },
  { id: "maintenance-items", label: "Maintenance Items", icon: IconTool },
  { id: "maintenance-history", label: "Maintenance History", icon: IconHistory },
  { id: "settings", label: "Settings", icon: IconSettings },
] as const

type TabId = (typeof tabItems)[number]["id"]

export function AircraftDetailClient({ aircraftId, data, loadErrors = [] }: Props) {
  const [activeTab, setActiveTab] = React.useState<TabId>("overview")
  const [underlineStyle, setUnderlineStyle] = React.useState({ left: 0, width: 0 })
  const tabRefs = React.useRef<Record<string, HTMLButtonElement | null>>({})
  const tabsListRef = React.useRef<HTMLDivElement>(null)
  const [showScrollLeft, setShowScrollLeft] = React.useState(false)
  const [showScrollRight, setShowScrollRight] = React.useState(false)

  const { aircraft, flights, observations, components, maintenanceVisits } = data

  const registration = aircraft.registration || ""
  const model = aircraft.model || ""
  const type = aircraft.type || ""
  const imageUrl = aircraft.aircraft_image_url
  const status = aircraft.status || "active"
  const isActive = status.toLowerCase() === "active"
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

        <Card className="mb-6 border border-border/50 bg-card py-0 shadow-sm">
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-col gap-4 sm:gap-6 md:flex-row md:items-start md:justify-between">
              <div className="flex items-start gap-4">
                <Avatar className="h-20 w-20 rounded-full border-2 border-gray-200 bg-gray-100">
                  {imageUrl ? <AvatarImage src={imageUrl} alt={registration} /> : null}
                  <AvatarFallback className="bg-gray-100 text-xl font-bold text-gray-600">
                    {registration ? registration.substring(0, 2).toUpperCase() : "??"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="mb-2 flex items-center gap-3">
                    <h1 className="text-2xl font-bold text-gray-900">{registration}</h1>
                    <Badge
                      className={`rounded-md border-0 px-2 py-1 text-xs font-medium ${
                        isActive
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600 sm:gap-4 sm:text-sm">
                    {model ? <span className="font-medium">{model}</span> : null}
                    {type ? <span>{type}</span> : null}
                    {aircraft.aircraft_type?.name ? (
                      <span>{aircraft.aircraft_type.name}</span>
                    ) : null}
                    <span>Total Hours: {formatTotalHours(totalHours)}</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/50 bg-card py-0 shadow-sm">
          <CardContent className="p-0">
            <Tabs.Root
              value={activeTab}
              onValueChange={(value: string) => setActiveTab(value as TabId)}
              className="flex w-full flex-col"
            >
              <div className="relative w-full border-b border-gray-200 bg-white">
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

                <div className="relative hidden items-center px-6 pt-2 md:flex">
                  {showScrollLeft ? (
                    <div className="pointer-events-none absolute top-0 bottom-0 left-0 z-10 w-8 bg-gradient-to-r from-white to-transparent" />
                  ) : null}
                  {showScrollRight ? (
                    <div className="pointer-events-none absolute top-0 right-0 bottom-0 z-10 w-8 bg-gradient-to-l from-white to-transparent" />
                  ) : null}
                  <div className="scrollbar-hide flex w-full items-center overflow-x-auto scroll-smooth">
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

                <Tabs.Content value="flight-history">
                  <AircraftFlightHistoryTab flights={flights} />
                </Tabs.Content>

                <Tabs.Content value="observations">
                  <AircraftObservationsTab aircraftId={aircraftId} observations={observations} />
                </Tabs.Content>

                <Tabs.Content value="maintenance-items">
                  <AircraftMaintenanceItemsTab components={components} aircraft={aircraft} />
                </Tabs.Content>

                <Tabs.Content value="maintenance-history">
                  <AircraftMaintenanceHistoryTab
                    aircraftId={aircraftId}
                    initialVisits={maintenanceVisits}
                  />
                </Tabs.Content>

                <Tabs.Content value="settings">
                  <AircraftSettingsTab aircraft={aircraft} aircraftId={aircraftId} />
                </Tabs.Content>
              </div>
            </Tabs.Root>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
