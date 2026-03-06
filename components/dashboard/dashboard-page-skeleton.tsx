import * as React from "react"

import { SkeletonBlock } from "@/components/loading/skeleton-primitives"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

export function DashboardPageSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between" aria-hidden="true">
        <div className="space-y-2">
          <SkeletonBlock className="h-8 w-40" />
          <SkeletonBlock className="h-4 w-80 max-w-full" />
        </div>
        <div className="flex gap-2">
          <SkeletonBlock className="h-9 w-28" />
          <SkeletonBlock className="h-9 w-32" />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" aria-hidden="true">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index} className="overflow-hidden">
            <CardHeader className="space-y-2">
              <SkeletonBlock className="h-4 w-32" />
              <SkeletonBlock className="h-8 w-24" />
            </CardHeader>
            <CardContent className="space-y-2 pb-6">
              <SkeletonBlock className="h-4 w-44" />
              <SkeletonBlock className="h-4 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-12" aria-hidden="true">
        <div className="space-y-6 lg:col-span-7">
          <Card className="overflow-hidden">
            <CardHeader className="space-y-2">
              <SkeletonBlock className="h-5 w-44" />
              <SkeletonBlock className="h-4 w-72 max-w-full" />
            </CardHeader>
            <CardContent className="space-y-3 pb-6">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="flex items-center justify-between rounded-lg border border-border/60 p-3">
                  <div className="space-y-2">
                    <SkeletonBlock className="h-4 w-40" />
                    <SkeletonBlock className="h-3 w-56" />
                  </div>
                  <SkeletonBlock className="h-8 w-16" />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader className="space-y-2">
              <SkeletonBlock className="h-5 w-40" />
              <SkeletonBlock className="h-4 w-60 max-w-full" />
            </CardHeader>
            <CardContent className="space-y-3 pb-6">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="flex items-center justify-between rounded-lg border border-border/60 p-3">
                  <div className="space-y-2">
                    <SkeletonBlock className="h-4 w-44" />
                    <SkeletonBlock className="h-3 w-52" />
                  </div>
                  <SkeletonBlock className="h-8 w-20" />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6 lg:col-span-5">
          <Card className="overflow-hidden">
            <CardHeader className="space-y-2">
              <SkeletonBlock className="h-5 w-44" />
              <SkeletonBlock className="h-4 w-72 max-w-full" />
            </CardHeader>
            <CardContent className="space-y-3 pb-6">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="flex items-center justify-between rounded-lg border border-border/60 p-3">
                  <div className="space-y-2">
                    <SkeletonBlock className="h-4 w-40" />
                    <SkeletonBlock className="h-3 w-56" />
                  </div>
                  <div className="flex gap-2">
                    <SkeletonBlock className="h-8 w-20" />
                    <SkeletonBlock className="h-8 w-20" />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader className="space-y-2">
              <SkeletonBlock className="h-5 w-36" />
              <SkeletonBlock className="h-4 w-64 max-w-full" />
            </CardHeader>
            <CardContent className="space-y-3 pb-6">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="flex items-center justify-between rounded-lg border border-border/60 p-3">
                  <div className="space-y-2">
                    <SkeletonBlock className="h-4 w-36" />
                    <SkeletonBlock className="h-3 w-44" />
                  </div>
                  <SkeletonBlock className="h-7 w-20" />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

