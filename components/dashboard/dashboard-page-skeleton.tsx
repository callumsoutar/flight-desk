import * as React from "react"

import { SkeletonBlock } from "@/components/loading/skeleton-primitives"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

export function DashboardPageSkeleton() {
  return (
    <div className="space-y-8" aria-busy="true" aria-live="polite">
      <div className="space-y-2" aria-hidden="true">
        <SkeletonBlock className="h-9 w-48" />
        <SkeletonBlock className="h-4 w-64 max-w-full" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-hidden="true">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index} className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <SkeletonBlock className="h-4 w-24" />
              <SkeletonBlock className="h-4 w-4 rounded-full" />
            </CardHeader>
            <CardContent>
              <SkeletonBlock className="h-8 w-16 mb-2" />
              <SkeletonBlock className="h-3 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-12" aria-hidden="true">
        <div className="space-y-6 lg:col-span-7">
          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <div className="space-y-2">
                <SkeletonBlock className="h-5 w-36" />
                <SkeletonBlock className="h-3 w-56 max-w-full" />
              </div>
              <SkeletonBlock className="h-8 w-24 rounded-md" />
            </CardHeader>
            <CardContent className="space-y-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex flex-col gap-1.5">
                    <SkeletonBlock className="h-4 w-32" />
                    <SkeletonBlock className="h-3 w-20" />
                  </div>
                  <div className="flex items-center gap-4">
                    <SkeletonBlock className="h-4 w-28" />
                    <SkeletonBlock className="h-5 w-20 rounded-full" />
                    <SkeletonBlock className="h-4 w-4" />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <div className="space-y-2">
                <SkeletonBlock className="h-5 w-28" />
                <SkeletonBlock className="h-3 w-48 max-w-full" />
              </div>
              <SkeletonBlock className="h-8 w-24 rounded-md" />
            </CardHeader>
            <CardContent className="space-y-2">
              {Array.from({ length: 2 }).map((_, index) => (
                <div key={index} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-4">
                    <SkeletonBlock className="h-10 w-10 rounded-full" />
                    <div className="flex flex-col gap-1.5">
                      <SkeletonBlock className="h-4 w-32" />
                      <SkeletonBlock className="h-3 w-24" />
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <SkeletonBlock className="h-5 w-20 rounded-full" />
                    <SkeletonBlock className="h-4 w-4" />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-5">
          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <div className="space-y-2">
                <SkeletonBlock className="h-5 w-36" />
                <SkeletonBlock className="h-3 w-48 max-w-full" />
              </div>
              <SkeletonBlock className="h-8 w-24 rounded-md" />
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="rounded-lg border p-4">
                    <div className="flex flex-col gap-1.5 mb-3">
                      <SkeletonBlock className="h-4 w-32" />
                      <SkeletonBlock className="h-3 w-48" />
                    </div>
                    <SkeletonBlock className="h-10 w-full rounded-md mb-4" />
                    <div className="flex justify-end gap-2">
                      <SkeletonBlock className="h-8 w-24 rounded-md" />
                      <SkeletonBlock className="h-8 w-24 rounded-md" />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
