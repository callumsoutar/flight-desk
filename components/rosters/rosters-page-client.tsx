"use client"

import { RosterScheduler } from "@/components/rosters/roster-scheduler"
import type { RosterInstructor, RosterRule, TimelineConfig } from "@/lib/types/roster"

export function RostersPageClient({
  instructors,
  rosterRules,
  timelineConfig,
}: {
  instructors: RosterInstructor[]
  rosterRules: RosterRule[]
  timelineConfig: TimelineConfig
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Rosters</h1>
        <p className="text-sm text-muted-foreground">
          Plan recurring and one-off staff coverage directly from the scheduling board.
        </p>
      </div>
      <RosterScheduler
        initialInstructors={instructors}
        initialRosterRules={rosterRules}
        timelineConfig={timelineConfig}
      />
    </div>
  )
}
