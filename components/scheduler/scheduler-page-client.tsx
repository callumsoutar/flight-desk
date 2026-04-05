"use client"

import * as React from "react"

import { ResourceTimelineScheduler } from "@/components/scheduler/resource-timeline-scheduler"
import type { SchedulerPageData } from "@/lib/types/scheduler"

export function SchedulerPageClient({ data }: { data: SchedulerPageData }) {
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div className="overflow-hidden rounded-md border border-border/70 bg-background shadow-sm">
        <div className="flex flex-col items-center justify-center gap-3 py-32">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-foreground/70" />
          <p className="text-sm text-muted-foreground">Loading scheduler data...</p>
        </div>
      </div>
    )
  }

  return <ResourceTimelineScheduler data={data} />
}
