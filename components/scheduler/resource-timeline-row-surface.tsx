"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

export function ResourceTimelineRowSurface({
  containerRef,
  slotCount,
  slots,
  timeZone,
  dragInProgress,
  isActiveDragTarget,
  activeDragPreviewValid,
  resourceTitle,
  isSlotAvailable,
  onEmptyClick,
  hoveredSlotIdx,
  onHoveredSlotIdxChange,
  formatTimeLabel12h,
  getMinutesInTimeZone,
}: {
  containerRef: React.RefObject<HTMLDivElement | null>
  slotCount: number
  slots: Date[]
  timeZone: string
  dragInProgress: boolean
  isActiveDragTarget: boolean
  activeDragPreviewValid: boolean
  resourceTitle?: string
  isSlotAvailable?: (slot: Date) => boolean
  onEmptyClick: (clientX: number, container: HTMLDivElement) => void
  hoveredSlotIdx: number | null
  onHoveredSlotIdxChange: (value: number | null) => void
  formatTimeLabel12h: (value: Date, timeZone: string) => string
  getMinutesInTimeZone: (value: Date, timeZone: string) => number
}) {
  const hoveredSlot = hoveredSlotIdx === null ? null : (slots[hoveredSlotIdx] ?? null)
  const hoveredAvailable = hoveredSlot && isSlotAvailable ? isSlotAvailable(hoveredSlot) : true
  const hoveredTimeLabel = hoveredSlot ? formatTimeLabel12h(hoveredSlot, timeZone) : null

  return (
    <>
      <div
        ref={containerRef}
        className={cn(
          "absolute inset-0 cursor-default",
          isActiveDragTarget ? (activeDragPreviewValid ? "bg-emerald-500/5" : "bg-destructive/5") : ""
        )}
        onMouseMove={(event) => {
          if (!containerRef.current) return
          const rect = containerRef.current.getBoundingClientRect()
          if (!rect.width) return
          const x = Math.max(0, Math.min(event.clientX - rect.left, rect.width))
          const rawIdx = Math.floor((x / rect.width) * slotCount)
          const idx = Math.max(0, Math.min(rawIdx, slotCount - 1))
          onHoveredSlotIdxChange(idx)
        }}
        onMouseLeave={() => onHoveredSlotIdxChange(null)}
        onClick={(event) => {
          if (dragInProgress) return
          if (!containerRef.current) return
          if (isSlotAvailable) {
            const rect = containerRef.current.getBoundingClientRect()
            if (!rect.width) return
            const x = Math.max(0, Math.min(event.clientX - rect.left, rect.width))
            const rawIdx = Math.floor((x / rect.width) * slotCount)
            const idx = Math.max(0, Math.min(rawIdx, slotCount - 1))
            const slot = slots[idx]
            if (slot && !isSlotAvailable(slot)) return
          }
          onEmptyClick(event.clientX, containerRef.current)
        }}
        aria-label={resourceTitle ? `Timeline row for ${resourceTitle}` : "Timeline row"}
      >
        <div className="grid h-full" style={{ gridTemplateColumns: `repeat(${slotCount}, minmax(0, 1fr))` }}>
          {slots.map((slot, idx) => {
            const isHour = getMinutesInTimeZone(slot, timeZone) % 60 === 0
            const available = isSlotAvailable ? isSlotAvailable(slot) : true
            return (
              <div
                key={slot.toISOString()}
                className={cn(
                  "last:border-r-0 border-r transition-colors",
                  available ? "cursor-pointer hover:bg-sky-500/10" : "cursor-not-allowed bg-muted/90",
                  available && idx % 2 === 1 ? "bg-muted/[0.03]" : "",
                  available && isHour ? "bg-muted/[0.05]" : "",
                  !available && idx % 2 === 1 ? "bg-muted/95" : "",
                  !available && isHour ? "bg-muted" : ""
                )}
              />
            )
          })}
        </div>
      </div>

      <div className="pointer-events-none absolute inset-0 hidden sm:block">
        {!dragInProgress && hoveredSlot && hoveredTimeLabel ? (
          <div
            className="absolute z-10"
            style={{
              left: `${((hoveredSlotIdx ?? 0) + 0.5) * (100 / Math.max(1, slotCount))}%`,
              top: -6,
              transform: "translate(-50%, -100%)",
            }}
          >
            <div
              className={cn(
                "relative rounded-md px-2 py-1 text-[11px] font-medium tabular-nums shadow-lg ring-1 backdrop-blur",
                "after:absolute after:left-1/2 after:top-full after:-translate-x-1/2 after:border-[6px] after:border-transparent",
                hoveredAvailable
                  ? "bg-slate-900/90 text-white ring-white/10 after:border-t-slate-900/90"
                  : "bg-muted-foreground/90 text-white ring-white/10 after:border-t-muted-foreground/90"
              )}
            >
              {hoveredAvailable ? "Create booking from " : "Unavailable at "}
              <span className="font-semibold">{hoveredTimeLabel}</span>
            </div>
          </div>
        ) : null}
      </div>
    </>
  )
}
