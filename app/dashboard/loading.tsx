import type { CSSProperties } from "react"

import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SkeletonBlock } from "@/components/loading/skeleton-primitives"
import { Card, CardContent } from "@/components/ui/card"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

export default function Loading() {
  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "16rem",
        } as CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2 p-4 md:p-6">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" aria-hidden="true">
              {Array.from({ length: 4 }).map((_, index) => (
                <Card key={index}>
                  <CardContent className="space-y-3 p-4">
                    <SkeletonBlock className="h-3 w-24" />
                    <SkeletonBlock className="h-8 w-28" />
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card>
              <CardContent className="space-y-3 p-4" aria-hidden="true">
                <SkeletonBlock className="h-4 w-40" />
                <SkeletonBlock className="h-72 w-full" />
              </CardContent>
            </Card>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
