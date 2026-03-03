"use client"

import { AppRouteShell } from "@/components/layouts/app-route-shell"
import { RouteErrorState } from "@/components/loading/route-error-state"

export default function DebriefEditError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <AppRouteShell>
      <div className="flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl">
          <RouteErrorState
            title="Unable to load debrief editor"
            message="Something went wrong while loading the debrief editor. Please try again."
            reset={reset}
          />
        </div>
      </div>
    </AppRouteShell>
  )
}

