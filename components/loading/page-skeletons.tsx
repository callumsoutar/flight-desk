import * as React from "react"

import { Card, CardContent, CardHeader } from "@/components/ui/card"

import { SkeletonBlock, SkeletonKeyValueGrid, SkeletonTable } from "@/components/loading/skeleton-primitives"

export function ListPageSkeleton({ showTabs = false }: { showTabs?: boolean }) {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-live="polite">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end" aria-hidden="true">
        <div className="space-y-2">
          <SkeletonBlock className="h-9 w-44" />
          <SkeletonBlock className="h-4 w-72" />
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <SkeletonBlock className="h-10 w-64" />
          <SkeletonBlock className="h-10 w-28" />
        </div>
      </div>

      {showTabs ? (
        <div className="flex items-center gap-2 border-b border-slate-200 pb-2" aria-hidden="true">
          <SkeletonBlock className="h-7 w-24" />
          <SkeletonBlock className="h-7 w-24" />
          <SkeletonBlock className="h-7 w-24" />
          <SkeletonBlock className="h-7 w-24" />
        </div>
      ) : null}

      <SkeletonTable />
    </div>
  )
}

export function AircraftDetailSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-8 sm:px-6 lg:px-8" aria-busy="true" aria-live="polite">
      <SkeletonBlock className="mb-6 h-4 w-36" />

      <Card className="mb-6 border border-border/50 bg-card py-0 shadow-sm">
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-start gap-4">
            <SkeletonBlock className="h-20 w-20 rounded-full" />
            <div className="flex-1 space-y-3">
              <SkeletonBlock className="h-8 w-44" />
              <SkeletonBlock className="h-4 w-72" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border border-border/50 bg-card py-0 shadow-sm">
        <CardContent className="space-y-6 p-6">
          <div className="flex gap-2" aria-hidden="true">
            <SkeletonBlock className="h-8 w-24" />
            <SkeletonBlock className="h-8 w-32" />
            <SkeletonBlock className="h-8 w-32" />
          </div>
          <SkeletonTable columns={3} rows={6} className="border-0 shadow-none" />
        </CardContent>
      </Card>
    </div>
  )
}

export function BookingDetailSkeleton() {
  return (
    <div className="flex flex-1 flex-col bg-muted/30" aria-busy="true" aria-live="polite">
      <div className="border-b border-border/40 bg-background">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8" aria-hidden="true">
          <div className="space-y-2">
            <SkeletonBlock className="h-3 w-28" />
            <SkeletonBlock className="h-7 w-48" />
            <SkeletonBlock className="h-4 w-36" />
          </div>
          <SkeletonBlock className="h-9 w-36" />
        </div>
      </div>

      <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-6 px-4 pt-6 pb-28 sm:px-6 lg:grid-cols-3 lg:gap-8 lg:px-8" aria-hidden="true">
        <Card className="lg:col-span-2">
          <CardHeader className="space-y-2">
            <SkeletonBlock className="h-8 w-64" />
            <SkeletonBlock className="h-4 w-44" />
          </CardHeader>
          <CardContent>
            <SkeletonKeyValueGrid rows={6} />
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <SkeletonBlock className="h-6 w-28" />
            </CardHeader>
            <CardContent className="space-y-3">
              <SkeletonBlock className="h-4 w-full" />
              <SkeletonBlock className="h-4 w-5/6" />
              <SkeletonBlock className="h-4 w-2/3" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <SkeletonBlock className="h-6 w-24" />
            </CardHeader>
            <CardContent className="space-y-3">
              <SkeletonBlock className="h-4 w-full" />
              <SkeletonBlock className="h-4 w-4/5" />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export function MemberDetailSkeleton() {
  return (
    <div className="w-full py-8" aria-busy="true" aria-live="polite">
      <SkeletonBlock className="mb-6 h-4 w-32" />

      <Card className="mb-6 border border-border/50 bg-card py-0 shadow-sm">
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-start gap-4">
            <SkeletonBlock className="h-20 w-20 rounded-full" />
            <div className="flex-1 space-y-3">
              <SkeletonBlock className="h-8 w-64" />
              <SkeletonBlock className="h-4 w-80" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border border-border/50 bg-card py-0 shadow-sm">
        <CardContent className="p-6">
          <div className="mb-6 flex gap-2" aria-hidden="true">
            <SkeletonBlock className="h-7 w-24" />
            <SkeletonBlock className="h-7 w-32" />
            <SkeletonBlock className="h-7 w-32" />
          </div>
          <SkeletonTable columns={3} rows={5} className="border-0 shadow-none" />
        </CardContent>
      </Card>
    </div>
  )
}

export function InvoiceDetailSkeleton() {
  return (
    <div className="flex flex-1 flex-col bg-muted/20" aria-busy="true" aria-live="polite">
      <div className="mx-auto w-full max-w-[920px] px-4 py-4 sm:px-6 lg:px-10 lg:py-8">
        <div className="sticky top-0 z-20 -mx-4 border-b bg-background/95 px-4 py-2.5 shadow-sm sm:-mx-6 sm:px-6 sm:py-4 lg:-mx-10 lg:px-10" aria-hidden="true">
          <div className="flex items-center justify-between gap-3">
            <SkeletonBlock className="h-8 w-48" />
            <SkeletonBlock className="h-8 w-36" />
          </div>
        </div>

        <div className="mt-6 space-y-6" aria-hidden="true">
          <Card className="shadow-sm ring-1 ring-border/40">
            <CardContent className="space-y-4 p-6">
              <SkeletonBlock className="h-8 w-40" />
              <SkeletonTable columns={4} rows={6} className="border-0 shadow-none" />
            </CardContent>
          </Card>
          <Card className="shadow-sm ring-1 ring-border/40">
            <CardContent className="space-y-3 p-6">
              <SkeletonBlock className="h-5 w-24" />
              <SkeletonBlock className="h-4 w-64" />
              <SkeletonBlock className="h-28 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
