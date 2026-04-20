"use client"

import * as React from "react"
import Link from "next/link"
import { IconAlertTriangle } from "@tabler/icons-react"

import { ViewObservationModal } from "@/components/aircraft/view-observation-modal"
import { useTimezone } from "@/contexts/timezone-context"
import type { BookingWarningItem, BookingWarningsResponse, BookingWarningSeverity } from "@/lib/types/booking-warnings"
import { cn } from "@/lib/utils"
import { formatDate } from "@/lib/utils/date-format"

type BookingCheckoutWarningsProps = {
  warnings: BookingWarningsResponse
  isRefreshing?: boolean
  refreshError?: string | null
}

const SEVERITY_STYLES: Record<
  BookingWarningSeverity,
  {
    label: string
    text: string
  }
> = {
  critical: {
    label: "Critical",
    text: "text-red-700",
  },
  high: {
    label: "High",
    text: "text-orange-700",
  },
  medium: {
    label: "Medium",
    text: "text-amber-700",
  },
  low: {
    label: "Low",
    text: "text-sky-700",
  },
}

function getContainerClassName(status: BookingWarningsResponse["summary"]["status"]) {
  if (status === "blocked") return "border-red-200 bg-red-50/40"
  if (status === "warning") return "border-amber-200 bg-amber-50/30"
  return "border-border/60 bg-background"
}

function formatCountLabel(value: number) {
  return `${value} issue${value === 1 ? "" : "s"}`
}

function WarningLine({ warning }: { warning: BookingWarningItem }) {
  const { timeZone } = useTimezone()
  const styles = SEVERITY_STYLES[warning.severity]
  const formattedDueAt = warning.due_at ? formatDate(warning.due_at, timeZone) : ""
  const secondaryDate = warning.countdown_label
    ? warning.countdown_label
    : formattedDueAt || null
  const prefix = warning.blocking ? "Critical warning" : "Warning"

  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-0.5">
      <span className={cn("text-xs font-semibold", styles.text)}>
        {prefix} ({styles.label.toLowerCase()}):
      </span>
      <span className="text-sm text-foreground">{warning.title}</span>
      {secondaryDate ? <span className="text-sm text-muted-foreground">({secondaryDate})</span> : null}
    </span>
  )
}

export function BookingCheckoutWarnings({
  warnings,
  isRefreshing = false,
  refreshError = null,
}: BookingCheckoutWarningsProps) {
  const [selectedObservationId, setSelectedObservationId] = React.useState<string | null>(null)
  const totalCount = warnings.summary.total_count
  const hasBlockers = warnings.summary.has_blockers
  const blockingCount = warnings.summary.blocking_count
  const nonBlockingCount = Math.max(0, totalCount - blockingCount)

  if (totalCount === 0 && warnings.summary.status === "clear") return null

  const groupsWithIssues = warnings.groups.filter((group) => group.warning_count > 0)

  const blockingLines = groupsWithIssues.flatMap((group) =>
    group.warnings
      .filter((warning) => warning.blocking)
      .map((warning) => ({ group, warning }))
  )

  const nonBlockingLines = groupsWithIssues.flatMap((group) =>
    group.warnings
      .filter((warning) => !warning.blocking)
      .map((warning) => ({ group, warning }))
  )

  const containerClassName = getContainerClassName(warnings.summary.status)

  return (
    <>
      <div className={cn("rounded-lg border px-4 py-3 text-sm", containerClassName)}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {warnings.summary.status === "blocked" ? (
                <IconAlertTriangle className="h-4 w-4 text-red-700" />
              ) : null}
              <span className="font-semibold text-foreground">Booking warnings</span>
              {hasBlockers ? <span className="text-muted-foreground">Critical warnings</span> : null}
            </div>
            {isRefreshing ? (
              <div className="mt-0.5 text-muted-foreground">Refreshing warning checks…</div>
            ) : null}
            {refreshError ? (
              <div className="mt-0.5 font-medium text-red-700">{refreshError}</div>
            ) : null}
          </div>

          <div className="shrink-0 text-muted-foreground sm:text-right">
            <div className="font-medium text-foreground">{formatCountLabel(totalCount)}</div>
            {hasBlockers ? (
              <div className="text-xs">
                {blockingCount} critical warning{blockingCount === 1 ? "" : "s"}
                {nonBlockingCount > 0 ? `, ${nonBlockingCount} note${nonBlockingCount === 1 ? "" : "s"}` : null}
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-3 space-y-3">
          <div>
            <ul className="list-disc space-y-1 pl-5">
              {(hasBlockers ? blockingLines : [...blockingLines, ...nonBlockingLines]).map(({ group, warning }) => {
                return (
                  <li key={`${group.category}-${warning.id}`} className="text-muted-foreground">
                    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-xs font-medium text-muted-foreground">
                        {group.title}: {group.subject_label}
                      </span>
                      <WarningLine warning={warning} />
                      {warning.observation_id ? (
                        <button
                          type="button"
                          className="text-xs font-medium text-foreground underline underline-offset-4 hover:text-primary"
                          onClick={() => setSelectedObservationId(warning.observation_id as string)}
                        >
                          view
                        </button>
                      ) : warning.action_href && warning.action_label ? (
                        <Link
                          href={warning.action_href}
                          className="text-xs font-medium text-foreground underline underline-offset-4 hover:text-primary"
                        >
                          {warning.action_label.toLowerCase()}
                        </Link>
                      ) : null}
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>

          {hasBlockers && nonBlockingCount > 0 ? (
            <details open>
              <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
                Show notes ({nonBlockingCount})
              </summary>
              <div className="mt-2">
                <ul className="list-disc space-y-1 pl-5">
                  {nonBlockingLines.map(({ group, warning }) => {
                    return (
                      <li key={`nonblocking-${group.category}-${warning.id}`} className="text-muted-foreground">
                        <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="text-xs font-medium text-muted-foreground">
                            {group.title}: {group.subject_label}
                          </span>
                          <WarningLine warning={warning} />
                          {warning.observation_id ? (
                            <button
                              type="button"
                              className="text-xs font-medium text-foreground underline underline-offset-4 hover:text-primary"
                              onClick={() => setSelectedObservationId(warning.observation_id as string)}
                            >
                              view
                            </button>
                          ) : warning.action_href && warning.action_label ? (
                            <Link
                              href={warning.action_href}
                              className="text-xs font-medium text-foreground underline underline-offset-4 hover:text-primary"
                            >
                              {warning.action_label.toLowerCase()}
                            </Link>
                          ) : null}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </div>
            </details>
          ) : null}

        </div>
      </div>

      {selectedObservationId ? (
        <ViewObservationModal
          open={Boolean(selectedObservationId)}
          onClose={() => setSelectedObservationId(null)}
          observationId={selectedObservationId}
        />
      ) : null}
    </>
  )
}
