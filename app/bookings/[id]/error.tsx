"use client"

import { AppRouteNarrowDetailContainer, AppRouteShell } from "@/components/layouts/app-route-shell"
import { RouteErrorState } from "@/components/loading/route-error-state"

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <AppRouteShell>
      <AppRouteNarrowDetailContainer>
        <RouteErrorState
          title="Unable to load booking"
          message="Something went wrong while loading this booking."
          reset={reset}
        />
      </AppRouteNarrowDetailContainer>
    </AppRouteShell>
  )
}
