import * as React from "react"

import { SkeletonBlock } from "@/components/loading/skeleton-primitives"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

export function DashboardPageSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <div className="space-y-2" aria-hidden="true">
        <SkeletonBlock className="h-8 w-40" />
        <SkeletonBlock className="h-4 w-80 max-w-full" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-hidden="true">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index} className="overflow-hidden">
            <CardHeader className="space-y-2">
              <SkeletonBlock className="h-4 w-32" />
              <SkeletonBlock className="h-8 w-24" />
            </CardHeader>
            <CardContent className="pb-6">
              <SkeletonBlock className="h-4 w-44" />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-12" aria-hidden="true">
        <div className="space-y-6 lg:col-span-7">
          <Card className="overflow-hidden">
            <CardHeader className="space-y-2">
              <SkeletonBlock className="h-5 w-36" />
              <SkeletonBlock className="h-4 w-64 max-w-full" />
            </CardHeader>
            <CardContent className="space-y-1 pb-6">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="flex items-center gap-3 rounded-lg px-3 py-2.5">
                  <SkeletonBlock className="h-4 w-[100px]" />
                  <SkeletonBlock className="h-4 w-px" />
                  <SkeletonBlock className="h-4 w-32" />
                  <SkeletonBlock className="h-4 w-16" />
                  <div className="ml-auto">
                    <SkeletonBlock className="h-6 w-20 rounded-full" />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader className="space-y-2">
              <SkeletonBlock className="h-5 w-28" />
              <SkeletonBlock className="h-4 w-52 max-w-full" />
            </CardHeader>
            <CardContent className="space-y-1 pb-6">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="flex items-center gap-3 rounded-lg px-3 py-2.5">
                  <SkeletonBlock className="h-8 w-8 rounded-lg" />
                  <div className="flex-1 space-y-1.5">
                    <SkeletonBlock className="h-4 w-40" />
                    <SkeletonBlock className="h-3 w-28" />
                  </div>
                  <SkeletonBlock className="h-6 w-24 rounded-full" />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-5">
          <Card className="overflow-hidden">
            <CardHeader className="space-y-2">
              <SkeletonBlock className="h-5 w-36" />
              <SkeletonBlock className="h-4 w-56 max-w-full" />
            </CardHeader>
            <CardContent className="pb-6">
              <div className="divide-y divide-border/50">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
                    <div className="flex-1 space-y-1">
                      <SkeletonBlock className="h-4 w-44" />
                      <SkeletonBlock className="h-3 w-32" />
                    </div>
                    <SkeletonBlock className="h-3 w-24" />
                    <div className="flex gap-1">
                      <SkeletonBlock className="h-6 w-14 rounded-md" />
                      <SkeletonBlock className="h-6 w-6 rounded-md" />
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
