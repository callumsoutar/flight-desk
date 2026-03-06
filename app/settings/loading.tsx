import { AppRouteListContainer, AppRouteShell } from "@/components/layouts/app-route-shell"
import { SettingsPageSkeleton } from "@/components/loading/page-skeletons"

export default function Loading() {
  return (
    <AppRouteShell>
      <AppRouteListContainer>
        <SettingsPageSkeleton />
      </AppRouteListContainer>
    </AppRouteShell>
  )
}

