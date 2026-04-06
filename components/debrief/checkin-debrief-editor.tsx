"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  IconArrowRight,
  IconCheck,
  IconChevronDown,
  IconChevronRight,
  IconCloud,
  IconLoader2,
  IconMessage,
  IconNotebook,
  IconTarget,
  IconX,
} from "@tabler/icons-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { RichTextEditor } from "@/components/debrief/rich-text-editor"
import type { LessonProgressRow } from "@/lib/types/tables"
import { cn } from "@/lib/utils"

type InstructionType = "dual" | "solo" | "trial" | null
type LessonOutcome = "pass" | "not yet competent"

type DebriefPayload = {
  status?: LessonOutcome | null
  instructor_comments?: string | null
  focus_next_lesson?: string | null
  lesson_highlights?: string | null
  areas_for_improvement?: string | null
  airmanship?: string | null
  weather_conditions?: string | null
  safety_concerns?: string | null
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  if (!res.ok) {
    let message = "Request failed"
    try {
      const data = await res.json()
      if (typeof data?.error === "string") message = data.error
    } catch {
      // ignore
    }
    throw new Error(message)
  }
  return (await res.json()) as T
}

function normalizeNullable(value: string | null | undefined) {
  if (value == null) return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function isLikelyHtml(value: string) {
  return /<\/?[a-z][\s\S]*>/i.test(value)
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
}

function plainTextToHtml(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return ""
  const escaped = escapeHtml(trimmed)
  return escaped
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${paragraph.replaceAll("\n", "<br />")}</p>`)
    .join("")
}

function toRichTextHtml(value: string | null | undefined) {
  const trimmed = value?.trim() ?? ""
  if (!trimmed) return ""
  if (isLikelyHtml(trimmed)) return trimmed
  return plainTextToHtml(trimmed)
}

function extractPlainText(value: string) {
  if (!value.trim()) return ""
  if (!isLikelyHtml(value)) return value
  try {
    const doc = new DOMParser().parseFromString(value, "text/html")
    return doc.body.textContent ?? ""
  } catch {
    return value
  }
}

function normalizeRichTextNullable(value: string | null | undefined) {
  if (value == null) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  const text = extractPlainText(trimmed).trim()
  return text.length > 0 ? trimmed : null
}

function normalize(value: string) {
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : ""
}

export function CheckinDebriefEditor({
  bookingId,
  instructionType,
  initial,
  meta,
  onSaved,
  continueHref,
  continueLabel,
  viewHref,
  skipDebriefHref,
  collapsible = true,
  showMeta = true,
  defaultOpen,
}: {
  bookingId: string
  instructionType: InstructionType
  initial: LessonProgressRow | null
  meta: {
    memberName: string
    instructorName: string
    aircraftReg: string
    bookingDate: string
    lessonName: string
    syllabusName?: string | null
  }
  onSaved: (next: LessonProgressRow) => void
  continueHref?: string | null
  continueLabel?: string
  viewHref?: string | null
  skipDebriefHref?: string | null
  collapsible?: boolean
  showMeta?: boolean
  defaultOpen?: boolean
}) {
  const router = useRouter()
  const eligible = instructionType === "dual" || instructionType === "trial"

  const hasExisting = Boolean(initial?.id)
  const showViewButton = hasExisting && Boolean(viewHref) && viewHref !== continueHref
  const primaryButtonClassName =
    "bg-slate-700 font-semibold text-white shadow-lg transition-all hover:bg-slate-800 hover:shadow-xl"
  const [isOpen, setIsOpen] = React.useState(() => {
    if (!collapsible) return true
    if (defaultOpen != null) return defaultOpen
    return !hasExisting
  })

  const [status, setStatus] = React.useState<LessonOutcome | null>(initial?.status ?? null)
  const [comments, setComments] = React.useState(() => toRichTextHtml(initial?.instructor_comments))
  const [nextSteps, setNextSteps] = React.useState(initial?.focus_next_lesson ?? "")
  const [lessonHighlights, setLessonHighlights] = React.useState(initial?.lesson_highlights ?? "")
  const [areasForImprovement, setAreasForImprovement] = React.useState(initial?.areas_for_improvement ?? "")
  const [airmanship, setAirmanship] = React.useState(initial?.airmanship ?? "")
  const [weatherConditions, setWeatherConditions] = React.useState(initial?.weather_conditions ?? "")
  const [safetyConcerns, setSafetyConcerns] = React.useState(initial?.safety_concerns ?? "")
  const [isSaving, setIsSaving] = React.useState(false)
  const [detailsOpen, setDetailsOpen] = React.useState(() => {
    return Boolean(
      normalize(initial?.lesson_highlights ?? "").length > 0 ||
        normalize(initial?.areas_for_improvement ?? "").length > 0 ||
        normalize(initial?.airmanship ?? "").length > 0 ||
        normalize(initial?.weather_conditions ?? "").length > 0 ||
        normalize(initial?.safety_concerns ?? "").length > 0
    )
  })

  const baseline = React.useMemo(() => {
    return {
      status: initial?.status ?? null,
      instructor_comments: normalizeRichTextNullable(toRichTextHtml(initial?.instructor_comments)) ?? null,
      focus_next_lesson: normalizeNullable(initial?.focus_next_lesson) ?? null,
      lesson_highlights: normalizeNullable(initial?.lesson_highlights) ?? null,
      areas_for_improvement: normalizeNullable(initial?.areas_for_improvement) ?? null,
      airmanship: normalizeNullable(initial?.airmanship) ?? null,
      weather_conditions: normalizeNullable(initial?.weather_conditions) ?? null,
      safety_concerns: normalizeNullable(initial?.safety_concerns) ?? null,
    }
  }, [
    initial?.airmanship,
    initial?.areas_for_improvement,
    initial?.focus_next_lesson,
    initial?.instructor_comments,
    initial?.lesson_highlights,
    initial?.safety_concerns,
    initial?.status,
    initial?.weather_conditions,
  ])

  const current = React.useMemo(() => {
    return {
      status,
      instructor_comments: normalizeRichTextNullable(comments),
      focus_next_lesson: normalizeNullable(nextSteps),
      lesson_highlights: normalizeNullable(lessonHighlights),
      areas_for_improvement: normalizeNullable(areasForImprovement),
      airmanship: normalizeNullable(airmanship),
      weather_conditions: normalizeNullable(weatherConditions),
      safety_concerns: normalizeNullable(safetyConcerns),
    }
  }, [
    airmanship,
    areasForImprovement,
    comments,
    lessonHighlights,
    nextSteps,
    safetyConcerns,
    status,
    weatherConditions,
  ])

  const isDirty = React.useMemo(() => {
    return (
      baseline.status !== current.status ||
      baseline.instructor_comments !== current.instructor_comments ||
      baseline.focus_next_lesson !== current.focus_next_lesson ||
      baseline.lesson_highlights !== current.lesson_highlights ||
      baseline.areas_for_improvement !== current.areas_for_improvement ||
      baseline.airmanship !== current.airmanship ||
      baseline.weather_conditions !== current.weather_conditions ||
      baseline.safety_concerns !== current.safety_concerns
    )
  }, [baseline, current])

  React.useEffect(() => {
    setStatus(initial?.status ?? null)
    setComments(toRichTextHtml(initial?.instructor_comments))
    setNextSteps(initial?.focus_next_lesson ?? "")
    setLessonHighlights(initial?.lesson_highlights ?? "")
    setAreasForImprovement(initial?.areas_for_improvement ?? "")
    setAirmanship(initial?.airmanship ?? "")
    setWeatherConditions(initial?.weather_conditions ?? "")
    setSafetyConcerns(initial?.safety_concerns ?? "")
    setIsOpen((prev) => {
      if (!collapsible) return true
      if (defaultOpen != null) return defaultOpen
      return initial?.id ? prev : true
    })
    setDetailsOpen(Boolean(
      normalize(initial?.lesson_highlights ?? "").length > 0 ||
        normalize(initial?.areas_for_improvement ?? "").length > 0 ||
        normalize(initial?.airmanship ?? "").length > 0 ||
        normalize(initial?.weather_conditions ?? "").length > 0 ||
        normalize(initial?.safety_concerns ?? "").length > 0
    ))
  }, [
    initial?.airmanship,
    initial?.areas_for_improvement,
    initial?.focus_next_lesson,
    initial?.id,
    initial?.instructor_comments,
    initial?.lesson_highlights,
    initial?.safety_concerns,
    initial?.status,
    initial?.weather_conditions,
    collapsible,
    defaultOpen,
  ])

  const hasContent =
    (normalizeRichTextNullable(comments) != null) ||
    normalize(nextSteps).length > 0 ||
    normalize(lessonHighlights).length > 0 ||
    normalize(areasForImprovement).length > 0 ||
    normalize(airmanship).length > 0 ||
    normalize(weatherConditions).length > 0 ||
    normalize(safetyConcerns).length > 0 ||
    status != null

  const previewLine = React.useMemo(() => {
    if (current.instructor_comments) return extractPlainText(current.instructor_comments).trim()
    if (current.focus_next_lesson) return current.focus_next_lesson.trim()
    return ""
  }, [current.focus_next_lesson, current.instructor_comments])

  const handleSave = async (options?: { continueAfterSave?: boolean }) => {
    if (!hasContent && !hasExisting) {
      toast.message("Add comments or an outcome to save a debrief.")
      return
    }
    setIsSaving(true)
    const payload: DebriefPayload = {
      status,
      instructor_comments: normalizeRichTextNullable(comments),
      focus_next_lesson: normalizeNullable(nextSteps),
      lesson_highlights: normalizeNullable(lessonHighlights),
      areas_for_improvement: normalizeNullable(areasForImprovement),
      airmanship: normalizeNullable(airmanship),
      weather_conditions: normalizeNullable(weatherConditions),
      safety_concerns: normalizeNullable(safetyConcerns),
    }
    try {
      const result = await fetchJson<{ lesson_progress: LessonProgressRow }>(
        `/api/bookings/${bookingId}/debrief`,
        {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        }
      )
      onSaved(result.lesson_progress)
      toast.success("Debrief saved")
      if (options?.continueAfterSave && continueHref) {
        router.push(continueHref)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save debrief")
    } finally {
      setIsSaving(false)
    }
  }

  if (!eligible) {
    return (
      <div className="rounded-lg border border-border/60 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
        Debrief entry is only available for dual or trial flights.
      </div>
    )
  }

  return (
    <div id="lesson-debrief" className="scroll-mt-20">
      {/* ── Header bar ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-base font-semibold text-foreground">Lesson Debrief</h3>
          {isDirty ? (
            <Badge
              variant="outline"
              className="h-5 rounded-full border-amber-500/30 bg-amber-50 px-2 text-[10px] font-semibold uppercase tracking-wider text-amber-700 dark:bg-amber-950/30 dark:text-amber-300"
            >
              Unsaved
            </Badge>
          ) : hasExisting ? (
            <Badge
              variant="outline"
              className="h-5 rounded-full border-emerald-500/30 bg-emerald-50 px-2 text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
            >
              Saved
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="h-5 rounded-full px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
            >
              Optional
            </Badge>
          )}
        </div>

        {collapsible ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
            onClick={() => setIsOpen((prev) => !prev)}
          >
            {isOpen ? "Collapse" : hasExisting ? "Edit" : "Expand"}
            <IconChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-200", isOpen && "rotate-180")} />
          </Button>
        ) : null}
      </div>

      {/* ── Collapsed preview ──────────────────────────────────── */}
      {collapsible && !isOpen ? (
        <button
          type="button"
          className={cn(
            "mt-3 flex w-full items-center justify-between rounded-lg border px-4 py-3.5 text-left transition-colors",
            hasExisting
              ? "border-border bg-card hover:border-border/80 hover:bg-accent/50"
              : "border-dashed border-muted-foreground/25 bg-muted/20 hover:border-primary/40 hover:bg-accent/30"
          )}
          onClick={() => setIsOpen(true)}
        >
          <div className="flex items-center gap-3">
            <div className={cn(
              "flex h-8 w-8 items-center justify-center rounded-full",
              hasExisting ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400" : "bg-muted text-muted-foreground"
            )}>
              {hasExisting ? <IconCheck className="h-4 w-4" /> : <IconMessage className="h-4 w-4" />}
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">
                {hasExisting ? "Debrief recorded" : "Add lesson debrief"}
              </p>
              {hasExisting && previewLine ? (
                <p className="mt-0.5 max-w-md truncate text-xs text-muted-foreground">
                  &ldquo;{previewLine}&rdquo;
                </p>
              ) : !hasExisting ? (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Record outcome, notes, and training details
                </p>
              ) : null}
            </div>
          </div>
          <IconChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60" />
        </button>
      ) : null}

      {/* ── Open form ──────────────────────────────────────────── */}
      {isOpen ? (
        <div className="mt-4 rounded-xl border border-border/60 bg-card shadow-sm">
          {showMeta ? (
            <div className="border-b border-border/60 bg-muted/20 px-5 py-4">
              <div className="flex items-start gap-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-background text-muted-foreground">
                  <IconNotebook className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm font-semibold leading-tight text-foreground">{meta.lessonName}</h4>
                  {meta.syllabusName ? (
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{meta.syllabusName}</p>
                  ) : null}
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    {meta.memberName}
                    <span className="mx-1.5 text-border/70">·</span>
                    {meta.instructorName || "—"}
                    <span className="mx-1.5 text-border/70">·</span>
                    {meta.aircraftReg}
                    <span className="mx-1.5 text-border/70">·</span>
                    {meta.bookingDate}
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          <div className="space-y-8 px-5 py-6">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <SectionHeading icon={<IconTarget className="h-4 w-4" />} label="Lesson Outcome" />
                {status ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => setStatus(null)}
                  >
                    Clear
                  </Button>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setStatus("pass")}
                  className={cn(
                    "inline-flex h-9 items-center gap-2 rounded-md border px-4 text-sm font-medium transition-colors",
                    status === "pass"
                      ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                      : "border-border bg-background text-muted-foreground hover:border-emerald-400/60 hover:bg-emerald-500/5 hover:text-emerald-600"
                  )}
                >
                  <IconCheck className="h-3.5 w-3.5 shrink-0" />
                  Pass
                </button>
                <button
                  type="button"
                  onClick={() => setStatus("not yet competent")}
                  className={cn(
                    "inline-flex h-9 items-center gap-2 rounded-md border px-4 text-sm font-medium transition-colors",
                    status === "not yet competent"
                      ? "border-amber-500/50 bg-amber-500/10 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
                      : "border-border bg-background text-muted-foreground hover:border-amber-400/60 hover:bg-amber-500/5 hover:text-amber-600"
                  )}
                >
                  <IconX className="h-3.5 w-3.5 shrink-0" />
                  Not Yet Competent
                </button>
              </div>
            </div>

            <div className="space-y-4 border-t border-border/60 pt-6">
              <SectionHeading icon={<IconMessage className="h-4 w-4" />} label="Instructor Notes" />

              <div className="space-y-4">
                <FieldGroup label="General Comments" hint="Supports bold, italics, bullet points">
                  <RichTextEditor
                    value={comments}
                    onChange={setComments}
                    placeholder="General debrief notes for the student..."
                  />
                </FieldGroup>

                <FieldGroup label="Focus for Next Lesson" hint="Main priority next time">
                  <Textarea
                    value={nextSteps}
                    onChange={(e) => setNextSteps(e.target.value)}
                    placeholder="What should be the priority next time?"
                    className="min-h-[88px] resize-y rounded-lg border-border/80 bg-muted/30 text-sm placeholder:text-muted-foreground/50 focus:bg-background"
                  />
                </FieldGroup>
              </div>
            </div>

            <div className="rounded-lg border border-dashed border-border/70 bg-muted/10 px-4 py-4">
              <div className="flex items-center justify-between gap-4">
                <SectionHeading icon={<IconNotebook className="h-4 w-4" />} label="Additional Details" />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
                  onClick={() => setDetailsOpen((prev) => !prev)}
                >
                  {detailsOpen ? "Collapse" : "Expand"}
                  <IconChevronDown
                    className={cn("h-3.5 w-3.5 transition-transform duration-200", detailsOpen && "rotate-180")}
                  />
                </Button>
              </div>

              {detailsOpen ? (
                <div className="mt-5 space-y-6">
                  {/* Training Details — single column for easier reading */}
                  <div className="space-y-4">
                    <SectionHeading
                      icon={<IconNotebook className="h-4 w-4" />}
                      label="Training Details"
                      level="secondary"
                    />

                    <div className="space-y-4">
                      <FieldGroup label="Lesson Highlights" hint="What went particularly well?">
                        <Textarea
                          value={lessonHighlights}
                          onChange={(e) => setLessonHighlights(e.target.value)}
                          placeholder="Describe what went well..."
                          className="min-h-[72px] resize-y rounded-lg border-border/80 bg-muted/30 text-sm placeholder:text-muted-foreground/50 focus:bg-background"
                        />
                      </FieldGroup>

                      <FieldGroup label="Areas for Improvement" hint="What needs more practice?">
                        <Textarea
                          value={areasForImprovement}
                          onChange={(e) => setAreasForImprovement(e.target.value)}
                          placeholder="Areas that need work..."
                          className="min-h-[72px] resize-y rounded-lg border-border/80 bg-muted/30 text-sm placeholder:text-muted-foreground/50 focus:bg-background"
                        />
                      </FieldGroup>

                      <FieldGroup
                        label="Airmanship & Decision Making"
                        hint="Situational awareness, safety mindset"
                      >
                        <Textarea
                          value={airmanship}
                          onChange={(e) => setAirmanship(e.target.value)}
                          placeholder="Comments on airmanship and decision making..."
                          className="min-h-[64px] resize-y rounded-lg border-border/80 bg-muted/30 text-sm placeholder:text-muted-foreground/50 focus:bg-background"
                        />
                      </FieldGroup>
                    </div>
                  </div>

                  {/* Environment & Safety — compact two-column for short fields */}
                  <div className="border-t border-border/50 pt-6">
                    <SectionHeading
                      icon={<IconCloud className="h-4 w-4" />}
                      label="Environment & Safety"
                      level="secondary"
                    />

                    <div className="mt-3 grid max-w-2xl grid-cols-1 gap-4 sm:grid-cols-2">
                      <FieldGroup label="Weather Conditions">
                        <Input
                          value={weatherConditions}
                          onChange={(e) => setWeatherConditions(e.target.value)}
                          placeholder="e.g. CAVOK, Gusty 15kts, Low cloud"
                          className="h-9 rounded-lg border-border/80 bg-muted/30 text-sm placeholder:text-muted-foreground/50 focus:bg-background"
                        />
                      </FieldGroup>

                      <FieldGroup label="Safety Observations" variant="warning">
                        <Input
                          value={safetyConcerns}
                          onChange={(e) => setSafetyConcerns(e.target.value)}
                          placeholder="Any safety events or concerns?"
                          className="h-9 rounded-lg border-amber-200/80 bg-amber-50/30 text-sm placeholder:text-muted-foreground/50 focus:bg-background dark:border-amber-800/60 dark:bg-amber-950/10"
                        />
                      </FieldGroup>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                  Training highlights, improvements, and safety notes (optional).
                </p>
              )}
            </div>
          </div>

          <div
            className={cn(
              "border-t border-border/60 bg-muted/30 px-5 py-4",
              !collapsible && "sticky bottom-0 z-20 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60"
            )}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs text-muted-foreground">
                {hasExisting
                  ? isDirty
                    ? "You have unsaved changes."
                    : "Debrief is saved and up to date."
                  : "Fill in what's relevant — all fields are optional."}
              </span>
              {skipDebriefHref ? (
                <Link
                  href={skipDebriefHref}
                  className="text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                >
                  {hasExisting ? "View Invoice" : "Skip Debrief"}
                </Link>
              ) : null}
            </div>

            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:gap-2">
              {showViewButton && viewHref ? (
                <Button
                  type="button"
                  size="lg"
                  variant="outline"
                  className="h-11 w-full sm:w-auto"
                  asChild
                >
                  <Link href={viewHref}>View Debrief</Link>
                </Button>
              ) : null}

              {continueHref ? (
                <Button
                  type="button"
                  size="lg"
                  className={`h-11 w-full gap-2 sm:w-auto ${primaryButtonClassName}`}
                  onClick={() => {
                    if (hasExisting && !isDirty) {
                      router.push(continueHref)
                      return
                    }
                    void handleSave({ continueAfterSave: true })
                  }}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <>
                      <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      {continueLabel ?? "Save & Continue"}
                      <IconArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              ) : null}

              {!continueHref ? (
                <Button
                  type="button"
                  size="lg"
                  className={`h-11 w-full gap-2 sm:w-auto ${primaryButtonClassName}`}
                  onClick={() => void handleSave()}
                  disabled={isSaving || (hasExisting && !isDirty)}
                >
                  {isSaving ? (
                    <>
                      <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : hasExisting ? (
                    isDirty ? "Save Changes" : "Saved"
                  ) : (
                    "Save Debrief"
                  )}
                </Button>
              ) : null}
            </div>
          </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function SectionHeading({
  icon,
  label,
  description,
  level = "primary",
}: {
  icon: React.ReactNode
  label: string
  description?: string
  level?: "primary" | "secondary"
}) {
  const isPrimary = level === "primary"
  return (
    <div className="flex items-center gap-2">
      <span className={cn("shrink-0", isPrimary ? "text-muted-foreground" : "text-muted-foreground/70")}>
        {icon}
      </span>
      <div className="min-w-0">
        <h4
          className={cn(
            "leading-tight",
            isPrimary
              ? "text-base font-semibold text-foreground"
              : "text-sm font-medium text-muted-foreground"
          )}
        >
          {label}
        </h4>
        {description ? (
          <p className={cn("mt-0.5 text-muted-foreground", isPrimary ? "text-xs" : "text-[11px]")}>
            {description}
          </p>
        ) : null}
      </div>
    </div>
  )
}

function FieldGroup({
  label,
  hint,
  variant,
  className,
  children,
}: {
  label: string
  hint?: string
  variant?: "warning"
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <div className="space-y-0.5">
        <label
          className={cn(
            "block text-xs font-medium",
            variant === "warning" ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground"
          )}
        >
          {label}
        </label>
        {hint ? (
          <p className="text-[11px] leading-relaxed text-muted-foreground/90">{hint}</p>
        ) : null}
      </div>
      {children}
    </div>
  )
}
