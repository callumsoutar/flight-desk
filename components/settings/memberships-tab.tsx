"use client"

import * as React from "react"
import * as Tabs from "@radix-ui/react-tabs"
import { IconCalendar, IconCreditCard, IconFileInvoice, IconGift } from "@tabler/icons-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { MembershipTypesConfig } from "@/components/settings/memberships/membership-types-config"
import { MembershipYearConfig } from "@/components/settings/memberships/membership-year-config"

const membershipTabs = [
  { id: "membership-types", label: "Membership Types", icon: IconCreditCard },
  { id: "membership-year", label: "Membership Year", icon: IconCalendar },
  { id: "invoicing", label: "Invoicing", icon: IconFileInvoice },
  { id: "benefits", label: "Benefits", icon: IconGift },
] as const

function PlaceholderPanel({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6">
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  )
}

export function MembershipsTab() {
  const [activeTab, setActiveTab] = React.useState<(typeof membershipTabs)[number]["id"]>("membership-types")
  const tabRefs = React.useRef<Record<string, HTMLButtonElement | null>>({})
  const tabsListRef = React.useRef<HTMLDivElement>(null)
  const [underlineStyle, setUnderlineStyle] = React.useState({ left: 0, width: 0 })
  const [showScrollLeft, setShowScrollLeft] = React.useState(false)
  const [showScrollRight, setShowScrollRight] = React.useState(false)

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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold tracking-tight text-slate-900">Memberships</h2>
          </div>
          <p className="text-sm text-muted-foreground">Define plans, billing, and membership access policies.</p>
        </div>
      </div>

      <Tabs.Root value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)} className="flex w-full flex-col">
        <div className="relative -mx-4 border-b border-slate-200 px-4 pb-1 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <div className="md:hidden pt-3 pb-2">
            <Select value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)}>
              <SelectTrigger className="h-11 w-full border-2 border-slate-200 hover:border-slate-300 focus:border-slate-400 rounded-xl bg-white">
                <SelectValue>
                  {(() => {
                    const active = membershipTabs.find((t) => t.id === activeTab) ?? membershipTabs[0]
                    const Icon = active.icon
                    return (
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-indigo-600" />
                        <span className="font-semibold text-indigo-900">{active.label}</span>
                      </div>
                    )
                  })()}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="rounded-xl border-slate-200">
                {membershipTabs.map((tab) => {
                  const Icon = tab.icon
                  const isActive = tab.id === activeTab
                  return (
                    <SelectItem
                      key={tab.id}
                      value={tab.id}
                      className={cn("rounded-lg mx-1 my-0.5", isActive ? "bg-indigo-50" : "")}
                    >
                      <div className="flex items-center gap-2">
                        <Icon className={cn("h-4 w-4", isActive ? "text-indigo-600" : "text-slate-500")} />
                        <span className={cn(isActive ? "font-semibold text-indigo-900" : "text-slate-700")}>
                          {tab.label}
                        </span>
                      </div>
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>

          <div className="relative hidden items-center pt-2 md:flex">
            {showScrollLeft ? (
              <div className="pointer-events-none absolute top-0 bottom-0 left-0 z-10 w-8 bg-gradient-to-r from-muted/30 to-transparent" />
            ) : null}
            {showScrollRight ? (
              <div className="pointer-events-none absolute top-0 right-0 bottom-0 z-10 w-8 bg-gradient-to-l from-muted/30 to-transparent" />
            ) : null}

            <div className="w-full overflow-x-auto scrollbar-hide scroll-smooth">
              <Tabs.List ref={tabsListRef} className="relative flex min-h-[44px] min-w-max flex-row gap-1" aria-label="Membership settings categories">
                <div
                  className="absolute bottom-0 h-0.5 bg-indigo-700 transition-all duration-300 ease-out"
                  style={{ left: `${underlineStyle.left}px`, width: `${underlineStyle.width}px` }}
                />
                {membershipTabs.map((tab) => {
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
          <Tabs.Content value="membership-types" className="outline-none">
            <Card className="border border-border/50 bg-card shadow-sm overflow-hidden rounded-2xl">
              <CardHeader className="border-b border-border/40">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg text-slate-900">Membership types</CardTitle>
                    <CardDescription>Define the plans your organization offers.</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <MembershipTypesConfig />
              </CardContent>
            </Card>
          </Tabs.Content>

          <Tabs.Content value="membership-year" className="outline-none">
            <Card className="border border-border/50 bg-card shadow-sm overflow-hidden rounded-2xl">
              <CardHeader className="border-b border-border/40">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg text-slate-900">Membership year</CardTitle>
                    <CardDescription>Configure your membership year boundaries and renewals.</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <MembershipYearConfig />
              </CardContent>
            </Card>
          </Tabs.Content>

          <Tabs.Content value="invoicing" className="outline-none">
            <Card className="border border-border/50 bg-card shadow-sm overflow-hidden rounded-2xl">
              <CardHeader className="border-b border-border/40">
                <div className="space-y-1">
                  <CardTitle className="text-lg text-slate-900">Invoicing</CardTitle>
                  <CardDescription>Billing rules for membership invoices and renewals.</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <PlaceholderPanel
                  title="Membership invoicing settings will be configured here."
                  description="This section will manage invoice cadence, due dates, and reminders."
                />
              </CardContent>
            </Card>
          </Tabs.Content>

          <Tabs.Content value="benefits" className="outline-none">
            <Card className="border border-border/50 bg-card shadow-sm overflow-hidden rounded-2xl">
              <CardHeader className="border-b border-border/40">
                <div className="space-y-1">
                  <CardTitle className="text-lg text-slate-900">Benefits</CardTitle>
                  <CardDescription>Configure benefits and feature access tied to plans.</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <PlaceholderPanel
                  title="Membership benefits will be configured here."
                  description="This section will manage perks like discounts, booking limits, and training access."
                />
              </CardContent>
            </Card>
          </Tabs.Content>
        </div>
      </Tabs.Root>
    </div>
  )
}
