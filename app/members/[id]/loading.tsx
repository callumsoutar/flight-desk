import { AppRouteDetailContainer, AppRouteShell } from "@/components/layouts/app-route-shell"
import { MemberDetailSkeleton } from "@/components/loading/page-skeletons"

export default function Loading() {
  return (
    <AppRouteShell>
      <AppRouteDetailContainer>
        <MemberDetailSkeleton />
      </AppRouteDetailContainer>
    </AppRouteShell>
  )
}
