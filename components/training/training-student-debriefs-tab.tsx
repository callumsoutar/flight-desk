"use client"

import * as React from "react"
import Link from "next/link"
import {
  IconCalendar,
  IconChevronDown,
  IconMessage,
  IconUser,
} from "@tabler/icons-react"

import { cn } from "@/lib/utils"
import type { TrainingDebriefRow, TrainingDebriefsResponse } from "@/lib/types/training-debriefs"

const DEBRIEFS_CACHE_TTL_MS = 30_000
const debriefsCache = new Map<
  string,
  { debriefs: TrainingDebriefRow[]; fetchedAt: number }
>()

function safeFormatDateISO(value: string | null | undefined) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  const yyyy = String(date.getFullYear()).padStart(4, "0")
  const mm = String(date.getMonth() + 1).padStart(2, "0")
  const dd = String(date.getDate()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
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
          "[&_p:not(:first-child)]:mt-3 [&_p]:leading-relaxed [&_div:not(:first-child)]:mt-3 [&_div]:leading-relaxed",
          "[&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5",
          "[&_ol]:mt-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1.5",
          "[&_a]:font-medium [&_a]:text-primary hover:[&_a]:underline [&_a]:underline-offset-4",
          "[&_strong]:font-semibold [&_b]:font-semibold [&_em]:italic [&_i]:italic",
        ].join(" ")}
        dangerouslySetInnerHTML={{ __html: safeHtml }}
      />
    )
  }

  return <p className={`${className} whitespace-pre-wrap`}>{trimmed}</p>
}

function textToBulletLines(value: string | null | undefined) {
  const text = htmlToPlainText(value)
  if (!text) return []
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  return lines.length >= 2 ? lines : []
}

function decodeEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
}

function htmlToPlainText(value: string | null | undefined) {
  const raw = (value ?? "").trim()
  if (!raw) return ""

  let text = decodeEntities(raw)
  text = text.replace(/<\s*br\s*\/?>/gi, "\n")
  text = text.replace(/<\/\s*(p|div|li)\s*>/gi, "\n")
  text = text.replace(/<[^>]*>/g, "")
  text = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n")

  return text
    .split("\n")
    .map((l) => l.trim())
    .join("\n")
    .trim()
}

function htmlToSingleLine(value: string | null | undefined) {
  const text = htmlToPlainText(value)
  if (!text) return ""
  return text.replace(/\s+/g, " ").trim()
}

function SectionHeading({
  label,
  className,
}: {
  label: string
  className: string
}) {
  return (
    <div className={cn("text-[11px] font-bold uppercase tracking-wider text-muted-foreground", className)}>
      {label}
    </div>
  )
}

export function TrainingStudentDebriefsTab({
  userId,
  syllabusId,
}: {
  userId: string
  syllabusId: string
}) {
  const [debriefs, setDebriefs] = React.useState<TrainingDebriefRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [refreshing, setRefreshing] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [expandedId, setExpandedId] = React.useState<string | null>(null)

  React.useEffect(() => {
    const cacheKey = `${userId}:${syllabusId}:25`
    const cached = debriefsCache.get(cacheKey)
    const isFresh = cached && Date.now() - cached.fetchedAt < DEBRIEFS_CACHE_TTL_MS

    if (cached) {
      setDebriefs(cached.debriefs)
      setLoading(false)
      setError(null)
      setExpandedId((prev) => {
        if (prev && cached.debriefs.some((d) => d.id === prev)) return prev
        return cached.debriefs[0]?.id ?? null
      })
    } else {
      setExpandedId(null)
    }

    if (isFresh) return

    const controller = new AbortController()

    async function load() {
      if (!cached) setLoading(true)
      else setRefreshing(true)
      setError(null)
      try {
        const url = new URL(`/api/members/${userId}/training/debriefs`, window.location.origin)
        url.searchParams.set("syllabus_id", syllabusId)
        url.searchParams.set("limit", "25")

        const response = await fetch(url.toString(), {
          method: "GET",
          cache: "no-store",
          headers: { "cache-control": "no-store" },
          signal: controller.signal,
        })

        if (!response.ok) throw new Error("Failed to load debriefs")
        const json = (await response.json()) as TrainingDebriefsResponse

        if (controller.signal.aborted) return
        const nextDebriefs = json.debriefs ?? []
        debriefsCache.set(cacheKey, { debriefs: nextDebriefs, fetchedAt: Date.now() })
        setDebriefs(nextDebriefs)
        setExpandedId((prev) => {
          if (prev && nextDebriefs.some((d) => d.id === prev)) return prev
          return nextDebriefs[0]?.id ?? null
        })
      } catch (err) {
        if (controller.signal.aborted) return
        if (!cached) {
          setDebriefs([])
          setExpandedId(null)
        }
        setError(err instanceof Error ? err.message : "Failed to load debriefs")
      } finally {
        if (controller.signal.aborted) return
        setRefreshing(false)
        setLoading(false)
      }
    }

    void load()
    return () => {
      controller.abort()
    }
  }, [syllabusId, userId])

  if (loading) {
    return (
      <div className="p-6">
        <div className="space-y-3">
          <div className="h-6 w-40 rounded bg-muted/50" />
          <div className="h-20 w-full rounded-xl border bg-card" />
          <div className="h-20 w-full rounded-xl border bg-card" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        {error}
      </div>
    )
  }

  if (!debriefs.length) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <IconCalendar className="w-10 h-10 mb-3 opacity-40" />
        <p className="font-medium">No debriefs recorded yet</p>
        <p className="text-sm mt-1">Debrief reports will appear here after lessons</p>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">Recent Debriefs</h3>
        {refreshing ? <div className="text-xs text-muted-foreground">Updating…</div> : null}
      </div>

      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        {debriefs.map((debrief) => {
          const isOpen = expandedId === debrief.id
          const hasHighlights = Boolean(debrief.lesson_highlights?.trim())
          const hasImprovements = Boolean(debrief.areas_for_improvement?.trim())
          const hasRecommendation = Boolean(debrief.focus_next_lesson?.trim())
          const hasSafetyConcerns = Boolean(debrief.safety_concerns?.trim())
          const hasSecondaryNotes = hasHighlights || hasImprovements || hasRecommendation || hasSafetyConcerns

          const instructorName = debrief.instructor
            ? formatName({
                first_name: debrief.instructor.user?.first_name ?? debrief.instructor.first_name,
                last_name: debrief.instructor.user?.last_name ?? debrief.instructor.last_name,
                email: debrief.instructor.user?.email ?? null,
              })
            : "—"

          const lessonName = debrief.lesson?.name ?? "Training Flight"
          const aircraftReg = debrief.booking?.aircraft?.registration ?? "—"
          const debriefHref = debrief.booking_id ? `/bookings/${debrief.booking_id}/debrief` : null

          const preview =
            htmlToSingleLine(debrief.instructor_comments) ||
            htmlToSingleLine(debrief.lesson_highlights) ||
            htmlToSingleLine(debrief.areas_for_improvement) ||
            htmlToSingleLine(debrief.focus_next_lesson) ||
            ""

          const toggle = () => setExpandedId(isOpen ? null : debrief.id)

          return (
            <div key={debrief.id} className="border-b border-border/60 last:border-0">
              <button
                type="button"
                onClick={toggle}
                className={cn(
                  "w-full px-4 py-3 text-left transition-colors",
                  isOpen ? "bg-muted/10" : "hover:bg-muted/10"
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-muted/40 text-muted-foreground shrink-0">
                    <IconMessage className="h-4 w-4" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-foreground truncate">{lessonName}</div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1.5 tabular-nums">
                            <IconCalendar className="h-3.5 w-3.5" />
                            {safeFormatDateISO(debrief.date)}
                          </span>
                          <span className="inline-flex items-center gap-1.5 min-w-0">
                            <IconUser className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{instructorName}</span>
                          </span>
                          {aircraftReg !== "—" ? <span className="tabular-nums">{aircraftReg}</span> : null}
                        </div>

                        {!isOpen && preview ? (
                          <div className="mt-2 text-xs text-muted-foreground line-clamp-1">
                            {preview}
                          </div>
                        ) : null}
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        {debriefHref ? (
                          <Link
                            href={debriefHref}
                            onClick={(e) => e.stopPropagation()}
                            className="hidden sm:inline text-xs font-medium text-primary hover:underline underline-offset-4"
                          >
                            Open
                          </Link>
                        ) : null}
                        <IconChevronDown
                          className={cn(
                            "mt-0.5 h-5 w-5 text-muted-foreground transition-transform",
                            isOpen ? "rotate-180" : ""
                          )}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </button>

              {isOpen ? (
                <div className="border-t border-border/60 bg-muted/5 px-4 py-4 pl-[3.25rem] space-y-5">
                  <div className="space-y-1.5">
                    <SectionHeading label="Summary" className="" />
                    <RichText
                      value={debrief.instructor_comments}
                      placeholder="No summary recorded."
                      className="text-sm leading-relaxed text-foreground/90"
                    />
                  </div>

                  {hasHighlights ? (
                    <div className="space-y-1.5">
                      <SectionHeading label="Strengths" className="text-emerald-600" />
                      {textToBulletLines(debrief.lesson_highlights).length ? (
                        <ul className="space-y-1 pl-5 list-disc text-sm [&_li::marker]:text-emerald-500/80">
                          {textToBulletLines(debrief.lesson_highlights).map((line, i) => (
                            <li key={i}>{line}</li>
                          ))}
                        </ul>
                      ) : (
                        <RichText
                          value={debrief.lesson_highlights}
                          placeholder="No strengths recorded."
                          className="text-sm leading-relaxed"
                        />
                      )}
                    </div>
                  ) : null}

                  {hasImprovements ? (
                    <div className="space-y-1.5">
                      <SectionHeading label="Areas for improvement" className="text-amber-700" />
                      {textToBulletLines(debrief.areas_for_improvement).length ? (
                        <ul className="space-y-1 pl-5 list-disc text-sm [&_li::marker]:text-amber-500/80">
                          {textToBulletLines(debrief.areas_for_improvement).map((line, i) => (
                            <li key={i}>{line}</li>
                          ))}
                        </ul>
                      ) : (
                        <RichText
                          value={debrief.areas_for_improvement}
                          placeholder="No improvements recorded."
                          className="text-sm leading-relaxed"
                        />
                      )}
                    </div>
                  ) : null}

                  {hasRecommendation ? (
                    <div className="space-y-1.5">
                      <SectionHeading label="Next recommendation" className="text-indigo-600" />
                      <RichText
                        value={debrief.focus_next_lesson}
                        placeholder="No recommendation recorded."
                        className="text-sm font-medium leading-relaxed text-foreground"
                      />
                    </div>
                  ) : null}

                  {hasSafetyConcerns ? (
                    <div className="space-y-1.5">
                      <SectionHeading label="Safety concerns" className="text-rose-600" />
                      <RichText
                        value={debrief.safety_concerns}
                        placeholder="No safety concerns recorded."
                        className="text-sm leading-relaxed"
                      />
                    </div>
                  ) : null}

                  {!hasSecondaryNotes && !debrief.instructor_comments?.trim() ? (
                    <div className="text-sm text-muted-foreground">No notes recorded.</div>
                  ) : null}

                  {debriefHref ? (
                    <div className="pt-1">
                      <Link
                        href={debriefHref}
                        className="text-xs font-medium text-primary hover:underline underline-offset-4"
                      >
                        Open debrief
                      </Link>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}
