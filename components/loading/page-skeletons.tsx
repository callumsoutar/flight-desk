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

export function SettingsPageSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-live="polite">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end" aria-hidden="true">
        <div className="space-y-2">
          <SkeletonBlock className="h-9 w-40" />
          <SkeletonBlock className="h-4 w-96 max-w-full" />
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <SkeletonBlock className="h-10 w-32" />
          <SkeletonBlock className="h-10 w-32" />
        </div>
      </div>

      <Card className="border border-border/50 bg-card py-0 shadow-sm" aria-hidden="true">
        <CardContent className="p-0">
          <div className="border-b border-slate-200 bg-white px-6 pt-4 pb-3">
            <div className="flex gap-3 overflow-hidden">
              <SkeletonBlock className="h-6 w-24" />
              <SkeletonBlock className="h-6 w-28" />
              <SkeletonBlock className="h-6 w-28" />
              <SkeletonBlock className="h-6 w-28" />
            </div>
          </div>
          <div className="p-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <Card className="border border-border/50 bg-card py-0 shadow-sm">
                <CardContent className="space-y-3 p-6">
                  <SkeletonBlock className="h-5 w-40" />
                  <SkeletonBlock className="h-4 w-72" />
                  <SkeletonBlock className="h-10 w-full" />
                  <SkeletonBlock className="h-10 w-full" />
                </CardContent>
              </Card>
              <Card className="border border-border/50 bg-card py-0 shadow-sm">
                <CardContent className="space-y-3 p-6">
                  <SkeletonBlock className="h-5 w-44" />
                  <SkeletonBlock className="h-4 w-64" />
                  <SkeletonBlock className="h-10 w-full" />
                  <SkeletonBlock className="h-10 w-full" />
                </CardContent>
              </Card>
            </div>
          </div>
        </CardContent>
      </Card>
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

/** Skeleton for the debrief view page (report-style layout). */
export function DebriefViewSkeleton() {
  return (
    <div className="min-h-screen bg-muted/30 pb-20" aria-busy="true" aria-live="polite">
      <div className="border-b border-border/40 bg-background py-4 sm:py-6">
        <div className="w-full px-4 sm:px-6 lg:px-8" aria-hidden="true">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <SkeletonBlock className="h-4 w-28" />
              <SkeletonBlock className="h-6 w-56 sm:h-7" />
            </div>
            <SkeletonBlock className="h-9 w-24" />
          </div>
        </div>
      </div>

      <div className="w-full max-w-none flex-1 px-4 pt-6 pb-28 sm:px-6 lg:px-8">
        <div
          className="mx-auto w-full max-w-4xl rounded-xl border border-border/50 bg-card px-6 py-8 shadow-sm sm:px-8 sm:py-10 lg:px-10 lg:py-12"
          aria-hidden="true"
        >
          <div className="w-full space-y-0">
            <header className="border-b border-border/40 pb-6">
              <SkeletonBlock className="mb-2 h-3 w-36" />
              <SkeletonBlock className="h-8 w-64 sm:h-9 sm:w-72" />
              <SkeletonBlock className="mt-2 h-4 w-48" />
            </header>

            <div className="flex flex-wrap gap-4 border-b border-border/40 py-4">
              <SkeletonBlock className="h-4 w-20" />
              <SkeletonBlock className="h-4 w-16" />
              <SkeletonBlock className="h-4 w-24" />
            </div>

            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 border-b border-border/40 py-6 sm:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="space-y-1">
                  <SkeletonBlock className="h-3 w-16" />
                  <SkeletonBlock className="h-4 w-28" />
                </div>
              ))}
            </dl>

            <section className="border-b border-border/40 py-6">
              <SkeletonBlock className="mb-3 h-3 w-32" />
              <div className="space-y-2">
                <SkeletonBlock className="h-4 w-full" />
                <SkeletonBlock className="h-4 w-5/6" />
                <SkeletonBlock className="h-4 w-4/5" />
              </div>
            </section>

            <div className="grid gap-8 py-8 sm:grid-cols-2 sm:gap-12">
              <div className="space-y-5">
                <SkeletonBlock className="h-3 w-28" />
                <SkeletonBlock className="h-4 w-full" />
                <SkeletonBlock className="h-4 w-5/6" />
                <SkeletonBlock className="h-3 w-24 mt-4" />
                <SkeletonBlock className="h-4 w-full" />
              </div>
              <div className="space-y-5">
                <SkeletonBlock className="h-3 w-36" />
                <SkeletonBlock className="h-4 w-full" />
                <SkeletonBlock className="h-3 w-28 mt-4" />
                <SkeletonBlock className="h-4 w-4/5" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Skeleton for the debrief write page (form with status tracker and debrief editor card). */
export function DebriefWriteSkeleton() {
  return (
    <div className="min-h-screen bg-background pb-20" aria-busy="true" aria-live="polite">
      <div className="border-b border-border/40 bg-background py-4 sm:py-6">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8" aria-hidden="true">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <SkeletonBlock className="h-4 w-28" />
              <SkeletonBlock className="h-6 w-64 sm:h-7" />
              <SkeletonBlock className="h-4 w-72 max-w-full" />
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-7xl px-4 pt-6 pb-10 sm:px-6 lg:px-8">
        {/* Status tracker */}
        <div className="mb-6 flex items-center overflow-hidden rounded-lg border border-border/60 bg-card shadow-sm" aria-hidden="true">
          <div className="flex flex-1">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex flex-1 items-center">
                <div className="flex h-10 flex-1 items-center justify-center px-2 sm:px-3">
                  <SkeletonBlock className="h-4 w-14 sm:w-16" />
                </div>
                {i < 5 ? (
                  <div className="h-4 w-3 shrink-0 bg-border/50" aria-hidden="true" />
                ) : null}
              </div>
            ))}
          </div>
        </div>

        {/* Debrief form card */}
        <div className="space-y-6">
          <div className="flex items-center gap-3" aria-hidden="true">
            <SkeletonBlock className="h-5 w-28" />
            <SkeletonBlock className="h-5 w-16 rounded-full" />
          </div>

          <div className="rounded-xl border border-border/60 bg-card shadow-sm">
            <div className="space-y-8 px-5 py-6">
              <div className="space-y-3">
                <SkeletonBlock className="h-4 w-28" />
                <div className="flex flex-wrap gap-2">
                  <SkeletonBlock className="h-9 w-24 rounded-md" />
                  <SkeletonBlock className="h-9 w-36 rounded-md" />
                </div>
              </div>

              <div className="space-y-4 border-t border-border/60 pt-6">
                <SkeletonBlock className="h-4 w-32" />
                <div className="space-y-4">
                  <div className="space-y-2">
                    <SkeletonBlock className="h-3 w-24" />
                    <SkeletonBlock className="h-[140px] w-full rounded-lg" />
                  </div>
                  <div className="space-y-2">
                    <SkeletonBlock className="h-3 w-36" />
                    <SkeletonBlock className="h-[88px] w-full rounded-lg" />
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-dashed border-border/70 bg-muted/10 px-4 py-4">
                <div className="flex items-center justify-between gap-4">
                  <SkeletonBlock className="h-4 w-32" />
                  <SkeletonBlock className="h-8 w-20" />
                </div>
              </div>
            </div>

            <div className="border-t border-border/60 bg-muted/30 px-5 py-4" aria-hidden="true">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <SkeletonBlock className="h-4 w-56" />
                <SkeletonBlock className="h-11 w-40 rounded-md" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function MemberDetailSkeleton() {
  return (
    <div className="w-full" aria-busy="true" aria-live="polite">
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

export function InstructorDetailSkeleton() {
  return (
    <div className="w-full py-8" aria-busy="true" aria-live="polite">
      <SkeletonBlock className="mb-6 h-4 w-40" />

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

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="border border-border/50 bg-card py-0 shadow-sm">
          <CardContent className="p-4">
            <SkeletonBlock className="h-4 w-28" />
            <SkeletonBlock className="mt-2 h-8 w-16" />
          </CardContent>
        </Card>
        <Card className="border border-border/50 bg-card py-0 shadow-sm">
          <CardContent className="p-4">
            <SkeletonBlock className="h-4 w-32" />
            <SkeletonBlock className="mt-2 h-8 w-16" />
          </CardContent>
        </Card>
        <Card className="border border-border/50 bg-card py-0 shadow-sm">
          <CardContent className="p-4">
            <SkeletonBlock className="h-4 w-36" />
            <SkeletonBlock className="mt-2 h-8 w-20" />
          </CardContent>
        </Card>
      </div>

      <Card className="border border-border/50 bg-card py-0 shadow-sm">
        <CardContent className="p-6">
          <div className="mb-6 flex gap-2" aria-hidden="true">
            <SkeletonBlock className="h-7 w-24" />
            <SkeletonBlock className="h-7 w-28" />
            <SkeletonBlock className="h-7 w-24" />
            <SkeletonBlock className="h-7 w-32" />
          </div>
          <SkeletonTable columns={4} rows={5} className="border-0 shadow-none" />
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

export function ReportsPageSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-live="polite">
      <div className="space-y-2" aria-hidden="true">
        <SkeletonBlock className="h-8 w-32" />
        <SkeletonBlock className="h-4 w-80" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="border border-border/50 bg-card py-0 shadow-sm">
            <CardContent className="space-y-2 p-4 sm:p-6">
              <SkeletonBlock className="h-4 w-24" />
              <SkeletonBlock className="h-7 w-16" />
              <SkeletonBlock className="h-3 w-36" />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="space-y-4" aria-hidden="true">
        <div className="flex gap-2">
          <SkeletonBlock className="h-8 w-24" />
          <SkeletonBlock className="h-8 w-20" />
          <SkeletonBlock className="h-8 w-20" />
          <SkeletonBlock className="h-8 w-24" />
        </div>
        <Card className="border border-border/50 bg-card py-0 shadow-sm">
          <CardContent className="space-y-3 p-4 sm:p-6">
            <SkeletonBlock className="h-5 w-40" />
            <SkeletonBlock className="h-4 w-72" />
            <SkeletonBlock className="h-[280px] w-full rounded-lg" />
          </CardContent>
        </Card>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="border border-border/50 bg-card py-0 shadow-sm">
            <CardContent className="space-y-3 p-4 sm:p-6">
              <SkeletonBlock className="h-5 w-36" />
              <SkeletonBlock className="h-[220px] w-full rounded-lg" />
            </CardContent>
          </Card>
          <Card className="border border-border/50 bg-card py-0 shadow-sm">
            <CardContent className="space-y-3 p-4 sm:p-6">
              <SkeletonBlock className="h-5 w-44" />
              <SkeletonBlock className="h-[220px] w-full rounded-lg" />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export function EquipmentDetailSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-8 sm:px-6 lg:px-8" aria-busy="true" aria-live="polite">
      <SkeletonBlock className="mb-6 h-4 w-40" />

      <Card className="mb-6 border border-border/50 bg-card py-0 shadow-sm">
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-start gap-4">
            <SkeletonBlock className="h-16 w-16 rounded-lg" />
            <div className="flex-1 space-y-3">
              <SkeletonBlock className="h-8 w-56" />
              <SkeletonBlock className="h-4 w-72" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border border-border/50 bg-card py-0 shadow-sm">
        <CardContent className="space-y-6 p-6">
          <div className="flex gap-2" aria-hidden="true">
            <SkeletonBlock className="h-8 w-24" />
            <SkeletonBlock className="h-8 w-36" />
            <SkeletonBlock className="h-8 w-24" />
          </div>
          <SkeletonTable columns={2} rows={6} className="border-0 shadow-none" />
        </CardContent>
      </Card>
    </div>
  )
}
