"use client"

import * as React from "react"
import { Plane, User, Wrench } from "lucide-react"

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

export function NewBookingModeTabs({
  bookingMode,
  onBookingModeChange,
}: {
  bookingMode: "regular" | "trial" | "maintenance"
  onBookingModeChange: (value: "regular" | "trial" | "maintenance") => void
}) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <span className="text-[13px] font-semibold text-slate-900">Booking Mode</span>
      </div>
      <Tabs value={bookingMode} onValueChange={(value) => onBookingModeChange(value as "regular" | "trial" | "maintenance")} className="w-full">
        <TabsList className="grid h-10 w-full grid-cols-3 gap-1 overflow-hidden rounded-xl bg-slate-50 p-1 ring-1 ring-slate-200">
          <TabsTrigger
            value="regular"
            className="h-8 min-w-0 gap-1.5 rounded-lg px-1.5 text-[11px] font-semibold text-slate-600 transition-colors sm:gap-2 sm:px-3 sm:text-xs data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-slate-200 hover:bg-white hover:text-slate-900"
          >
            <User className="h-3.5 w-3.5" />
            <span className="truncate">Regular</span>
          </TabsTrigger>
          <TabsTrigger
            value="trial"
            className="h-8 min-w-0 gap-1.5 rounded-lg px-1.5 text-[11px] font-semibold text-slate-600 transition-colors sm:gap-2 sm:px-3 sm:text-xs data-[state=active]:bg-white data-[state=active]:text-violet-700 data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-violet-200 hover:bg-white hover:text-violet-700"
          >
            <Plane className="h-3.5 w-3.5" />
            <span className="truncate">Trial</span>
          </TabsTrigger>
          <TabsTrigger
            value="maintenance"
            className="h-8 min-w-0 gap-1.5 rounded-lg px-1.5 text-[11px] font-semibold text-slate-600 transition-colors sm:gap-2 sm:px-3 sm:text-xs data-[state=active]:bg-white data-[state=active]:text-amber-700 data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-amber-200 hover:bg-white hover:text-amber-700"
          >
            <Wrench className="h-3.5 w-3.5" />
            <span className="truncate">Maint</span>
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </section>
  )
}
