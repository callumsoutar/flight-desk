import * as React from "react"

import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

export function SkeletonBlock({ className }: { className?: string }) {
  return <Skeleton aria-hidden="true" className={cn("bg-slate-200/70", className)} />
}

export function SkeletonTable({
  columns = 5,
  rows = 8,
  className,
}: {
  columns?: number
  rows?: number
  className?: string
}) {
  return (
    <div aria-hidden="true" className={cn("overflow-hidden rounded-lg border border-slate-200 bg-white", className)}>
      <div className="border-b border-slate-200 bg-slate-50/70 px-4 py-3">
        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
          {Array.from({ length: columns }).map((_, index) => (
            <SkeletonBlock key={`head-${index}`} className="h-3 w-16" />
          ))}
        </div>
      </div>
      <div className="divide-y divide-slate-100">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={`row-${rowIndex}`} className="grid gap-3 px-4 py-3.5" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
            {Array.from({ length: columns }).map((__, colIndex) => (
              <SkeletonBlock
                key={`cell-${rowIndex}-${colIndex}`}
                className={cn("h-4", colIndex === 0 ? "w-28" : "w-16")}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export function SkeletonKeyValueGrid({ rows = 6 }: { rows?: number }) {
  return (
    <div aria-hidden="true" className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="space-y-2">
          <SkeletonBlock className="h-3 w-24" />
          <SkeletonBlock className="h-10 w-full" />
        </div>
      ))}
    </div>
  )
}
