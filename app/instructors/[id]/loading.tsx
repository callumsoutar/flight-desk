import { AppRouteDetailContainer, AppRouteShell } from "@/components/layouts/app-route-shell"
import { InstructorDetailSkeleton } from "@/components/loading/page-skeletons"

export default function Loading() {
  return (
    <AppRouteShell>
      <AppRouteDetailContainer>
        <InstructorDetailSkeleton />
      </AppRouteDetailContainer>
    </AppRouteShell>
  )
}
