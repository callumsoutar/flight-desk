import { DebriefWriteSkeleton } from "@/components/loading/page-skeletons"
import { AppRouteShell } from "@/components/layouts/app-route-shell"

export default function DebriefWriteLoading() {
  return (
    <AppRouteShell>
      <DebriefWriteSkeleton />
    </AppRouteShell>
  )
}

