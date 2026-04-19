"use client"

import * as React from "react"
import * as Tabs from "@radix-ui/react-tabs"
import {
  IconCalendar,
  IconCreditCard,
  IconCurrencyDollar,
  IconFileInvoice,
  IconPlugConnected,
  IconSchool,
  IconSettings,
} from "@tabler/icons-react"

import { BookingsTab } from "@/components/settings/bookings-tab"
import { ChargesTab } from "@/components/settings/charges-tab"
import { IntegrationsTab } from "@/components/settings/integrations-tab"
import { InvoicingTab } from "@/components/settings/invoicing-tab"
import { MembershipsTab } from "@/components/settings/memberships-tab"
import { GeneralTab } from "@/components/settings/general-tab"
import { TrainingTab } from "@/components/settings/training-tab"
import { Card, CardContent } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { GeneralSettings } from "@/lib/settings/general-settings"
import type { InvoicingSettings } from "@/lib/settings/invoicing-settings"
import type { BookingsSettings } from "@/lib/settings/bookings-settings"
import type { MembershipsSettings } from "@/lib/settings/memberships-settings"
import type { XeroSettings } from "@/lib/settings/xero-settings"
import type { XeroStatusQueryData } from "@/hooks/use-xero-status-query"
import { cn } from "@/lib/utils"

const tabs = [
  { id: "general", label: "General", icon: IconSettings },
  { id: "invoicing", label: "Invoicing", icon: IconFileInvoice },
  { id: "charges", label: "Charges", icon: IconCurrencyDollar },
  { id: "bookings", label: "Bookings", icon: IconCalendar },
  { id: "training", label: "Training", icon: IconSchool },
  { id: "memberships", label: "Memberships", icon: IconCreditCard },
  { id: "integrations", label: "Integrations", icon: IconPlugConnected },
]

// Contract:
// - `app/settings/page.tsx` owns initial tab selection and server bootstraps core settings payloads.
// - tab components own local edit state after hydration.
// - collection-style settings areas such as charges and training remain client-owned editors.

export function SettingsPageClient({
  initialTab,
  canManageSettings,
  initialGeneralSettings,
  generalLoadError,
  initialInvoicingSettings,
  invoicingLoadError,
  initialBookingsSettings,
  bookingsLoadError,
  initialMembershipsSettings,
  membershipsLoadError,
  initialXeroSettings,
  xeroLoadError,
  xeroConnectionStatus,
}: {
  initialTab: string
  canManageSettings: boolean
  initialGeneralSettings: GeneralSettings | null
  generalLoadError: string | null
  initialInvoicingSettings: InvoicingSettings | null
  invoicingLoadError: string | null
  initialBookingsSettings: BookingsSettings | null
  bookingsLoadError: string | null
  initialMembershipsSettings: MembershipsSettings | null
  membershipsLoadError: string | null
  initialXeroSettings: XeroSettings | null
  xeroLoadError: string | null
  xeroConnectionStatus: {
    connected: boolean
    xero_tenant_name: string | null
    connected_at: string | null
  }
}) {
  const [activeTab, setActiveTab] = React.useState(initialTab)
  const [underlineStyle, setUnderlineStyle] = React.useState({ left: 0, width: 0 })
  const tabRefs = React.useRef<Record<string, HTMLButtonElement | null>>({})
  const tabsListRef = React.useRef<HTMLDivElement>(null)
  const [showScrollLeft, setShowScrollLeft] = React.useState(false)
  const [showScrollRight, setShowScrollRight] = React.useState(false)

  React.useEffect(() => {
    setActiveTab(initialTab)
  }, [initialTab])

  const initialXeroStatusQueryData = React.useMemo<XeroStatusQueryData>(
    () => ({
      connected: xeroConnectionStatus.connected,
      xero_tenant_name: xeroConnectionStatus.xero_tenant_name,
      connected_at: xeroConnectionStatus.connected_at,
      enabled: initialXeroSettings?.enabled ?? false,
    }),
    [
      initialXeroSettings?.enabled,
      xeroConnectionStatus.connected,
      xeroConnectionStatus.connected_at,
      xeroConnectionStatus.xero_tenant_name,
    ]
  )

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

  if (!canManageSettings) {
    return (
      <Card className="border border-border/50 bg-card shadow-sm">
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold text-slate-900">Settings</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            You don&apos;t have permission to manage company settings.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Settings</h1>
          </div>
          <p className="mt-1 text-slate-600">
            Configure your company profile, billing, and operational preferences.
          </p>
        </div>
      </div>

      <Card className="border border-border/50 bg-card py-0 shadow-sm overflow-hidden rounded-2xl">
        <CardContent className="p-0">
          <Tabs.Root value={activeTab} onValueChange={setActiveTab} className="flex w-full flex-col">
            <div className="relative w-full border-b border-gray-200 bg-white">
              <div className="px-4 pt-3 pb-3 md:hidden">
                <Select value={activeTab} onValueChange={setActiveTab}>
                  <SelectTrigger className="h-11 w-full border-2 border-gray-300 hover:border-indigo-400 focus:border-indigo-500">
                    <SelectValue>
                      {(() => {
                        const activeTabItem = tabs.find((t) => t.id === activeTab) ?? tabs[0]
                        const Icon = activeTabItem.icon
                        return (
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4 text-indigo-600" />
                            <span className="font-medium">{activeTabItem.label}</span>
                          </div>
                        )
                      })()}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {tabs.map((tab) => {
                      const Icon = tab.icon
                      const isActiveTab = activeTab === tab.id
                      return (
                        <SelectItem
                          key={tab.id}
                          value={tab.id}
                          className={cn("rounded-lg mx-1 my-0.5", isActiveTab ? "bg-indigo-50" : "")}
                        >
                          <div className="flex items-center gap-2">
                            <Icon
                              className={cn(
                                "h-4 w-4",
                                isActiveTab ? "text-indigo-600" : "text-gray-500"
                              )}
                            />
                            <span className={isActiveTab ? "font-semibold text-indigo-900" : undefined}>
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

                <div className="w-full overflow-x-auto scrollbar-hide scroll-smooth">
                  <Tabs.List
                    ref={tabsListRef}
                    className="relative flex min-h-[48px] min-w-max flex-row gap-1"
                    aria-label="Settings categories"
                  >
                    <div
                      className="absolute bottom-0 h-0.5 bg-indigo-700 transition-all duration-300 ease-out"
                      style={{
                        left: `${underlineStyle.left}px`,
                        width: `${underlineStyle.width}px`,
                      }}
                    />
                    {tabs.map((tab) => {
                      const Icon = tab.icon
                      return (
                        <Tabs.Trigger
                          key={tab.id}
                          ref={(el) => {
                            tabRefs.current[tab.id] = el
                          }}
                          value={tab.id}
                          className="inline-flex min-h-[48px] min-w-[44px] flex-shrink-0 cursor-pointer touch-manipulation items-center gap-2 border-b-2 border-transparent px-4 py-3 pb-1 text-base font-medium whitespace-nowrap text-gray-500 transition-all duration-200 hover:text-indigo-600 data-[state=active]:text-indigo-800"
                          style={{
                            background: "none",
                            boxShadow: "none",
                            borderRadius: 0,
                          }}
                          aria-label={`${tab.label} settings`}
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

            <div className="w-full bg-muted/30 p-4 sm:p-6 lg:p-8">
              <Tabs.Content value="general">
                <GeneralTab initialSettings={initialGeneralSettings} loadError={generalLoadError} />
              </Tabs.Content>
              <Tabs.Content value="invoicing">
                <InvoicingTab
                  initialSettings={initialInvoicingSettings}
                  loadError={invoicingLoadError}
                  initialXeroStatus={initialXeroStatusQueryData}
                />
              </Tabs.Content>
              <Tabs.Content value="charges">
                <ChargesTab initialXeroStatus={initialXeroStatusQueryData} />
              </Tabs.Content>
              <Tabs.Content value="bookings">
                <BookingsTab
                  initialSettings={initialBookingsSettings}
                  initialLoadError={bookingsLoadError}
                />
              </Tabs.Content>
              <Tabs.Content value="training">
                <TrainingTab />
              </Tabs.Content>
              <Tabs.Content value="memberships">
                <MembershipsTab
                  initialSettings={initialMembershipsSettings}
                  initialLoadError={membershipsLoadError}
                />
              </Tabs.Content>
              <Tabs.Content value="integrations">
                <IntegrationsTab
                  initialXeroSettings={initialXeroSettings}
                  xeroLoadError={xeroLoadError}
                  xeroConnectionStatus={xeroConnectionStatus}
                />
              </Tabs.Content>
            </div>
          </Tabs.Root>
        </CardContent>
      </Card>
    </div>
  )
}
