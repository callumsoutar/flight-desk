"use client"

import * as React from "react"
import * as Tabs from "@radix-ui/react-tabs"
import { IconCashBanknote, IconPlane, IconReceiptTax } from "@tabler/icons-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FlightTypesConfig } from "@/components/settings/charges/flight-types-config"
import { LandingFeesConfig } from "@/components/settings/charges/landing-fees-config"
import { ChargeablesConfig } from "@/components/settings/charges/chargeables-config"
import { ChargeableTypesConfig } from "@/components/settings/charges/chargeable-types-config"

const chargeTabs = [
  { id: "aircraft", label: "Aircraft rates", icon: IconPlane },
  { id: "landing", label: "Landing fees", icon: IconReceiptTax },
  { id: "additional", label: "Additional charges", icon: IconCashBanknote },
] as const

export function ChargesTab() {
  const [activeTab, setActiveTab] = React.useState<(typeof chargeTabs)[number]["id"]>("aircraft")
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
            <h2 className="text-xl font-semibold tracking-tight text-slate-900">Charges</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Manage hourly aircraft rates, landing fees, and any additional chargeables.
          </p>
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
                aria-label="Charge settings categories"
              >
                <div
                  className="absolute bottom-0 h-0.5 bg-indigo-700 transition-all duration-300 ease-out"
                  style={{
                    left: `${underlineStyle.left}px`,
                    width: `${underlineStyle.width}px`,
                  }}
                />
                {chargeTabs.map((tab) => {
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
          <Tabs.Content value="aircraft" className="outline-none">
            <Card className="border border-border/50 bg-card shadow-sm overflow-hidden rounded-2xl">
              <CardHeader className="border-b border-border/40">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg text-slate-900">Aircraft rates</CardTitle>
                    <CardDescription>
                      Configure the flight types that drive hourly aircraft rates and booking categories.
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="border-slate-200 text-slate-600">
                    Flight types
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <FlightTypesConfig />
              </CardContent>
            </Card>
          </Tabs.Content>

          <Tabs.Content value="landing" className="outline-none">
            <Card className="border border-border/50 bg-card shadow-sm overflow-hidden rounded-2xl">
              <CardHeader className="border-b border-border/40">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg text-slate-900">Landing fees</CardTitle>
                    <CardDescription>
                      Manage landing fee chargeables and per-aircraft-type pricing.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <LandingFeesConfig />
              </CardContent>
            </Card>
          </Tabs.Content>

          <Tabs.Content value="additional" className="outline-none">
            <Card className="border border-border/50 bg-card shadow-sm overflow-hidden rounded-2xl">
              <CardHeader className="border-b border-border/40">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg text-slate-900">Additional charges</CardTitle>
                    <CardDescription>
                      Configure any non-hourly, non-landing-fee chargeables (e.g. airways fees, admin fees).
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <ChargeableTypesConfig />
                <ChargeablesConfig />
              </CardContent>
            </Card>
          </Tabs.Content>
        </div>
      </Tabs.Root>
    </div>
  )
}
