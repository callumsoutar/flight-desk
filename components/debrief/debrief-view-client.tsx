"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ChevronDown, FileText, Link2, Mail, Pencil, Plane, Printer } from "lucide-react"
import { toast } from "sonner"

import { BookingHeader } from "@/components/bookings/booking-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { BookingWithRelations } from "@/lib/types/bookings"
import type {
  FlightExperienceEntryWithType,
  LessonProgressWithInstructor,
} from "@/lib/types/debrief"

function formatName(user: { first_name: string | null; last_name: string | null; email?: string | null }) {
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

function formatDateLong(value: string | null | undefined) {
  if (!value) return "Date not set"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Date not set"
  return date.toLocaleDateString("en-NZ", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
}

function formatDateShort(value: string | null | undefined) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" })
}

function resolveFlightTimeHours(booking: BookingWithRelations): number | null {
  const candidates = [
    booking.billing_hours,
    booking.flight_time_hobbs,
    booking.flight_time_tach,
    booking.flight_time_airswitch,
    booking.dual_time,
    booking.solo_time,
  ]

  for (const value of candidates) {
    if (typeof value === "number" && Number.isFinite(value)) return value
  }

  return null
}

function formatExperienceValue(unit: FlightExperienceEntryWithType["unit"], value: number) {
  if (!Number.isFinite(value)) return "—"
  if (unit === "hours") return `${value.toFixed(1)}h`
  if (unit === "landings") return value === 1 ? "1 landing" : `${value} landings`
  return String(value)
}

function RichText({
  value,
  placeholder,
  className = "text-[14px] leading-relaxed text-foreground/90",
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

interface DebriefViewClientProps {
  bookingId: string
  booking: BookingWithRelations
  lessonProgress: LessonProgressWithInstructor | null
  flightExperiences: FlightExperienceEntryWithType[]
}

export function DebriefViewClient({
  bookingId,
  booking,
  lessonProgress,
  flightExperiences,
}: DebriefViewClientProps) {
  const router = useRouter()
  const studentName = booking.student ? formatName(booking.student) : "Student"

  const instructorName = lessonProgress?.instructor
    ? formatName({
        first_name: lessonProgress.instructor.user?.first_name ?? lessonProgress.instructor.first_name,
        last_name: lessonProgress.instructor.user?.last_name ?? lessonProgress.instructor.last_name,
        email: lessonProgress.instructor.user?.email ?? null,
      })
    : booking.instructor
      ? formatName({
          first_name: booking.instructor.user?.first_name ?? booking.instructor.first_name,
          last_name: booking.instructor.user?.last_name ?? booking.instructor.last_name,
          email: booking.instructor.user?.email ?? null,
        })
      : "—"

  const lessonName = booking.lesson?.name ?? "Training Flight"
  const sessionDateLong = formatDateLong(booking.start_time ?? null)
  const sessionDateShort = formatDateShort(booking.start_time ?? null)

  const outcomeStatus = lessonProgress?.status ?? null
  const statusLabel = outcomeStatus === "pass" ? "Pass" : "Not Yet Competent"

  const flightTimeHours = resolveFlightTimeHours(booking)
  const flightTimeLabel = flightTimeHours != null ? `${flightTimeHours.toFixed(1)}h` : "—"

  const handlePrint = React.useCallback(() => {
    window.print()
  }, [])

  const handleCopyLink = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      toast.success("Link copied")
    } catch {
      toast.error("Unable to copy link")
    }
  }, [])

  const handleEmail = React.useCallback(() => {
    const studentEmail = booking.student?.email
    if (!studentEmail) {
      toast.error("Student email not found")
      return
    }

    const subject = `Flight Debrief - ${lessonName}`
    const body = `Hi ${booking.student?.first_name || "there"},\n\nHere is your flight debrief report:\n${window.location.href}\n\nRegards,\n${instructorName}`

    window.location.href = `mailto:${studentEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  }, [booking.student?.email, booking.student?.first_name, instructorName, lessonName])

  const invoiceId = booking.checkin_invoice_id ?? null

  const headerActions = (
    <div className="flex w-full flex-wrap items-center gap-2 print:hidden sm:w-auto sm:justify-end">
      {invoiceId ? (
        <Button size="sm" className="h-9 w-full gap-2 shadow-sm sm:w-auto" asChild>
          <Link href={`/invoices/${invoiceId}`}>
            <FileText className="h-3.5 w-3.5" />
            View Invoice
          </Link>
        </Button>
      ) : null}
      {lessonProgress ? (
        <Button variant="outline" size="sm" className="h-9 w-full gap-2 sm:w-auto" onClick={handleEmail}>
          <Mail className="h-3.5 w-3.5" />
          Email
        </Button>
      ) : (
        <Button variant="outline" size="sm" className="h-9 w-full gap-2 sm:w-auto" asChild>
          <Link href={`/bookings/${bookingId}/debrief/write`}>
            <Pencil className="h-3.5 w-3.5" />
            Write
          </Link>
        </Button>
      )}
      {lessonProgress ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 w-full gap-1.5 sm:w-auto">
              Options
              <ChevronDown className="h-3.5 w-3.5 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onSelect={() => router.push(`/bookings/${bookingId}/debrief/write`)}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit debrief
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={(event) => {
              event.preventDefault()
              void handleCopyLink()
            }}>
              <Link2 className="mr-2 h-4 w-4" />
              Copy link
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={(event) => {
              event.preventDefault()
              handlePrint()
            }}>
              <Printer className="mr-2 h-4 w-4" />
              Print
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  )

  return (
    <div className="min-h-screen bg-muted/30 pb-20 print:bg-white">
      <BookingHeader
        className="print:hidden"
        booking={booking}
        title={`Debrief: ${lessonName}`}
        backHref={`/bookings/${bookingId}`}
        backLabel="Back to Booking"
        actions={headerActions}
        extra={
          outcomeStatus ? (
            <Badge
              variant={outcomeStatus === "pass" ? "default" : "secondary"}
              className={
                outcomeStatus === "pass"
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
                  : "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300"
              }
            >
              {statusLabel}
            </Badge>
          ) : null
        }
      />

      <div className="w-full max-w-none flex-1 px-4 pt-6 pb-28 sm:px-6 lg:px-8 print:max-w-none print:px-0 print:pt-0 print:pb-0">
        {!lessonProgress ? (
          <Card className="overflow-hidden border border-border/50 bg-card shadow-sm print:shadow-none">
            <CardContent className="p-8 md:p-10">
              <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border/50 bg-muted/30 text-muted-foreground">
                    <Plane className="h-5 w-5" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-base font-semibold text-foreground">No debrief yet</p>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      Write the lesson debrief for this booking. A debrief record will be created when you save.
                    </p>
                  </div>
                </div>

                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                  <Button className="w-full gap-2 sm:w-auto" asChild>
                    <Link href={`/bookings/${bookingId}/debrief/write`}>
                      <Pencil className="h-4 w-4" />
                      Write Debrief
                    </Link>
                  </Button>
                  <Button variant="outline" className="w-full sm:w-auto" asChild>
                    <Link href={`/bookings/${bookingId}`}>Back to Booking</Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <article
            className="mx-auto min-h-[50vh] w-full max-w-4xl rounded-xl border border-border/50 bg-card px-6 py-8 shadow-sm print:min-h-0 print:max-w-none print:rounded-none print:border-0 print:shadow-none print:bg-white sm:px-8 sm:py-10 lg:px-10 lg:py-12"
          >
            <div className="w-full">
              {/* Report title block */}
              <header className="border-b border-border/40 pb-6">
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Flight Debrief Report
                </p>
                <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                  {lessonName}
                </h1>
                <p className="mt-2 text-base text-muted-foreground">{sessionDateLong}</p>
              </header>

              {/* Outcome & metadata strip */}
              {(lessonProgress.status || lessonProgress.attempt != null) ? (
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-border/40 py-4 text-sm">
                  {lessonProgress.status ? (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Outcome</span>
                      <span
                        className={
                          lessonProgress.status === "pass"
                            ? "font-medium text-emerald-600 dark:text-emerald-400"
                            : "font-medium text-rose-600 dark:text-rose-400"
                        }
                      >
                        {lessonProgress.status === "pass" ? "Pass" : "Not Yet Competent"}
                      </span>
                    </div>
                  ) : null}
                  {lessonProgress.attempt != null ? (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Attempt</span>
                      <span className="font-medium tabular-nums text-foreground">#{lessonProgress.attempt}</span>
                    </div>
                  ) : null}
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Session</span>
                    <span className="font-medium text-foreground">{sessionDateShort}</span>
                  </div>
                </div>
              ) : null}

              {/* Key details */}
              <dl className="grid grid-cols-2 gap-x-6 gap-y-4 border-b border-border/40 py-6 text-sm sm:grid-cols-4">
                <div>
                  <dt className="text-muted-foreground">Student</dt>
                  <dd className="mt-0.5 font-medium text-foreground">{studentName}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Instructor</dt>
                  <dd className="mt-0.5 font-medium text-foreground">{instructorName}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Aircraft</dt>
                  <dd className="mt-0.5 font-medium text-foreground">
                    {booking.checked_out_aircraft?.registration || booking.aircraft?.registration || "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Flight time</dt>
                  <dd className="mt-0.5 font-medium tabular-nums text-foreground">{flightTimeLabel}</dd>
                </div>
              </dl>

              {/* Instructor Feedback */}
              <section className="border-b border-border/40 py-6">
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Instructor Feedback
                </h2>
                <div className="text-[15px] leading-relaxed text-foreground/90">
                  <RichText value={lessonProgress.instructor_comments} placeholder="No instructor feedback recorded." />
                </div>
              </section>

              {/* Two-column content */}
              <div className="grid gap-10 py-8 sm:grid-cols-2 sm:gap-12">
                <section className="space-y-6">
                  <div>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Lesson Highlights
                    </h3>
                    <div className="text-[15px] leading-relaxed text-muted-foreground">
                      <RichText
                        value={lessonProgress.lesson_highlights}
                        placeholder="No highlights recorded."
                        className="text-[15px] leading-relaxed text-muted-foreground"
                      />
                    </div>
                  </div>
                  <div>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      General Airmanship
                    </h3>
                    <div className="text-[15px] leading-relaxed text-muted-foreground">
                      <RichText
                        value={lessonProgress.airmanship}
                        placeholder="No airmanship notes recorded."
                        className="text-[15px] leading-relaxed text-muted-foreground"
                      />
                    </div>
                  </div>
                </section>

                <section className="space-y-6">
                  <div>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Areas for Improvement
                    </h3>
                    <div className="text-[15px] leading-relaxed text-muted-foreground">
                      <RichText
                        value={lessonProgress.areas_for_improvement}
                        placeholder="No areas for improvement recorded."
                        className="text-[15px] leading-relaxed text-muted-foreground"
                      />
                    </div>
                  </div>
                  <div>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Focus for Next Lesson
                    </h3>
                    <div className="text-[15px] font-medium leading-relaxed text-foreground">
                      <RichText
                        value={lessonProgress.focus_next_lesson}
                        placeholder="Standard progress to next lesson."
                        className="text-[15px] font-medium leading-relaxed text-foreground"
                      />
                    </div>
                  </div>
                </section>
              </div>

              {/* Weather & Safety (optional) */}
              {(lessonProgress.weather_conditions || lessonProgress.safety_concerns) ? (
                <div className="grid gap-8 border-t border-border/40 py-6 sm:grid-cols-2 sm:gap-12">
                  {lessonProgress.weather_conditions ? (
                    <div>
                      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Weather
                      </h3>
                      <div className="text-[15px] leading-relaxed text-foreground">
                        <RichText
                          value={lessonProgress.weather_conditions}
                          placeholder="—"
                          className="text-[15px] leading-relaxed text-foreground"
                        />
                      </div>
                    </div>
                  ) : null}
                  {lessonProgress.safety_concerns ? (
                    <div>
                      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Safety Observations
                      </h3>
                      <div className="text-[15px] leading-relaxed text-foreground">
                        <RichText
                          value={lessonProgress.safety_concerns}
                          placeholder="—"
                          className="text-[15px] leading-relaxed text-foreground"
                        />
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {/* Flight experience log */}
              {flightExperiences.length > 0 ? (
                <section className="border-t border-border/40 pt-6">
                  <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Flight Experience Logged
                  </h2>
                  <ul className="space-y-2">
                    {flightExperiences.map((entry) => (
                      <li
                        key={entry.id}
                        className="flex items-baseline justify-between gap-4 border-b border-border/30 py-2.5 text-sm last:border-0"
                      >
                        <span className="font-medium text-foreground">
                          {entry.experience_type?.name ?? "Experience"}
                          {(entry.notes || entry.conditions) ? (
                            <span className="ml-1 font-normal text-muted-foreground">
                              — {[entry.notes, entry.conditions].filter(Boolean).join(" · ")}
                            </span>
                          ) : null}
                        </span>
                        <span className="shrink-0 font-medium tabular-nums text-foreground">
                          {formatExperienceValue(entry.unit, entry.value)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </div>
          </article>
        )}
      </div>
    </div>
  )
}
