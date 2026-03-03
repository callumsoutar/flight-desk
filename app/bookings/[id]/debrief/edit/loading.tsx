import { BookingDetailSkeleton } from "@/components/loading/page-skeletons"
import { AppRouteShell } from "@/components/layouts/app-route-shell"

export default function DebriefEditLoading() {
  return (
    <AppRouteShell>
      <BookingDetailSkeleton />
    </AppRouteShell>
  )
}

