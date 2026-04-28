import { DashboardPageSkeleton } from "@/components/dashboard/dashboard-page-skeleton"
import { AppRouteListContainer } from "@/components/layouts/app-route-shell"

export default function Loading() {
  return (
    <AppRouteListContainer>
      <DashboardPageSkeleton />
    </AppRouteListContainer>
  )
}
