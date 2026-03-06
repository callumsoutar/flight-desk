import { DashboardPageSkeleton } from "@/components/dashboard/dashboard-page-skeleton"
import { AppRouteListContainer, AppRouteShell } from "@/components/layouts/app-route-shell"

export default function Loading() {
  return (
    <AppRouteShell>
      <AppRouteListContainer>
        <DashboardPageSkeleton />
      </AppRouteListContainer>
    </AppRouteShell>
  )
}
