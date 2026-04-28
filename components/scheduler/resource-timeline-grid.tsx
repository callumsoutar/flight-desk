"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

const PAN_START_THRESHOLD_PX = 4

function isPanExcludedTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false

  return Boolean(
    target.closest(
      "button,a,input,select,textarea,label,[role='button'],[role='menuitem'],[data-slot='button']"
    )
  )
}

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
  const scrollContainerRef = React.useRef<HTMLDivElement | null>(null)
  const panPointerIdRef = React.useRef<number | null>(null)
  const panStartXRef = React.useRef(0)
  const panStartScrollLeftRef = React.useRef(0)
  const didPanRef = React.useRef(false)
  const suppressClickAfterPanRef = React.useRef(false)
  const suppressResetTimerRef = React.useRef<number | null>(null)

  const [isPanning, setIsPanning] = React.useState(false)
  const [isOverflowing, setIsOverflowing] = React.useState(false)
  const [canScrollLeft, setCanScrollLeft] = React.useState(false)
  const [canScrollRight, setCanScrollRight] = React.useState(false)

  const updateScrollAffordance = React.useCallback(() => {
    const container = scrollContainerRef.current
    if (!container) return

    const nextMaxScrollLeft = Math.max(0, container.scrollWidth - container.clientWidth)
    const nextScrollLeft = Math.max(0, Math.min(container.scrollLeft, nextMaxScrollLeft))
    const hasOverflow = nextMaxScrollLeft > 1

    setIsOverflowing(hasOverflow)
    setCanScrollLeft(hasOverflow && nextScrollLeft > 1)
    setCanScrollRight(hasOverflow && nextScrollLeft < nextMaxScrollLeft - 1)
  }, [])

  React.useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return

    const rafId = window.requestAnimationFrame(() => {
      updateScrollAffordance()
    })

    const handleScroll = () => {
      updateScrollAffordance()
    }

    container.addEventListener("scroll", handleScroll, { passive: true })

    let observer: ResizeObserver | null = null
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(() => {
        updateScrollAffordance()
      })
      observer.observe(container)
      if (container.firstElementChild instanceof HTMLElement) {
        observer.observe(container.firstElementChild)
      }
    }

    return () => {
      window.cancelAnimationFrame(rafId)
      container.removeEventListener("scroll", handleScroll)
      observer?.disconnect()
    }
  }, [slotCount, updateScrollAffordance])

  React.useEffect(() => {
    return () => {
      if (suppressResetTimerRef.current !== null) {
        window.clearTimeout(suppressResetTimerRef.current)
      }
    }
  }, [])

  const scrollTimelineByPage = React.useCallback((direction: "left" | "right") => {
    const container = scrollContainerRef.current
    if (!container) return

    const distance = Math.max(240, Math.round(container.clientWidth * 0.7))
    container.scrollBy({
      left: direction === "left" ? -distance : distance,
      behavior: "smooth",
    })
  }, [])

  const handlePointerDown = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!isOverflowing) return
      if (event.pointerType !== "mouse") return
      if (event.button !== 0) return
      if (isPanExcludedTarget(event.target)) return

      const container = scrollContainerRef.current
      if (!container) return

      panPointerIdRef.current = event.pointerId
      panStartXRef.current = event.clientX
      panStartScrollLeftRef.current = container.scrollLeft
      didPanRef.current = false
      setIsPanning(false)
    },
    [isOverflowing]
  )

  const handlePointerMove = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (panPointerIdRef.current !== event.pointerId) return

    const container = scrollContainerRef.current
    if (!container) return

    const deltaX = event.clientX - panStartXRef.current
    if (!didPanRef.current && Math.abs(deltaX) < PAN_START_THRESHOLD_PX) return

    if (!didPanRef.current) {
      didPanRef.current = true
      setIsPanning(true)
      if (!container.hasPointerCapture(event.pointerId)) {
        container.setPointerCapture(event.pointerId)
      }
    }

    suppressClickAfterPanRef.current = true
    container.scrollLeft = panStartScrollLeftRef.current - deltaX
    event.preventDefault()
  }, [])

  const endPan = React.useCallback((pointerId: number) => {
    if (panPointerIdRef.current !== pointerId) return

    const container = scrollContainerRef.current
    if (container?.hasPointerCapture(pointerId)) {
      container.releasePointerCapture(pointerId)
    }

    panPointerIdRef.current = null
    const didPan = didPanRef.current
    didPanRef.current = false
    setIsPanning(false)

    if (didPan) {
      if (suppressResetTimerRef.current !== null) {
        window.clearTimeout(suppressResetTimerRef.current)
      }
      suppressResetTimerRef.current = window.setTimeout(() => {
        suppressClickAfterPanRef.current = false
        suppressResetTimerRef.current = null
      }, 0)
    } else {
      suppressClickAfterPanRef.current = false
    }
  }, [])

  return (
    <div className="relative min-w-0 flex-1 min-h-0">
      <div
        ref={scrollContainerRef}
        className={cn("overflow-x-auto overflow-y-hidden", isPanning ? "cursor-grabbing select-none" : "")}
        tabIndex={isOverflowing ? 0 : -1}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={(event) => endPan(event.pointerId)}
        onPointerCancel={(event) => endPan(event.pointerId)}
        onClickCapture={(event) => {
          if (!suppressClickAfterPanRef.current) return
          event.preventDefault()
          event.stopPropagation()
          suppressClickAfterPanRef.current = false
        }}
        onKeyDown={(event) => {
          if (!isOverflowing) return
          if (event.key === "ArrowLeft") {
            event.preventDefault()
            scrollTimelineByPage("left")
            return
          }
          if (event.key === "ArrowRight") {
            event.preventDefault()
            scrollTimelineByPage("right")
          }
        }}
        aria-label={
          isOverflowing
            ? "Scheduler timeline. Drag to pan horizontally, scroll horizontally, or press left and right arrow keys."
            : undefined
        }
      >
        <div className="relative" style={timelineMinWidth ? { minWidth: timelineMinWidth } : undefined}>
          <div className="sticky top-0 z-30 h-11 border-b border-slate-200/60 bg-gradient-to-b from-white via-slate-50/50 to-slate-100/30 sm:h-12">
            <div
              className="grid h-full"
              style={{
                gridTemplateColumns: `repeat(${slotCount}, minmax(0, 1fr))`,
              }}
            >
              {headerCells}
            </div>
          </div>

          <div className="divide-y divide-slate-200/45">
            <div
              className="bg-gradient-to-r from-slate-200/25 via-slate-100/80 to-slate-200/25"
              style={{ height: groupHeight }}
              aria-hidden="true"
            >
              <div
                className="grid h-full"
                style={{ gridTemplateColumns: `repeat(${slotCount}, minmax(0, 1fr))` }}
              >
                {slots.map((slot) => (
                  <div key={`instructors-${slot.toISOString()}`} className="border-r border-slate-200/35 last:border-r-0" />
                ))}
              </div>
            </div>

            {instructorRows}

            <div
              className="bg-gradient-to-r from-slate-200/25 via-slate-100/80 to-slate-200/25"
              style={{ height: groupHeight }}
              aria-hidden="true"
            >
              <div
                className="grid h-full"
                style={{ gridTemplateColumns: `repeat(${slotCount}, minmax(0, 1fr))` }}
              >
                {slots.map((slot) => (
                  <div key={`aircraft-${slot.toISOString()}`} className="border-r border-slate-200/35 last:border-r-0" />
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
                <div className="h-full w-px bg-rose-500" />
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div
        className={cn(
          "pointer-events-none absolute bottom-0 left-0 top-0 z-20 w-8 bg-gradient-to-r from-white to-transparent transition-opacity",
          isOverflowing && canScrollLeft ? "opacity-100" : "opacity-0"
        )}
        aria-hidden="true"
      />
      <div
        className={cn(
          "pointer-events-none absolute bottom-0 right-0 top-0 z-20 w-8 bg-gradient-to-l from-white to-transparent transition-opacity",
          isOverflowing && canScrollRight ? "opacity-100" : "opacity-0"
        )}
        aria-hidden="true"
      />
    </div>
  )
}
