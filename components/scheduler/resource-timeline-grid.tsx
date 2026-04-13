"use client"

import * as React from "react"

export function ResourceTimelineGrid({
  timelineMinWidth,
  currentTimeLineLeftPct,
  headerCells,
  instructorRows,
  aircraftRows,
  groupHeight,
  slotCount,
  slots,
}: {
  timelineMinWidth?: number
  currentTimeLineLeftPct: number | null
  headerCells: React.ReactNode
  instructorRows: React.ReactNode
  aircraftRows: React.ReactNode
  groupHeight: number
  slotCount: number
  slots: Date[]
}) {
  return (
    <div className="min-w-0 flex-1 overflow-x-auto bg-background">
      <div className="relative" style={timelineMinWidth ? { minWidth: timelineMinWidth } : undefined}>
        <div className="sticky top-0 z-30 h-11 border-b border-border/70 bg-background sm:h-12">
          <div
            className="grid h-full"
            style={{
              gridTemplateColumns: `repeat(${slotCount}, minmax(0, 1fr))`,
            }}
          >
            {headerCells}
          </div>
        </div>

        <div className="divide-y divide-border/60">
          <div className="bg-slate-100" style={{ height: groupHeight }} aria-hidden="true">
            <div
              className="grid h-full"
              style={{ gridTemplateColumns: `repeat(${slotCount}, minmax(0, 1fr))` }}
            >
              {slots.map((slot) => (
                <div key={`instructors-${slot.toISOString()}`} className="border-r border-border/50 last:border-r-0" />
              ))}
            </div>
          </div>

          {instructorRows}

          <div className="bg-slate-100" style={{ height: groupHeight }} aria-hidden="true">
            <div
              className="grid h-full"
              style={{ gridTemplateColumns: `repeat(${slotCount}, minmax(0, 1fr))` }}
            >
              {slots.map((slot) => (
                <div key={`aircraft-${slot.toISOString()}`} className="border-r border-border/50 last:border-r-0" />
              ))}
            </div>
          </div>

          {aircraftRows}
        </div>

        {currentTimeLineLeftPct !== null ? (
          <div className="pointer-events-none absolute bottom-0 left-0 right-0 top-11 z-20 sm:top-12">
            <div
              className="absolute bottom-0 top-0 -translate-x-1/2"
              style={{ left: `${currentTimeLineLeftPct}%` }}
              aria-hidden="true"
            >
              <div className="h-full w-px bg-red-500/90 shadow-[0_0_0_1px_rgba(239,68,68,0.08)]" />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
