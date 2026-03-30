import * as React from "react"

import { SkeletonBlock } from "@/components/loading/skeleton-primitives"

function SectionSkeleton({
  titleWidth,
  rows,
}: {
  titleWidth: string
  rows: number
}) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="border-b border-border/60 px-6 py-6">
        <SkeletonBlock className={`h-4 ${titleWidth} max-w-full`} />
        <SkeletonBlock className="mt-2 h-3 w-48 max-w-full" />
      </div>
      <div className="divide-y divide-border/60 px-6 py-2">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="flex items-center justify-between gap-4 py-3">
            <SkeletonBlock className="h-4 w-28 shrink-0" />
            <SkeletonBlock className="h-4 w-24 shrink-0" />
            <SkeletonBlock className="hidden h-4 w-20 sm:block" />
            <SkeletonBlock className="h-6 w-16 shrink-0 rounded-full" />
          </div>
        ))}
      </div>
    </div>
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

      <div className="grid gap-6 lg:grid-cols-12" aria-hidden="true">
        <div className="space-y-6 lg:col-span-7">
          <SectionSkeleton titleWidth="w-36" rows={4} />
          <SectionSkeleton titleWidth="w-28" rows={2} />
        </div>

        <div className="lg:col-span-5">
          <SectionSkeleton titleWidth="w-36" rows={3} />
        </div>
      </div>
    </div>
  )
}
