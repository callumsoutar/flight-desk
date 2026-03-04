"use client"

import * as React from "react"
import Link from "next/link"
import {
  IconCheck,
  IconChevronDown,
  IconChevronRight,
  IconClock,
  IconRefresh,
} from "@tabler/icons-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type {
  TrainingFlyingResponse,
  TrainingLessonProgressRow,
  TrainingLessonStatus,
} from "@/lib/types/training-flying"

const DATE_FORMATTER = new Intl.DateTimeFormat("en-NZ", {
  day: "numeric",
  month: "short",
  year: "numeric",
})

function safeFormatDate(value: string | null | undefined) {
  if (!value) return "—"
  try {
    return DATE_FORMATTER.format(new Date(value))
  } catch {
    return "—"
  }
}

function statusBadge(status: TrainingLessonStatus) {
  if (status === "completed") {
    return {
      label: "Completed",
      className: "border-emerald-200/60 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-500/10 dark:text-emerald-300",
    }
  }
  if (status === "needs_repeat") {
    return {
      label: "Needs repeat",
      className: "border-rose-200/60 bg-rose-50 text-rose-700 dark:border-rose-900/40 dark:bg-rose-500/10 dark:text-rose-300",
    }
  }
  if (status === "in_progress") {
    return {
      label: "In progress",
      className: "border-amber-200/60 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-500/10 dark:text-amber-300",
    }
  }
  return {
    label: "Not started",
    className: "border-slate-200/60 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-500/10 dark:text-slate-300",
  }
}

function lessonIcon(status: TrainingLessonStatus) {
  if (status === "completed") return <IconCheck className="h-4 w-4 text-emerald-600" />
  if (status === "needs_repeat") return <IconRefresh className="h-4 w-4 text-rose-600" />
  if (status === "in_progress") return <IconClock className="h-4 w-4 text-amber-600" />
  return <div className="h-4 w-4 rounded-full border-2 border-border" />
}

function formatName(user: { first_name: string | null; last_name: string | null; email?: string | null } | null) {
  if (!user) return "—"
  return [user.first_name, user.last_name].filter(Boolean).join(" ") || user.email || "—"
}

function sanitizeHTML(html: string) {
  let sanitized = html
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
  sanitized = sanitized.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "")
  sanitized = sanitized.replace(
    /<(object|embed)\b[^<]*(?:(?!<\/(object|embed)>)<[^<]*)*<\/(object|embed)>/gi,
    ""
  )
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, "")
  return sanitized
}

function isLikelyHtml(value: string) {
  return /<\/?[a-z][\s\S]*>/i.test(value)
}

function RichText({
  value,
  placeholder,
  className = "text-sm leading-relaxed text-foreground/90",
}: {
  value: string | null | undefined
  placeholder: React.ReactNode
  className?: string
}) {
  const trimmed = value?.trim()
  if (!trimmed) return <div className="text-muted-foreground italic opacity-60">{placeholder}</div>

  if (isLikelyHtml(trimmed)) {
    const safeHtml = sanitizeHTML(trimmed)
    return (
      <div
        className={[
          className,
          "[&_p:not(:first-child)]:mt-2 [&_p]:leading-relaxed [&_div:not(:first-child)]:mt-2 [&_div]:leading-relaxed",
          "[&_ul]:mt-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1",
          "[&_ol]:mt-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1",
          "[&_a]:font-medium [&_a]:text-primary hover:[&_a]:underline [&_a]:underline-offset-4",
          "[&_strong]:font-semibold [&_b]:font-semibold [&_em]:italic [&_i]:italic",
        ].join(" ")}
        dangerouslySetInnerHTML={{ __html: safeHtml }}
      />
    )
  }

  return <p className={`${className} whitespace-pre-wrap`}>{trimmed}</p>
}

function LessonRow({
  row,
  isExpanded,
  onToggle,
}: {
  row: TrainingLessonProgressRow
  isExpanded: boolean
  onToggle: () => void
}) {
  const latest = row.latest_attempt
  const badge = statusBadge(row.status)
  const canExpand = Boolean(latest)

  const instructorName = latest?.instructor
    ? formatName({
        first_name: latest.instructor.user?.first_name ?? latest.instructor.first_name,
        last_name: latest.instructor.user?.last_name ?? latest.instructor.last_name,
        email: latest.instructor.user?.email ?? null,
      })
    : "—"

  const attemptLabel = row.attempts > 0 ? `${row.attempts} att.` : null
  const completedLabel = row.completed_at ? safeFormatDate(row.completed_at) : null

  return (
    <div className="border-b border-border/50 last:border-0">
      <div
        className={cn(
          "flex items-center gap-3 px-4 py-3 transition-colors",
          canExpand ? "cursor-pointer hover:bg-muted/40" : ""
        )}
        onClick={() => (canExpand ? onToggle() : null)}
      >
        {lessonIcon(row.status)}
        <span className="text-xs font-mono text-muted-foreground w-10 shrink-0">
          #{row.lesson.order}
        </span>
        <span className="text-sm font-medium flex-1 min-w-0 truncate">{row.lesson.name}</span>

        <Badge variant="outline" className={cn("text-[10px] font-bold px-2 py-1 rounded-lg uppercase tracking-wide", badge.className)}>
          {badge.label}
        </Badge>

        {attemptLabel ? (
          <span className="hidden sm:inline text-xs text-muted-foreground tabular-nums">{attemptLabel}</span>
        ) : null}
        {completedLabel ? (
          <span className="hidden sm:inline text-xs text-muted-foreground tabular-nums">{completedLabel}</span>
        ) : null}

        {canExpand ? (
          isExpanded ? (
            <IconChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <IconChevronRight className="h-4 w-4 text-muted-foreground" />
          )
        ) : null}
      </div>

      {isExpanded && canExpand ? (
        <div className="px-4 pb-4 pl-16 space-y-2">
          <div className="rounded-lg bg-muted/20 px-4 py-3 text-sm">
            <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Outcome</span>
                <span className="font-medium">{latest?.status ?? "—"}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Attempt</span>
                <span className="font-medium tabular-nums">
                  {(latest?.attempt ?? row.attempts) || "—"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Date</span>
                <span className="font-medium tabular-nums">{safeFormatDate(latest?.date ?? null)}</span>
              </div>
              {instructorName !== "—" ? (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Instructor</span>
                  <span className="font-medium truncate">{instructorName}</span>
                </div>
              ) : null}
            </div>

            <div className="mt-3 border-t border-border/50 pt-3">
              <RichText
                value={latest?.instructor_comments}
                placeholder="No comments recorded."
                className="text-sm leading-relaxed text-foreground/90"
              />
            </div>

            {latest?.booking_id ? (
              <div className="mt-3 flex items-center justify-end">
                <Button
                  asChild
                  size="sm"
                  variant="outline"
                  className="h-8"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Link href={`/bookings/${latest.booking_id}/debrief`}>Open debrief</Link>
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}

export function TrainingStudentFlyingTab({
  userId,
  syllabusId,
}: {
  userId: string
  syllabusId: string
}) {
  const [rows, setRows] = React.useState<TrainingLessonProgressRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [expandedLessonId, setExpandedLessonId] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      setExpandedLessonId(null)

      try {
        const url = new URL(`/api/members/${userId}/training/flying`, window.location.origin)
        url.searchParams.set("syllabus_id", syllabusId)

        const response = await fetch(url.toString(), {
          method: "GET",
          cache: "no-store",
          headers: { "cache-control": "no-store" },
        })

        if (!response.ok) throw new Error("Failed to load lessons")
        const json = (await response.json()) as TrainingFlyingResponse
        if (cancelled) return

        setRows(json.lessons ?? [])
      } catch (err) {
        if (cancelled) return
        setRows([])
        setError(err instanceof Error ? err.message : "Failed to load lessons")
      } finally {
        if (cancelled) return
        setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [syllabusId, userId])

  const completed = React.useMemo(
    () => rows.filter((r) => r.status === "completed").length,
    [rows]
  )

  if (loading) {
    return (
      <div className="p-6">
        <div className="space-y-3">
          <div className="h-6 w-48 rounded bg-muted/50" />
          <div className="h-20 w-full rounded-xl border bg-card" />
          <div className="h-20 w-full rounded-xl border bg-card" />
        </div>
      </div>
    )
  }

  if (error) {
    return <div className="p-6 text-sm text-muted-foreground">{error}</div>
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Syllabus Lessons</h3>
        <span className="text-xs text-muted-foreground tabular-nums">
          {completed}/{rows.length} completed
        </span>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        {rows.length ? (
          rows.map((row) => (
            <LessonRow
              key={row.lesson.id}
              row={row}
              isExpanded={expandedLessonId === row.lesson.id}
              onToggle={() =>
                setExpandedLessonId((prev) => (prev === row.lesson.id ? null : row.lesson.id))
              }
            />
          ))
        ) : (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No lessons found for this syllabus.
          </div>
        )}
      </div>
    </div>
  )
}
