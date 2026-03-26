"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import type { SchedulerAircraftWarningSummary } from "@/lib/types/scheduler"

const LEFT_COL_WIDTH = "w-[160px] sm:w-[240px] lg:w-[280px]"

export function ResourceTimelineSidebar({
  rowHeight,
  groupHeight,
  instructorResources,
  aircraftResources,
  onSelectInstructor,
  onSelectAircraft,
  renderAircraftWarning,
}: {
  rowHeight: number
  groupHeight: number
  instructorResources: Array<{
    id: string
    name: string
    endorsements: string[]
  }>
  aircraftResources: Array<{
    id: string
    registration: string
    type: string
    warningSummary: SchedulerAircraftWarningSummary | null
  }>
  onSelectInstructor: (instructorId: string) => void
  onSelectAircraft: (aircraftId: string) => void
  renderAircraftWarning: (summary: SchedulerAircraftWarningSummary) => React.ReactNode
}) {
  return (
    <div className={cn("shrink-0 border-r border-border/60 bg-muted/10", LEFT_COL_WIDTH)}>
      <div className="sticky top-0 z-30 flex h-10 items-center border-b bg-card/95 px-2 backdrop-blur sm:h-12 sm:px-4">
        <div className="text-xs font-semibold text-foreground/90 sm:text-sm">Resources</div>
      </div>

      <div
        className="flex items-center border-b border-border/60 bg-muted/20 px-2 text-[11px] font-semibold text-muted-foreground sm:px-4"
        style={{ height: groupHeight }}
      >
        Instructors
      </div>
      {instructorResources.map((inst) => (
        <div
          key={inst.id}
          className="flex cursor-pointer items-center border-b border-border/60 px-2 transition-colors hover:bg-muted/30 sm:px-4"
          style={{ height: rowHeight }}
          role="button"
          tabIndex={0}
          onClick={() => onSelectInstructor(inst.id)}
          onKeyDown={(event) => {
            if (event.key !== "Enter" && event.key !== " ") return
            event.preventDefault()
            onSelectInstructor(inst.id)
          }}
        >
          <div className="min-w-0 truncate text-[13px] font-semibold leading-tight sm:text-sm">
            {inst.endorsements.length > 0 ? (
              <>
                {inst.name}{" "}
                <span className="font-medium text-muted-foreground/90">
                  ({inst.endorsements.join(", ")})
                </span>
              </>
            ) : (
              inst.name
            )}
          </div>
        </div>
      ))}

      <div
        className="flex items-center border-b border-border/60 bg-muted/20 px-2 text-[11px] font-semibold text-muted-foreground sm:px-4"
        style={{ height: groupHeight }}
      >
        Aircraft
      </div>
      {aircraftResources.map((ac) => (
        <div
          key={ac.id}
          className="flex cursor-pointer items-center border-b border-border/60 px-2 transition-colors hover:bg-muted/30 sm:px-4"
          style={{ height: rowHeight }}
          role="button"
          tabIndex={0}
          onClick={() => onSelectAircraft(ac.id)}
          onKeyDown={(event) => {
            if (event.key !== "Enter" && event.key !== " ") return
            event.preventDefault()
            onSelectAircraft(ac.id)
          }}
        >
          <div className="flex min-w-0 items-center gap-2">
            <div className="min-w-0 truncate text-[13px] font-semibold leading-tight sm:text-sm">
              {ac.registration}{" "}
              <span className="font-medium text-muted-foreground/90">({ac.type})</span>
            </div>
            {ac.warningSummary && ac.warningSummary.total_count > 0
              ? renderAircraftWarning(ac.warningSummary)
              : null}
          </div>
        </div>
      ))}
    </div>
  )
}
