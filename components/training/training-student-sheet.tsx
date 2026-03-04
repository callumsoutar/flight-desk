"use client"

import * as React from "react"

import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TrainingStudentDebriefsTab } from "@/components/training/training-student-debriefs-tab"
import { TrainingStudentFlyingTab } from "@/components/training/training-student-flying-tab"
import { TrainingStudentOverviewTab } from "@/components/training/training-student-overview-tab"
import { TrainingStudentTheoryTab } from "@/components/training/training-student-theory-tab"
import { cn, getUserInitials } from "@/lib/utils"
import type { TrainingOverviewRow } from "@/lib/types/training-overview"

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

  React.useEffect(() => {
    if (row) setActiveTab("overview")
  }, [row])

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
              <div className="flex items-start gap-4">
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
              </div>
            </SheetHeader>

            <div className="flex-1 overflow-auto">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="gap-0">
                <div className="border-b px-4 py-3">
                  <TabsList variant="line" className="w-full justify-start">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="flying">Flying</TabsTrigger>
                    <TabsTrigger value="debriefs">Debriefs</TabsTrigger>
                    <TabsTrigger value="theory">Theory</TabsTrigger>
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
