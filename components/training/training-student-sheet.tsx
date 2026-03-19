"use client"

import * as React from "react"
import dynamic from "next/dynamic"
import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TrainingStudentOverviewTab } from "@/components/training/training-student-overview-tab"
import { cn, getUserInitials } from "@/lib/utils"
import type { MemberTrainingResponse } from "@/lib/types/member-training"
import type { TrainingOverviewRow } from "@/lib/types/training-overview"

const TrainingStudentFlyingTab = dynamic(
  () =>
    import("@/components/training/training-student-flying-tab").then(
      (mod) => mod.TrainingStudentFlyingTab
    ),
  { ssr: false }
)

const TrainingStudentDebriefsTab = dynamic(
  () =>
    import("@/components/training/training-student-debriefs-tab").then(
      (mod) => mod.TrainingStudentDebriefsTab
    ),
  { ssr: false }
)

const TrainingStudentTheoryTab = dynamic(
  () =>
    import("@/components/training/training-student-theory-tab").then(
      (mod) => mod.TrainingStudentTheoryTab
    ),
  { ssr: false }
)

const TrainingStudentProgrammeTab = dynamic(
  () =>
    import("@/components/training/training-student-programme-tab").then(
      (mod) => mod.TrainingStudentProgrammeTab
    ),
  { ssr: false }
)

function statusBadge(status: TrainingOverviewRow["activity_status"]) {
  if (status === "active") {
    return { label: "Active", className: "bg-emerald-50 text-emerald-700 border-emerald-200/50" }
  }
  if (status === "stale") {
    return { label: "Stale", className: "bg-rose-50 text-rose-700 border-rose-200/50" }
  }
  if (status === "new") {
    return { label: "New", className: "bg-blue-50 text-blue-700 border-blue-200/50" }
  }
  return { label: "At risk", className: "bg-amber-50 text-amber-700 border-amber-200/50" }
}

function fullName(row: TrainingOverviewRow) {
  const first = row.student.first_name ?? ""
  const last = row.student.last_name ?? ""
  const name = `${first} ${last}`.trim()
  return name.length ? name : row.student.email ?? "Student"
}

export function TrainingStudentSheet({
  row,
  open,
  onOpenChange,
}: {
  row: TrainingOverviewRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [activeTab, setActiveTab] = React.useState("overview")
  const [programme, setProgramme] = React.useState<MemberTrainingResponse["training"] | null>(null)
  const [programmeLoading, setProgrammeLoading] = React.useState(false)
  const [programmeError, setProgrammeError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (row) setActiveTab("overview")
    setProgramme(null)
    setProgrammeError(null)
    setProgrammeLoading(false)
  }, [row])

  const loadProgramme = React.useCallback(async () => {
    if (!row) return
    setProgrammeLoading(true)
    setProgrammeError(null)
    try {
      const res = await fetch(`/api/members/${row.user_id}/training`, { cache: "no-store" })
      const payload = (await res.json().catch(() => null)) as { error?: string } | null
      if (!res.ok) throw new Error(payload?.error || "Failed to load syllabus data")
      const data = payload as unknown as MemberTrainingResponse
      setProgramme(data.training)
    } catch (err) {
      setProgramme(null)
      setProgrammeError(err instanceof Error ? err.message : "Failed to load syllabus data")
    } finally {
      setProgrammeLoading(false)
    }
  }, [row])

  React.useEffect(() => {
    if (!row) return
    if (activeTab !== "programme") return
    if (programme || programmeLoading) return
    void loadProgramme()
  }, [activeTab, loadProgramme, programme, programmeLoading, row])

  const initials = row
    ? getUserInitials(row.student.first_name, row.student.last_name, row.student.email)
    : "U"

  const name = row ? fullName(row) : ""
  const badge = row ? statusBadge(row.activity_status) : null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full md:w-[65vw] max-w-[900px] sm:max-w-[900px]"
        overlayClassName="bg-black/60 backdrop-blur-[2px]"
      >
        {row ? (
          <div className="flex h-full flex-col">
            <SheetHeader className="gap-3 border-b">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar className="h-10 w-10 rounded-full border border-slate-200/50 shadow-sm ring-2 ring-white">
                    <AvatarFallback className="bg-slate-100 text-slate-500 text-[11px] font-bold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <SheetTitle className="truncate">{name}</SheetTitle>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-xs text-muted-foreground truncate">{row.syllabus.name}</span>
                      {badge ? (
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] font-bold px-2.5 py-1 rounded-lg shadow-none border uppercase tracking-wider",
                            badge.className
                          )}
                        >
                          {badge.label}
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                </div>
                <div className="sm:ml-auto shrink-0">
                  <Button variant="outline" size="sm" asChild className="w-full sm:w-auto">
                    <Link href={`/members/${row.user_id}?tab=training&syllabus_id=${row.syllabus_id}`}>
                      Open full record
                    </Link>
                  </Button>
                </div>
              </div>
            </SheetHeader>

            <div className="flex-1 overflow-auto">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="gap-0">
                <div className="border-b px-4 py-3">
                  <TabsList
                    variant="line"
                    className="w-full justify-start gap-4 h-10 p-0 overflow-x-auto sm:overflow-visible"
                  >
                    <TabsTrigger value="overview" className="h-10 px-1 rounded-none after:bottom-[-1px] data-[state=active]:font-semibold shrink-0">
                      Overview
                    </TabsTrigger>
                    <TabsTrigger value="flying" className="h-10 px-1 rounded-none after:bottom-[-1px] data-[state=active]:font-semibold shrink-0">
                      Flying
                    </TabsTrigger>
                    <TabsTrigger value="debriefs" className="h-10 px-1 rounded-none after:bottom-[-1px] data-[state=active]:font-semibold shrink-0">
                      Debriefs
                    </TabsTrigger>
                    <TabsTrigger value="theory" className="h-10 px-1 rounded-none after:bottom-[-1px] data-[state=active]:font-semibold shrink-0">
                      Theory
                    </TabsTrigger>
                    <TabsTrigger value="programme" className="h-10 px-1 rounded-none after:bottom-[-1px] data-[state=active]:font-semibold shrink-0">
                      Syllabus
                    </TabsTrigger>
                  </TabsList>
                </div>

                <TabsContent value="overview">
                  <TrainingStudentOverviewTab row={row} />
                </TabsContent>

                <TabsContent value="flying">
                  <TrainingStudentFlyingTab userId={row.user_id} syllabusId={row.syllabus_id} />
                </TabsContent>

                <TabsContent value="debriefs">
                  <TrainingStudentDebriefsTab userId={row.user_id} syllabusId={row.syllabus_id} />
                </TabsContent>

                <TabsContent value="programme">
                  <div className="p-6">
                    {programmeLoading ? (
                      <div className="text-sm text-muted-foreground">Loading syllabus…</div>
                    ) : programmeError ? (
                      <div className="text-sm text-destructive">{programmeError}</div>
                    ) : programme ? (
                      <TrainingStudentProgrammeTab
                        userId={row.user_id}
                        syllabi={programme.syllabi}
                        enrollments={programme.enrollments}
                        timeZone={programme.timeZone}
                        onRefresh={loadProgramme}
                      />
                    ) : (
                      <div className="text-sm text-muted-foreground">Syllabus details unavailable.</div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="theory">
                  <TrainingStudentTheoryTab userId={row.user_id} syllabusId={row.syllabus_id} />
                </TabsContent>
              </Tabs>
            </div>
          </div>
        ) : (
          <div className="p-6 text-sm text-muted-foreground">No student selected.</div>
        )}
      </SheetContent>
    </Sheet>
  )
}
