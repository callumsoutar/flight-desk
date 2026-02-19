"use client"

import { AppRouteListContainer, AppRouteShell } from "@/components/layouts/app-route-shell"
import { RouteErrorState } from "@/components/loading/route-error-state"

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <AppRouteShell>
      <AppRouteListContainer>
        <RouteErrorState
          title="Unable to load rosters"
          message="Something went wrong while loading roster data."
          reset={reset}
        />
      </AppRouteListContainer>
    </AppRouteShell>
  )
}
