"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowUpRight, BookOpen, ChevronRight, GraduationCap, Plane, UserRound } from "lucide-react"

import { cn } from "@/lib/utils"
import { formatDateTime } from "@/lib/utils/date-format"
import { useTimezone } from "@/contexts/timezone-context"
import type { MemberTrainingPeekResponse } from "@/lib/types/member-training-peek"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

function formatPerson(value: { first_name: string | null; last_name: string | null; email?: string | null } | null) {
  if (!value) return "Unassigned"
  const name = [value.first_name, value.last_name].filter(Boolean).join(" ").trim()
  return name || value.email || "Unassigned"
}

async function fetchTrainingPeek(memberId: string, signal?: AbortSignal): Promise<MemberTrainingPeekResponse> {
  const res = await fetch(`/api/members/${memberId}/training/peek`, {
    method: "GET",
    cache: "no-store",
    headers: { "cache-control": "no-store" },
    signal,
  })
  const payload = (await res.json().catch(() => null)) as { error?: string } | null
  if (!res.ok) throw new Error(payload?.error || "Failed to load training info")
  return payload as unknown as MemberTrainingPeekResponse
}

export function MemberTrainingPeek({
  memberId,
  timeZone,
  className,
  variant = "default",
}: {
  memberId: string | null
  timeZone?: string
  className?: string
  variant?: "default" | "icon"
}) {
  const { timeZone: contextTimeZone } = useTimezone()
  const resolvedTimeZone = timeZone || contextTimeZone

  const [data, setData] = React.useState<MemberTrainingPeekResponse | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const requestRef = React.useRef<AbortController | null>(null)

  const [hoverOpen, setHoverOpen] = React.useState(false)
  const hoverCloseRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const clearHoverClose = React.useCallback(() => {
    if (hoverCloseRef.current) {
      clearTimeout(hoverCloseRef.current)
      hoverCloseRef.current = null
    }
  }, [])
  const scheduleHoverClose = React.useCallback(() => {
    clearHoverClose()
    hoverCloseRef.current = setTimeout(() => setHoverOpen(false), 200)
  }, [clearHoverClose])

  React.useEffect(() => clearHoverClose, [clearHoverClose])

  const load = React.useCallback((id: string) => {
    requestRef.current?.abort()
    const controller = new AbortController()
    requestRef.current = controller
    setLoading(true)
    setError(null)
    void fetchTrainingPeek(id, controller.signal)
      .then((payload) => setData(payload))
      .catch((err) => {
        if (controller.signal.aborted) return
        setData(null)
        setError(err instanceof Error ? err.message : "Failed to load training info")
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
  }, [])

  React.useEffect(() => {
    if (!memberId) {
      requestRef.current?.abort()
      requestRef.current = null
      setData(null)
      setError(null)
      setLoading(false)
      return
    }

    load(memberId)

    return () => {
      requestRef.current?.abort()
      requestRef.current = null
    }
  }, [load, memberId])

  if (!memberId) return null

  const enrollment = data?.enrollment ?? null
  const syllabusName = enrollment?.syllabus?.name ?? null
  const syllabusId = enrollment?.syllabus?.id ?? null
  const suggestedLesson = data?.suggested_lesson ?? null
  const nextLesson = data?.next_lesson ?? null
  const nextLessonBooking = data?.next_lesson_booking ?? null

  const nextLessonLabel = loading
    ? "Loading training…"
    : error
      ? "Training unavailable"
      : nextLesson?.name
        ? (suggestedLesson?.id && nextLesson?.id && suggestedLesson.id !== nextLesson.id
            ? `Next is booked • Suggest: ${suggestedLesson.name}`
            : `Next: ${nextLesson.name}`)
        : enrollment
          ? "Next: Complete"
          : "Not enrolled"

  const trainingHref = syllabusId
    ? `/members/${memberId}?tab=training&syllabus_id=${encodeURIComponent(syllabusId)}`
    : `/members/${memberId}?tab=training`

  const formatBookingTime = (startIso: string) => {
    const dt = new Date(startIso)
    if (Number.isNaN(dt.getTime())) return null
    try {
      return new Intl.DateTimeFormat("en-NZ", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: resolvedTimeZone,
      }).format(dt)
    } catch {
      return formatDateTime(startIso, resolvedTimeZone, "short")
    }
  }

  const popoverContentClassName = "w-[360px] rounded-2xl border border-slate-300 bg-white p-0 text-slate-900 shadow-[0_24px_60px_rgba(15,23,42,0.20)] ring-1 ring-slate-900/5"

  const popoverInner = (
    <div className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Training</div>
          <div className="mt-1 truncate text-sm font-semibold text-slate-900">
            {syllabusName ?? (loading ? "Loading…" : enrollment ? "Syllabus" : "Not Enrolled")}
          </div>
        </div>
        <Link
          href={trainingHref}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm hover:bg-slate-800"
        >
          View
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="mt-3 grid gap-2">
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
          <GraduationCap className="h-4 w-4 text-slate-500" />
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Next Lesson</div>
            <div className="truncate text-xs font-semibold text-slate-900">
              {loading
                ? "Loading…"
                : error
                  ? "Couldn't load next lesson"
                  : nextLesson?.name
                    ? nextLesson.name
                    : enrollment
                      ? "All required lessons complete"
                      : "—"}
            </div>
            {!loading && !error && nextLessonBooking?.start_time ? (
              <div className="mt-0.5 truncate text-[10px] font-semibold text-slate-500">
                Booked: {formatBookingTime(nextLessonBooking.start_time) ?? "Scheduled"}
              </div>
            ) : null}
          </div>
        </div>

        {!loading &&
        !error &&
        suggestedLesson?.id &&
        nextLesson?.id &&
        suggestedLesson.id !== nextLesson.id ? (
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <BookOpen className="h-4 w-4 text-slate-500" />
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Suggested Lesson</div>
              <div className="truncate text-xs font-semibold text-slate-900">{suggestedLesson.name}</div>
              <div className="mt-0.5 truncate text-[10px] font-semibold text-slate-500">
                Next lesson is already scheduled
              </div>
            </div>
          </div>
        ) : null}

        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
          <UserRound className="h-4 w-4 text-slate-500" />
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Primary Instructor</div>
            <div className="truncate text-xs font-semibold text-slate-900">
              {loading ? "Loading…" : error ? "—" : formatPerson(enrollment?.primary_instructor ?? null)}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
          <Plane className="h-4 w-4 text-slate-500" />
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Primary Aircraft Type</div>
            <div className="truncate text-xs font-semibold text-slate-900">
              {loading
                ? "Loading…"
                : error
                  ? "—"
                  : enrollment?.aircraft_type?.name ?? (enrollment ? "Any" : "—")}
            </div>
          </div>
        </div>
      </div>

      {error ? (
        <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
          <div className="min-w-0 text-[11px] font-medium text-amber-900">
            {error}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 rounded-full border-amber-200 bg-white px-3 text-xs font-semibold text-amber-900 hover:bg-white"
            onClick={() => memberId && load(memberId)}
          >
            Retry
          </Button>
        </div>
      ) : null}
    </div>
  )

  if (variant === "icon") {
    return (
      <div
        className={cn("relative", className)}
        onMouseEnter={() => { clearHoverClose(); setHoverOpen(true) }}
        onMouseLeave={scheduleHoverClose}
      >
        <Popover open={hoverOpen} onOpenChange={setHoverOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white transition-colors hover:bg-slate-50",
                "focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-blue-500/25"
              )}
              aria-label="Show training info"
            >
              <GraduationCap className={cn("h-4 w-4", loading ? "animate-pulse text-slate-300" : "text-slate-500")} />
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            sideOffset={8}
            className={popoverContentClassName}
            onMouseEnter={clearHoverClose}
            onMouseLeave={scheduleHoverClose}
          >
            {popoverInner}
          </PopoverContent>
        </Popover>
      </div>
    )
  }

  return (
    <div className={cn("w-full", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "group flex w-full items-center justify-between gap-2.5 rounded-lg border border-slate-200/90 bg-slate-50/40 px-2.5 py-1.5 text-left shadow-none transition-[background-color,border-color] hover:border-slate-300 hover:bg-slate-50/70",
              "focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-blue-500/25"
            )}
            aria-label="Show training info"
          >
            <span className="flex min-w-0 items-center gap-2">
              <span className="grid h-6 w-6 place-items-center rounded-md border border-slate-200 bg-white shadow-[0_1px_0_rgba(15,23,42,0.04)]">
                <BookOpen className="h-3.5 w-3.5 text-slate-500" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[11px] font-semibold text-slate-800">
                  {syllabusName ?? "Training"}
                </span>
                <span className="block truncate text-[10px] font-medium text-slate-500">
                  {nextLessonLabel}
                </span>
              </span>
            </span>
            <span className="flex items-center gap-0.5 text-[10px] font-medium text-slate-500 transition-colors group-hover:text-slate-700">
              Details
              <ChevronRight className="h-3.5 w-3.5" />
            </span>
          </button>
        </PopoverTrigger>

        <PopoverContent
          align="start"
          sideOffset={8}
          className={popoverContentClassName}
        >
          {popoverInner}
        </PopoverContent>
      </Popover>
    </div>
  )
}
