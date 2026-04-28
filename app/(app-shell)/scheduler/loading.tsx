import { AppRouteListContainer } from "@/components/layouts/app-route-shell"
import { RouteLoadingState } from "@/components/loading/route-loading-state"

export default function Loading() {
  return (
    <AppRouteListContainer>
      <RouteLoadingState message="Loading scheduler..." />
    </AppRouteListContainer>
  )
}
