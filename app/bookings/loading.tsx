import { ListPageSkeleton } from "@/components/loading/page-skeletons"
import { AppRouteListContainer, AppRouteShell } from "@/components/layouts/app-route-shell"

export default function Loading() {
  return (
    <AppRouteShell>
      <AppRouteListContainer>
        <ListPageSkeleton showTabs />
      </AppRouteListContainer>
    </AppRouteShell>
  )
}
