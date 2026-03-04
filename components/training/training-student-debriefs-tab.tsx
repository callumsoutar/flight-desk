"use client"

import * as React from "react"
import {
  IconCalendar,
  IconChevronDown,
  IconUser,
} from "@tabler/icons-react"

import { cn } from "@/lib/utils"
import type { TrainingDebriefRow, TrainingDebriefsResponse } from "@/lib/types/training-debriefs"

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
  const trimmed = value?.trim() ?? ""
  if (!trimmed) return []
  const lines = trimmed
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  return lines.length >= 2 ? lines : []
}

function SectionHeading({
  label,
  className,
}: {
  label: string
  className: string
}) {
  return (
    <div className={cn("text-sm font-semibold tracking-wide", className)}>
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
  const [error, setError] = React.useState<string | null>(null)
  const [expandedId, setExpandedId] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const url = new URL(`/api/members/${userId}/training/debriefs`, window.location.origin)
        url.searchParams.set("syllabus_id", syllabusId)
        url.searchParams.set("limit", "25")

        const response = await fetch(url.toString(), {
          method: "GET",
          cache: "no-store",
          headers: { "cache-control": "no-store" },
        })

        if (!response.ok) throw new Error("Failed to load debriefs")
        const json = (await response.json()) as TrainingDebriefsResponse

        if (cancelled) return
        setDebriefs(json.debriefs ?? [])
        setExpandedId((prev) => prev ?? (json.debriefs?.[0]?.id ?? null))
      } catch (err) {
        if (cancelled) return
        setDebriefs([])
        setExpandedId(null)
        setError(err instanceof Error ? err.message : "Failed to load debriefs")
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
      <h3 className="text-sm font-semibold">Recent Debriefs</h3>

      <div className="relative">
        <div className="absolute left-4 top-6 bottom-6 w-px bg-slate-200 dark:bg-slate-700" />

        <div className="space-y-4">
          {debriefs.map((debrief, index) => {
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

            return (
              <div key={debrief.id} className="relative pl-10">
                <div
                  className={cn(
                    "absolute left-2 top-5 w-3.5 h-3.5 rounded-full border-2 bg-white dark:bg-slate-900",
                    index === 0 ? "border-indigo-500" : "border-slate-300 dark:border-slate-600"
                  )}
                />

	                <div
	                  className={cn(
	                    "rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden transition-all",
	                    isOpen ? "border-slate-300 dark:border-slate-600" : ""
	                  )}
	                >
                  <button
                    onClick={() => setExpandedId(isOpen ? null : debrief.id)}
                    className="w-full p-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <h4 className="font-semibold text-foreground truncate">{lessonName}</h4>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-muted-foreground">
	                          <span className="flex items-center gap-1.5">
	                            <IconCalendar className="w-3.5 h-3.5" />
	                            {safeFormatDateISO(debrief.date)}
	                          </span>
                          <span className="flex items-center gap-1.5">
                            <IconUser className="w-3.5 h-3.5" />
                            {instructorName}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {aircraftReg}
                          </span>
                        </div>
                      </div>
                      <IconChevronDown
                        className={cn(
                          "w-5 h-5 text-muted-foreground transition-transform shrink-0",
                          isOpen ? "rotate-180" : ""
                        )}
                      />
                    </div>
                  </button>

	                  {isOpen ? (
	                    <div className="p-6 border-t border-slate-100 dark:border-slate-800 space-y-6">
	                      <div className="space-y-2">
	                        <SectionHeading label="SUMMARY" className="text-muted-foreground" />
	                        <RichText
	                          value={debrief.instructor_comments}
	                          placeholder="No summary recorded."
	                          className="text-[15px] leading-relaxed text-foreground/90"
	                        />
	                      </div>

	                      {hasHighlights ? (
	                        <div className="space-y-2">
	                          <SectionHeading label="STRENGTHS" className="text-emerald-600" />
	                          {textToBulletLines(debrief.lesson_highlights).length ? (
	                            <ul className="space-y-1 pl-5 list-disc text-[15px] [&_li::marker]:text-emerald-500">
	                              {textToBulletLines(debrief.lesson_highlights).map((line, i) => (
	                                <li key={i}>{line}</li>
	                              ))}
	                            </ul>
	                          ) : (
	                            <RichText
	                              value={debrief.lesson_highlights}
	                              placeholder="No strengths recorded."
	                              className="text-[15px] leading-relaxed [&_li::marker]:text-emerald-500"
	                            />
	                          )}
	                        </div>
	                      ) : null}

	                      {hasImprovements ? (
	                        <div className="space-y-2">
	                          <SectionHeading label="AREAS FOR IMPROVEMENT" className="text-amber-600" />
	                          {textToBulletLines(debrief.areas_for_improvement).length ? (
	                            <ul className="space-y-1 pl-5 list-disc text-[15px] [&_li::marker]:text-amber-500">
	                              {textToBulletLines(debrief.areas_for_improvement).map((line, i) => (
	                                <li key={i}>{line}</li>
	                              ))}
	                            </ul>
	                          ) : (
	                            <RichText
	                              value={debrief.areas_for_improvement}
	                              placeholder="No improvements recorded."
	                              className="text-[15px] leading-relaxed [&_li::marker]:text-amber-500"
	                            />
	                          )}
	                        </div>
	                      ) : null}

	                      {hasRecommendation ? (
	                        <div className="space-y-2">
	                          <SectionHeading label="NEXT RECOMMENDATION" className="text-muted-foreground" />
	                          <RichText
	                            value={debrief.focus_next_lesson}
	                            placeholder="No recommendation recorded."
	                            className="text-[18px] font-medium leading-snug text-foreground"
	                          />
	                        </div>
	                      ) : null}

	                      {hasSafetyConcerns ? (
	                        <div className="space-y-2">
	                          <SectionHeading label="SAFETY CONCERNS" className="text-rose-600" />
	                          <RichText
	                            value={debrief.safety_concerns}
	                            placeholder="No safety concerns recorded."
	                            className="text-[15px] leading-relaxed"
	                          />
	                        </div>
	                      ) : null}

	                      {!hasSecondaryNotes && !debrief.instructor_comments?.trim() ? (
	                        <div className="text-sm text-muted-foreground">No notes recorded.</div>
	                      ) : null}
	                    </div>
	                  ) : null}
	                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
