import { DebriefViewSkeleton } from "@/components/loading/page-skeletons"
import { AppRouteShell } from "@/components/layouts/app-route-shell"

export default function DebriefLoading() {
  return (
    <AppRouteShell>
      <DebriefViewSkeleton />
    </AppRouteShell>
  )
}
