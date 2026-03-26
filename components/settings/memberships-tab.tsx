"use client"

import * as React from "react"
import * as Tabs from "@radix-ui/react-tabs"
import { IconCalendar, IconCreditCard } from "@tabler/icons-react"

import { MembershipYearConfig } from "@/components/settings/memberships/membership-year-config"
import { MembershipTypesConfig } from "@/components/settings/memberships/membership-types-config"
import type { MembershipsSettings } from "@/lib/settings/memberships-settings"

const membershipTabs = [
  { id: "membership-types", label: "Membership Types", icon: IconCreditCard },
  { id: "membership-year", label: "Membership Year", icon: IconCalendar },
] as const

// Contract:
// - membership-year uses the server-bootstrapped settings payload
// - membership-types remains a client-owned collection editor
export function MembershipsTab({
  initialSettings = null,
  initialLoadError = null,
}: {
  initialSettings?: MembershipsSettings | null
  initialLoadError?: string | null
}) {
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
                aria-label="Membership settings categories"
              >
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
            <div className="w-full min-w-0 space-y-2">
              <h3 className="text-lg font-semibold text-slate-900">Membership types</h3>
              <p className="text-sm text-muted-foreground">Define the plans your organization offers.</p>
              <MembershipTypesConfig />
            </div>
          </Tabs.Content>

          <Tabs.Content value="membership-year" className="outline-none">
            <div className="w-full min-w-0 space-y-2">
              <h3 className="text-lg font-semibold text-slate-900">Membership year</h3>
              <p className="text-sm text-muted-foreground">Configure your membership year boundaries and renewals.</p>
              <MembershipYearConfig
                initialSettings={initialSettings}
                initialLoadError={initialLoadError}
              />
            </div>
          </Tabs.Content>
        </div>
      </Tabs.Root>
    </div>
  )
}
