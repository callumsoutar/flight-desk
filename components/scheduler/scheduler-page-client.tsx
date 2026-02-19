"use client"

import * as React from "react"

import { ResourceTimelineScheduler } from "@/components/scheduler/resource-timeline-scheduler"
import type { SchedulerPageData } from "@/lib/types/scheduler"

export function SchedulerPageClient({ data }: { data: SchedulerPageData }) {
  return <ResourceTimelineScheduler data={data} />
}
