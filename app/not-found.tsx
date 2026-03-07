import { AppRouteListContainer, AppRouteShell } from "@/components/layouts/app-route-shell"
import { RouteNotFoundState } from "@/components/loading/route-not-found-state"

export default function NotFound() {
  return (
    <AppRouteShell>
      <AppRouteListContainer>
        <RouteNotFoundState
          backHref="/dashboard"
          backLabel="Go to dashboard"
        />
      </AppRouteListContainer>
    </AppRouteShell>
  )
}
