import { ReportsPageSkeleton } from "@/components/loading/page-skeletons"
import { AppRouteDetailContainer, AppRouteShell } from "@/components/layouts/app-route-shell"

export default function Loading() {
  return (
    <AppRouteShell>
      <AppRouteDetailContainer>
        <ReportsPageSkeleton />
      </AppRouteDetailContainer>
    </AppRouteShell>
  )
}
