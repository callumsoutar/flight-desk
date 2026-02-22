import { EquipmentDetailSkeleton } from "@/components/loading/page-skeletons"
import { AppRouteShell } from "@/components/layouts/app-route-shell"

export default function Loading() {
  return (
    <AppRouteShell>
      <EquipmentDetailSkeleton />
    </AppRouteShell>
  )
}
