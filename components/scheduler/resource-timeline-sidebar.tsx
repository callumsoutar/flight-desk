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
    <div
      className={cn(
        "shrink-0 border-r border-slate-200/70 bg-gradient-to-b from-slate-100/50 via-white to-slate-50/40",
        LEFT_COL_WIDTH
      )}
    >
      <div className="sticky top-0 z-30 flex h-11 items-center border-b border-slate-200/60 bg-gradient-to-b from-white to-slate-50/60 px-3 sm:h-12 sm:px-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Timeline</div>
          <div className="text-sm font-semibold tracking-tight text-slate-900">Resources</div>
        </div>
      </div>

      <div
        className="flex items-center border-b border-slate-200/50 bg-gradient-to-r from-slate-200/30 via-slate-100/90 to-slate-200/30 px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600 sm:px-4"
        style={{ height: groupHeight }}
      >
        Instructors
      </div>
      {instructorResources.map((inst, index) => (
        <div
          key={inst.id}
          className={cn(
            "flex cursor-pointer items-center border-b border-slate-200/40 px-3 transition-colors sm:px-4",
            index % 2 === 1 ? "bg-slate-100/50" : "bg-white/90",
            "hover:bg-slate-100/90"
          )}
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
          <div className="min-w-0 truncate text-[13px] font-semibold leading-tight text-slate-900 sm:text-sm">
            {inst.endorsements.length > 0 ? (
              <>
                {inst.name}{" "}
                <span className="font-medium text-slate-500">
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
        className="flex items-center border-b border-slate-200/50 bg-gradient-to-r from-slate-200/30 via-slate-100/90 to-slate-200/30 px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600 sm:px-4"
        style={{ height: groupHeight }}
      >
        Aircraft
      </div>
      {aircraftResources.map((ac, index) => (
        <div
          key={ac.id}
          className={cn(
            "flex cursor-pointer items-center border-b border-slate-200/40 px-3 transition-colors sm:px-4",
            index % 2 === 1 ? "bg-slate-100/50" : "bg-white/90",
            "hover:bg-slate-100/90"
          )}
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
            <div className="min-w-0 truncate text-[13px] font-semibold leading-tight text-slate-900 sm:text-sm">
              {ac.registration}{" "}
              <span className="font-medium text-slate-500">({ac.type})</span>
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
