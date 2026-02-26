import React from "react"
import { IconCheck } from "@tabler/icons-react"

import { cn } from "@/lib/utils"

export const BOOKING_STAGES = [
  { id: "briefing", label: "Briefing" },
  { id: "checkout", label: "Check-out" },
  { id: "flying", label: "Flying" },
  { id: "checkin", label: "Check-in" },
  { id: "debrief", label: "Debrief" },
]

export const STATUS_TO_STAGE_ID: Record<string, string> = {
  unconfirmed: "briefing",
  confirmed: "briefing",
  briefing: "briefing",
  checkout: "checkout",
  flying: "flying",
  checkin: "checkin",
  complete: "debrief",
  debrief: "debrief",
}

interface Stage {
  id: string
  label: string
}

type TrackerStateInput = {
  stages: Stage[]
  status?: string | null
  briefingCompleted?: boolean | null
  authorizationCompleted?: boolean | null
  checkedOutAt?: string | null
  checkedInAt?: string | null
  checkinApprovedAt?: string | null
  hasDebrief?: boolean
  forceActiveStageId?: string
}

interface BookingStatusTrackerProps {
  stages: Stage[]
  activeStageId?: string
  completedStageIds?: string[]
  className?: string
}

export function getBookingTrackerStages(includeBriefing: boolean): Stage[] {
  if (includeBriefing) return BOOKING_STAGES
  return BOOKING_STAGES.filter((stage) => stage.id !== "briefing")
}

export function deriveBookingTrackerState(input: TrackerStateInput): {
  activeStageId: string | undefined
  completedStageIds: string[]
} {
  const { stages } = input
  const stageIds = new Set(stages.map((stage) => stage.id))
  const status = String(input.status ?? "")
  const statusStage = STATUS_TO_STAGE_ID[status]

  const activeStageId = (() => {
    if (input.forceActiveStageId && stageIds.has(input.forceActiveStageId)) {
      return input.forceActiveStageId
    }
    if (statusStage && stageIds.has(statusStage)) {
      return statusStage
    }
    return stages[0]?.id
  })()

  const completed = new Set<string>()
  const addIfPresent = (id: string) => {
    if (stageIds.has(id)) completed.add(id)
  }

  if (input.briefingCompleted || input.authorizationCompleted) {
    addIfPresent("briefing")
  }
  if (input.checkedOutAt) {
    addIfPresent("checkout")
  }
  if (status === "flying" || status === "checkin" || status === "complete" || status === "debrief") {
    addIfPresent("flying")
  }
  if (input.checkinApprovedAt || input.checkedInAt || status === "checkin" || status === "complete" || status === "debrief") {
    addIfPresent("checkin")
  }
  if (input.hasDebrief || status === "complete" || status === "debrief") {
    addIfPresent("debrief")
  }

  const activeStageIndex = stages.findIndex((stage) => stage.id === activeStageId)
  if (activeStageIndex > 0) {
    for (let i = 0; i < activeStageIndex; i += 1) {
      addIfPresent(stages[i].id)
    }
  }

  const completedStageIds = stages.filter((stage) => completed.has(stage.id)).map((stage) => stage.id)
  return { activeStageId, completedStageIds }
}

export function BookingStatusTracker({
  stages,
  activeStageId,
  completedStageIds = [],
  className,
}: BookingStatusTrackerProps) {
  const allStagesCompleted =
    stages.length > 0 && stages.every((stage) => completedStageIds.includes(stage.id))
  const firstIncompleteStageId = stages.find((stage) => !completedStageIds.includes(stage.id))?.id
  const effectiveActiveStageId =
    activeStageId ?? (allStagesCompleted ? stages[stages.length - 1]?.id : firstIncompleteStageId)

  return (
    <div
      className={cn(
        "flex w-full overflow-hidden rounded-xl border border-border bg-muted/30 p-1 shadow-sm",
        className
      )}
    >
      <div className="flex w-full items-center gap-1">
        {stages.map((stage, index) => {
          const isCompleted = completedStageIds.includes(stage.id)
          const isActive = effectiveActiveStageId === stage.id
          const isLast = index === stages.length - 1
          const isFirst = index === 0
          const isExpandedOnMobile = isActive

          const chevronWidth = 14
          const clipPath = !isLast
            ? !isFirst
              ? `polygon(0% 0%, calc(100% - ${chevronWidth}px) 0%, 100% 50%, calc(100% - ${chevronWidth}px) 100%, 0% 100%, ${chevronWidth}px 50%)`
              : `polygon(0% 0%, calc(100% - ${chevronWidth}px) 0%, 100% 50%, calc(100% - ${chevronWidth}px) 100%, 0% 100%)`
            : `polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%, ${chevronWidth}px 50%)`

          return (
            <div
              key={stage.id}
              className={cn(
                "relative flex h-10 items-center justify-center transition-all duration-500 ease-in-out",
                isExpandedOnMobile ? "flex-1" : "w-12 flex-none",
                "sm:flex-1",
                isCompleted
                  ? "bg-[#6564db] text-white shadow-md"
                  : isActive
                    ? "bg-[#6564db]/20 font-bold text-[#4f46e5]"
                    : "bg-muted/40 text-muted-foreground",
                !isLast && "mr-[-10px]",
                isFirst && "rounded-l-lg",
                isLast && "rounded-r-lg"
              )}
              style={{
                clipPath,
                zIndex: stages.length - index,
              }}
            >
              <div
                className={cn(
                  "flex items-center gap-2",
                  isExpandedOnMobile ? "px-4 sm:px-6" : "px-0 sm:px-4",
                  !isFirst && isActive && "pl-6",
                  !isLast && isActive && "pr-6",
                  !isActive && "justify-center"
                )}
              >
                {isCompleted ? (
                  <IconCheck className="h-3.5 w-3.5 shrink-0 stroke-[3px]" />
                ) : (
                  <div
                    className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-current sm:hidden",
                      isActive && "hidden"
                    )}
                  >
                    <span className="text-[10px] font-bold">{index + 1}</span>
                  </div>
                )}

                <span
                  className={cn(
                    "whitespace-nowrap text-xs font-semibold uppercase tracking-wide sm:text-[11px]",
                    isActive ? "flex" : "hidden sm:flex",
                    isActive && "font-bold"
                  )}
                >
                  {stage.label}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
