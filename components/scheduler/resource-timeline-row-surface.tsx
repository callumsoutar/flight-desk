"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

export function ResourceTimelineRowSurface({
  containerRef,
  slotCount,
  slots,
  timeZone,
  dragInProgress,
  isStriped,
  isActiveDragTarget,
  activeDragPreviewValid,
  resourceTitle,
  isSlotAvailable,
  onEmptyClick,
  hoveredSlotIdx,
  onHoveredSlotIdxChange,
  formatTimeLabel12h,
}: {
  containerRef: React.RefObject<HTMLDivElement | null>
  slotCount: number
  slots: Date[]
  timeZone: string
  dragInProgress: boolean
  isStriped: boolean
  isActiveDragTarget: boolean
  activeDragPreviewValid: boolean
  resourceTitle?: string
  isSlotAvailable?: (slot: Date) => boolean
  onEmptyClick: (clientX: number, container: HTMLDivElement) => void
  hoveredSlotIdx: number | null
  onHoveredSlotIdxChange: (value: number | null) => void
  formatTimeLabel12h: (value: Date, timeZone: string) => string
}) {
  const tooltipRef = React.useRef<HTMLDivElement | null>(null)
  const [containerWidth, setContainerWidth] = React.useState(0)
  const [tooltipWidth, setTooltipWidth] = React.useState(0)
  const hoveredSlot = hoveredSlotIdx === null ? null : (slots[hoveredSlotIdx] ?? null)
  const hoveredAvailable = hoveredSlot && isSlotAvailable ? isSlotAvailable(hoveredSlot) : true
  const hoveredTimeLabel = hoveredSlot ? formatTimeLabel12h(hoveredSlot, timeZone) : null
  const slotCenterPct = ((hoveredSlotIdx ?? 0) + 0.5) * (100 / Math.max(1, slotCount))

  React.useLayoutEffect(() => {
    if (!hoveredSlot || dragInProgress) {
      setTooltipWidth(0)
      return
    }

    const measure = () => {
      setContainerWidth(containerRef.current?.clientWidth ?? 0)
      setTooltipWidth(tooltipRef.current?.offsetWidth ?? 0)
    }

    measure()

    if (typeof ResizeObserver === "undefined") return

    const observer = new ResizeObserver(() => {
      measure()
    })

    if (containerRef.current) observer.observe(containerRef.current)
    if (tooltipRef.current) observer.observe(tooltipRef.current)
    return () => observer.disconnect()
  }, [containerRef, dragInProgress, hoveredSlot, hoveredTimeLabel])

  const tooltipStyle = React.useMemo<React.CSSProperties>(() => {
    if (!containerWidth || !tooltipWidth) {
      return {
        left: `${slotCenterPct}%`,
        top: -6,
        transform: "translate(-50%, -100%)",
      }
    }

    const edgePadding = 8
    const rawLeft = (((hoveredSlotIdx ?? 0) + 0.5) / Math.max(1, slotCount)) * containerWidth
    const minLeft = Math.min(containerWidth / 2, tooltipWidth / 2 + edgePadding)
    const maxLeft = Math.max(minLeft, containerWidth - tooltipWidth / 2 - edgePadding)
    const clampedLeft = Math.min(Math.max(rawLeft, minLeft), maxLeft)

    return {
      left: clampedLeft,
      top: -6,
      transform: "translate(-50%, -100%)",
    }
  }, [containerWidth, hoveredSlotIdx, slotCenterPct, slotCount, tooltipWidth])

  return (
    <>
      <div
        ref={containerRef}
        className={cn(
          "absolute inset-0 cursor-default",
          isStriped ? "bg-slate-50/80" : "bg-white",
          isActiveDragTarget ? (activeDragPreviewValid ? "bg-emerald-500/8" : "bg-destructive/8") : ""
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
            const available = isSlotAvailable ? isSlotAvailable(slot) : true
            const isHovered = hoveredSlotIdx === idx
            return (
              <div
                key={slot.toISOString()}
                className={cn(
                  "border-r border-border/50 transition-colors last:border-r-0",
                  available
                    ? "cursor-pointer bg-transparent hover:bg-sky-500/8"
                    : "cursor-not-allowed bg-slate-100/85",
                  isHovered && available ? "bg-sky-100/80 shadow-[inset_0_0_0_1px_rgba(14,165,233,0.18)]" : "",
                  isHovered && !available
                    ? "bg-slate-300/70 shadow-[inset_0_0_0_1px_rgba(100,116,139,0.18)]"
                    : ""
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
            style={tooltipStyle}
          >
            <div
              ref={tooltipRef}
              className={cn(
                "relative max-w-[calc(100vw-2rem)] whitespace-nowrap rounded-md px-2.5 py-1 text-[11px] font-medium tabular-nums shadow-md ring-1 backdrop-blur",
                "after:absolute after:left-1/2 after:top-full after:-translate-x-1/2 after:border-[6px] after:border-transparent",
                hoveredAvailable
                  ? "bg-slate-900/92 text-white ring-white/10 after:border-t-slate-900/92"
                  : "bg-slate-700/92 text-white ring-white/10 after:border-t-slate-700/92"
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
