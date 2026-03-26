"use client"

import * as React from "react"

export function ResourceTimelineGrid({
  timelineMinWidth,
  headerCells,
  instructorRows,
  aircraftRows,
  groupHeight,
  slotCount,
  slots,
}: {
  timelineMinWidth?: number
  headerCells: React.ReactNode
  instructorRows: React.ReactNode
  aircraftRows: React.ReactNode
  groupHeight: number
  slotCount: number
  slots: Date[]
}) {
  return (
    <div className="min-w-0 flex-1 overflow-x-auto">
      <div style={timelineMinWidth ? { minWidth: timelineMinWidth } : undefined}>
        <div className="sticky top-0 z-30 h-10 border-b border-border/60 bg-card/95 backdrop-blur sm:h-12">
          <div
            className="grid h-full"
            style={{
              gridTemplateColumns: `repeat(${slotCount}, minmax(0, 1fr))`,
            }}
          >
            {headerCells}
          </div>
        </div>

        <div className="divide-y">
          <div className="bg-muted/20" style={{ height: groupHeight }} aria-hidden="true">
            <div
              className="grid h-full"
              style={{ gridTemplateColumns: `repeat(${slotCount}, minmax(0, 1fr))` }}
            >
              {slots.map((slot) => (
                <div key={`instructors-${slot.toISOString()}`} className="last:border-r-0 border-r" />
              ))}
            </div>
          </div>

          {instructorRows}

          <div className="bg-muted/20" style={{ height: groupHeight }} aria-hidden="true">
            <div
              className="grid h-full"
              style={{ gridTemplateColumns: `repeat(${slotCount}, minmax(0, 1fr))` }}
            >
              {slots.map((slot) => (
                <div key={`aircraft-${slot.toISOString()}`} className="last:border-r-0 border-r" />
              ))}
            </div>
          </div>

          {aircraftRows}
        </div>
      </div>
    </div>
  )
}
