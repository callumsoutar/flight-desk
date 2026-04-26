import * as React from "react"

import { SkeletonBlock } from "@/components/loading/skeleton-primitives"

function CardShellSkeleton({
  titleWidth,
  descriptionWidth = "w-48",
  children,
}: {
  titleWidth: string
  descriptionWidth?: string
  children: React.ReactNode
}) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="flex items-start justify-between gap-3 px-6 pb-4 pt-6">
        <div className="space-y-2">
          <SkeletonBlock className={`h-4 ${titleWidth} max-w-full`} />
          <SkeletonBlock className={`h-3 ${descriptionWidth} max-w-full`} />
        </div>
        <SkeletonBlock className="h-8 w-24 shrink-0 rounded-md" />
      </div>
      <div className="px-6 pb-6">{children}</div>
    </div>
  )
}

function SectionSkeleton({
  titleWidth,
  rows,
}: {
  titleWidth: string
  rows: number
}) {
  return (
    <CardShellSkeleton titleWidth={titleWidth}>
      <div className="divide-y divide-border/60">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="flex items-center justify-between gap-4 py-3">
            <SkeletonBlock className="h-4 w-28 shrink-0" />
            <SkeletonBlock className="h-4 w-24 shrink-0" />
            <SkeletonBlock className="hidden h-4 w-20 sm:block" />
            <SkeletonBlock className="h-6 w-16 shrink-0 rounded-full" />
          </div>
        ))}
      </div>
    </CardShellSkeleton>
  )
}

function UpcomingTodaySkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <CardShellSkeleton titleWidth="w-36" descriptionWidth="w-56">
      <div className="divide-y divide-border/70 overflow-hidden rounded-lg border">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="flex items-stretch gap-3 px-3 py-2.5">
            <SkeletonBlock className="w-1 self-stretch shrink-0 rounded-full" />
            <div className="flex w-[68px] shrink-0 flex-col justify-center gap-1.5">
              <SkeletonBlock className="h-3.5 w-10" />
              <SkeletonBlock className="h-2.5 w-12" />
            </div>
            <div className="min-w-0 flex-1 self-center space-y-2">
              <SkeletonBlock className="h-3.5 w-2/3" />
              <SkeletonBlock className="h-3 w-1/2" />
            </div>
            <div className="flex shrink-0 items-center gap-2 self-center">
              <SkeletonBlock className="h-5 w-16 rounded-full" />
              <SkeletonBlock className="h-4 w-4 rounded-sm" />
            </div>
          </div>
        ))}
      </div>
    </CardShellSkeleton>
  )
}

function BookingRequestsSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <CardShellSkeleton titleWidth="w-36" descriptionWidth="w-52">
      <div className="overflow-hidden rounded-lg border">
        <div className="grid grid-cols-[1.4fr_0.9fr_1fr_auto] items-center gap-3 border-b bg-muted/40 px-3 py-2.5">
          <SkeletonBlock className="h-2.5 w-12" />
          <SkeletonBlock className="h-2.5 w-14" />
          <SkeletonBlock className="h-2.5 w-12" />
          <SkeletonBlock className="h-2.5 w-10 justify-self-end" />
        </div>
        <div className="divide-y divide-border/70">
          {Array.from({ length: rows }).map((_, index) => (
            <div
              key={index}
              className="grid grid-cols-[1.4fr_0.9fr_1fr_auto] items-center gap-3 px-3 py-2.5"
            >
              <SkeletonBlock className="h-3.5 w-28" />
              <SkeletonBlock className="h-3.5 w-16" />
              <SkeletonBlock className="h-3.5 w-24" />
              <SkeletonBlock className="h-7 w-20 justify-self-end rounded-md" />
            </div>
          ))}
        </div>
      </div>
    </CardShellSkeleton>
  )
}

function FlyingNowSkeleton({ rows = 2 }: { rows?: number }) {
  return (
    <CardShellSkeleton titleWidth="w-28" descriptionWidth="w-56">
      <div className="divide-y divide-border/70 overflow-hidden rounded-lg border">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="space-y-0">
            <div className="flex items-stretch gap-3 px-3 py-2.5">
              <SkeletonBlock className="w-1 self-stretch shrink-0 rounded-full" />
              <SkeletonBlock className="h-9 w-9 shrink-0 self-center rounded-full" />
              <div className="min-w-0 flex-1 self-center space-y-2">
                <div className="flex items-center gap-2">
                  <SkeletonBlock className="h-3.5 w-16" />
                  <SkeletonBlock className="h-3.5 w-24" />
                  <SkeletonBlock className="h-3 w-20" />
                </div>
                <SkeletonBlock className="h-3 w-2/5" />
              </div>
              <div className="flex shrink-0 items-center gap-2 self-center">
                <SkeletonBlock className="h-5 w-20 rounded-full" />
                <SkeletonBlock className="h-4 w-4 rounded-sm" />
              </div>
            </div>
            <SkeletonBlock className="h-1 w-full rounded-none" />
          </div>
        ))}
      </div>
    </CardShellSkeleton>
  )
}

export function DashboardPageSkeleton({
  variant = "staff",
}: {
  variant?: "staff" | "member"
}) {
  if (variant === "member") {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-8 pb-8" aria-busy="true" aria-live="polite">
        <div className="space-y-1">
          <SkeletonBlock className="h-3 w-32" />
          <SkeletonBlock className="h-9 w-48 max-w-full" />
          <SkeletonBlock className="h-4 w-72 max-w-full" />
        </div>
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12 xl:gap-6">
          <div className="xl:col-span-4">
            <SectionSkeleton titleWidth="w-32" rows={2} />
          </div>
          <div className="xl:col-span-8">
            <SectionSkeleton titleWidth="w-40" rows={3} />
          </div>
        </div>
        <SectionSkeleton titleWidth="w-36" rows={2} />
      </div>
    )
  }

  return (
    <div className="space-y-8" aria-busy="true" aria-live="polite">
      <div className="space-y-2" aria-hidden="true">
        <SkeletonBlock className="h-9 w-48" />
        <SkeletonBlock className="h-4 w-64 max-w-full" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-hidden="true">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="overflow-hidden rounded-xl border border-border/60 bg-card p-4 shadow-sm"
          >
            <SkeletonBlock className="h-4 w-24" />
            <SkeletonBlock className="mt-3 h-8 w-16" />
            <SkeletonBlock className="mt-2 h-3 w-32" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 sm:gap-6 lg:grid-cols-2 lg:gap-6" aria-hidden="true">
        <UpcomingTodaySkeleton rows={4} />
        <BookingRequestsSkeleton rows={4} />
      </div>

      <div aria-hidden="true">
        <FlyingNowSkeleton rows={2} />
      </div>
    </div>
  )
}
