import { AppRouteListContainer, AppRouteShell } from "@/components/layouts/app-route-shell"
import { ListPageSkeleton } from "@/components/loading/page-skeletons"

export default function Loading() {
  return (
    <AppRouteShell>
      <AppRouteListContainer>
        <ListPageSkeleton showTabs />
      </AppRouteListContainer>
    </AppRouteShell>
  )
}
