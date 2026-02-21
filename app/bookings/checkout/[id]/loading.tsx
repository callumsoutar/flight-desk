import { BookingDetailSkeleton } from "@/components/loading/page-skeletons"
import { AppRouteShell } from "@/components/layouts/app-route-shell"

export default function Loading() {
  return (
    <AppRouteShell>
      <BookingDetailSkeleton />
    </AppRouteShell>
  )
}
