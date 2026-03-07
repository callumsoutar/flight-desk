"use client"

import { AppRouteDetailContainer, AppRouteShell } from "@/components/layouts/app-route-shell"
import { RouteErrorState } from "@/components/loading/route-error-state"

export default function Error({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <AppRouteShell>
      <AppRouteDetailContainer>
        <RouteErrorState
          title="Unable to load reports"
          message="Something went wrong while loading report data."
          reset={reset}
        />
      </AppRouteDetailContainer>
    </AppRouteShell>
  )
}
