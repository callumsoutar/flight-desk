"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Tabs as SnapshotTabs,
  TabsContent as SnapshotTabsContent,
  TabsList as SnapshotTabsList,
  TabsTrigger as SnapshotTabsTrigger,
} from "@/components/ui/tabs"
import { TrainingStudentDebriefsTab } from "@/components/training/training-student-debriefs-tab"
import { TrainingStudentFlyingTab } from "@/components/training/training-student-flying-tab"
import { TrainingStudentOverviewTab } from "@/components/training/training-student-overview-tab"
import { useMemberTrainingQuery } from "@/hooks/use-member-training-query"
import { TrainingStudentProgrammeTab } from "@/components/training/training-student-programme-tab"
import { TrainingStudentTheoryTab } from "@/components/training/training-student-theory-tab"
import type { MemberTrainingEnrollment, MemberTrainingResponse } from "@/lib/types/member-training"
import type { TrainingOverviewRow } from "@/lib/types/training-overview"

type MemberTrainingTabProps = {
  memberId: string
}

function cleanSyllabusId(value: string | null) {
  const v = (value ?? "").trim()
  if (!v || v === "all") return null
  return v
}

function daysSince(value: string | null | undefined) {
  if (!value) return 0
  const normalized = value.includes(" ") && !value.includes("T") ? value.replace(" ", "T") : value
  const dt = new Date(normalized)
  if (Number.isNaN(dt.getTime())) return 0
  const diffMs = Date.now() - dt.getTime()
  if (!Number.isFinite(diffMs) || diffMs <= 0) return 0
  return Math.floor(diffMs / (1000 * 60 * 60 * 24))
}

type InstructorLite = MemberTrainingResponse["training"]["primaryInstructors"][number]

function enrollmentStatusLabel(enrollment: MemberTrainingEnrollment) {
  const status = (enrollment.status || "").toLowerCase()
  if (status === "active") return "Active"
  if (status === "completed" || enrollment.completion_date) return "Completed"
  if (status === "withdrawn") return "Withdrawn"
  return enrollment.status || "Unknown"
}

export function MemberTrainingTab({ memberId }: MemberTrainingTabProps) {
  const {
    data: trainingData,
    isLoading: trainingLoading,
    error: trainingError,
    refetch,
  } = useMemberTrainingQuery(memberId)
  const training = trainingData?.training ?? null
  const [instructorsById, setInstructorsById] = React.useState<Record<string, InstructorLite>>({})

  const searchParams = useSearchParams()
  const requestedSyllabusId = React.useMemo(() => cleanSyllabusId(searchParams.get("syllabus_id")), [searchParams])
  const [snapshotSyllabusId, setSnapshotSyllabusId] = React.useState<string>("")
  const [snapshotTab, setSnapshotTab] = React.useState("overview")

  React.useEffect(() => {
    const list = training?.primaryInstructors ?? []
    const next: Record<string, InstructorLite> = {}
    for (const inst of list) next[inst.id] = inst
    setInstructorsById(next)
  }, [training?.primaryInstructors])

  const timeZone = training?.timeZone ?? "Pacific/Auckland"
  const syllabi = React.useMemo(() => training?.syllabi ?? [], [training])
  const enrollments = React.useMemo(() => training?.enrollments ?? [], [training])

  const activeEnrollments = enrollments.filter(
    (e) => (e.status || "").toLowerCase() === "active" && !e.completion_date
  )

  React.useEffect(() => {
    if (trainingLoading) return

    if (!enrollments.length) {
      setSnapshotSyllabusId("")
      return
    }

    setSnapshotSyllabusId((prev) => {
      if (prev && enrollments.some((e) => e.syllabus_id === prev)) return prev
      if (requestedSyllabusId && enrollments.some((e) => e.syllabus_id === requestedSyllabusId)) return requestedSyllabusId
      if (activeEnrollments[0]?.syllabus_id) return activeEnrollments[0].syllabus_id
      return enrollments[0]?.syllabus_id ?? ""
    })
  }, [activeEnrollments, enrollments, requestedSyllabusId, trainingLoading])

  React.useEffect(() => {
    if (!snapshotSyllabusId) return
    setSnapshotTab("overview")
  }, [snapshotSyllabusId])

  const snapshotSyllabusOptions = React.useMemo(() => {
    const byId = new Map<string, { id: string; name: string; isActive: boolean; lastEnrolledAt: string | null }>()

    for (const enrollment of enrollments) {
      const id = enrollment.syllabus_id
      const name = enrollment.syllabus?.name || syllabi.find((s) => s.id === id)?.name || "Syllabus"

      const isActive = (enrollment.status || "").toLowerCase() === "active" && !enrollment.completion_date
      const existing = byId.get(id)
      const lastEnrolledAt = enrollment.enrolled_at ?? null

      if (!existing) {
        byId.set(id, { id, name, isActive, lastEnrolledAt })
        continue
      }

      byId.set(id, {
        id,
        name: existing.name || name,
        isActive: existing.isActive || isActive,
        lastEnrolledAt:
          existing.lastEnrolledAt && lastEnrolledAt
            ? existing.lastEnrolledAt > lastEnrolledAt
              ? existing.lastEnrolledAt
              : lastEnrolledAt
            : existing.lastEnrolledAt ?? lastEnrolledAt,
      })
    }

    return [...byId.values()].sort((a, b) => {
      if (a.isActive !== b.isActive) return a.isActive ? -1 : 1
      return (b.lastEnrolledAt ?? "").localeCompare(a.lastEnrolledAt ?? "")
    })
  }, [enrollments, syllabi])

  const snapshotRow = React.useMemo<TrainingOverviewRow | null>(() => {
    if (!snapshotSyllabusId) return null

    const enrollment = [...enrollments]
      .filter((e) => e.syllabus_id === snapshotSyllabusId)
      .sort((a, b) => (b.enrolled_at ?? "").localeCompare(a.enrolled_at ?? ""))[0]

    const syllabusName = enrollment?.syllabus?.name || syllabi.find((s) => s.id === snapshotSyllabusId)?.name || "Syllabus"
    const enrolledAt = enrollment?.enrolled_at ?? new Date().toISOString()
    const enrollmentStatus = enrollment ? enrollmentStatusLabel(enrollment) : "Active"
    const primaryInstructor =
      enrollment?.primary_instructor_id ? instructorsById[enrollment.primary_instructor_id] ?? null : null

    return {
      enrollment_id: enrollment?.id ?? `enrollment:${memberId}:${snapshotSyllabusId}`,
      enrolled_at: enrolledAt,
      completion_date: enrollment?.completion_date ?? null,
      enrollment_status: enrollmentStatus,
      user_id: memberId,
      syllabus_id: snapshotSyllabusId,
      primary_instructor_id: enrollment?.primary_instructor_id ?? null,
      student: {
        id: memberId,
        first_name: null,
        last_name: null,
        email: null,
      },
      syllabus: {
        id: snapshotSyllabusId,
        name: syllabusName,
      },
      primaryInstructor: primaryInstructor
        ? {
            id: primaryInstructor.id,
            first_name: primaryInstructor.user?.first_name ?? primaryInstructor.first_name ?? null,
            last_name: primaryInstructor.user?.last_name ?? primaryInstructor.last_name ?? null,
            user_id: primaryInstructor.user_id,
          }
        : null,
      last_flight_at: null,
      days_since_last_flight: null,
      days_since_enrolled: daysSince(enrolledAt),
      progress: { completed: 0, total: 0, percent: null },
      activity_status: "active",
    }
  }, [enrollments, instructorsById, memberId, snapshotSyllabusId, syllabi])

  const snapshotLoading = trainingLoading && !snapshotRow
  const snapshotTabs = [
    { id: "overview", label: "Overview" },
    { id: "flying", label: "Flying" },
    { id: "debriefs", label: "Debriefs" },
    { id: "theory", label: "Theory" },
    { id: "programme", label: "Syllabus" },
  ] as const

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold tracking-tight text-slate-900">Training Snapshot</h2>
          <p className="text-sm text-muted-foreground">
            Quick handover view plus syllabus management for instructors.
          </p>
          {trainingError ? (
            <p className="text-sm text-destructive">
              {trainingError instanceof Error ? trainingError.message : "Failed to load training data"}
            </p>
          ) : null}
        </div>
        {snapshotSyllabusOptions.length > 1 ? (
          <div className="w-full sm:w-auto sm:ml-auto">
            <Select
              value={snapshotSyllabusId || ""}
              onValueChange={setSnapshotSyllabusId}
              disabled={trainingLoading || snapshotSyllabusOptions.length === 0}
            >
              <SelectTrigger
                size="sm"
                className="h-9 w-full sm:min-w-[240px] sm:w-[280px] rounded-lg border-border/50 bg-muted/20 shadow-none hover:bg-muted/30"
              >
                <SelectValue placeholder="Select syllabus" />
              </SelectTrigger>
              <SelectContent className="rounded-lg">
                {snapshotSyllabusOptions.map((s) => (
                  <SelectItem key={s.id} value={s.id} className="text-[13px] py-2">
                    <div className="flex w-full items-center justify-between gap-4">
                      <span>{s.name}</span>
                      <span className="text-[10px] font-semibold text-slate-400">
                        {s.isActive ? "Active" : "Past"}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </div>

      {snapshotRow ? (
        <SnapshotTabs value={snapshotTab} onValueChange={setSnapshotTab} className="gap-0 w-full">
          <div className="border-b border-border/60 px-1">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="sm:hidden">
                <Select value={snapshotTab} onValueChange={setSnapshotTab}>
                  <SelectTrigger className="h-10 w-full border-border/60 bg-muted/20 shadow-none hover:bg-muted/30">
                    <SelectValue>
                      {snapshotTabs.find((tab) => tab.id === snapshotTab)?.label ?? "Overview"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {snapshotTabs.map((tab) => (
                      <SelectItem key={tab.id} value={tab.id}>
                        {tab.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <SnapshotTabsList
                variant="line"
                className="hidden sm:flex w-full flex-1 justify-start gap-4 h-10 p-0 overflow-x-auto sm:overflow-visible"
              >
                <SnapshotTabsTrigger value="overview" className="h-10 px-1 rounded-none after:bottom-[-1px] data-[state=active]:font-semibold shrink-0">
                  Overview
                </SnapshotTabsTrigger>
                <SnapshotTabsTrigger value="flying" className="h-10 px-1 rounded-none after:bottom-[-1px] data-[state=active]:font-semibold shrink-0">
                  Flying
                </SnapshotTabsTrigger>
                <SnapshotTabsTrigger value="debriefs" className="h-10 px-1 rounded-none after:bottom-[-1px] data-[state=active]:font-semibold shrink-0">
                  Debriefs
                </SnapshotTabsTrigger>
                <SnapshotTabsTrigger value="theory" className="h-10 px-1 rounded-none after:bottom-[-1px] data-[state=active]:font-semibold shrink-0">
                  Theory
                </SnapshotTabsTrigger>
                <SnapshotTabsTrigger value="programme" className="h-10 px-1 rounded-none after:bottom-[-1px] data-[state=active]:font-semibold shrink-0">
                  Syllabus
                </SnapshotTabsTrigger>
              </SnapshotTabsList>

            </div>
          </div>

          <SnapshotTabsContent value="overview" className="w-full">
            <TrainingStudentOverviewTab row={snapshotRow} />
          </SnapshotTabsContent>

          <SnapshotTabsContent value="flying" className="w-full">
            <TrainingStudentFlyingTab userId={memberId} syllabusId={snapshotRow.syllabus_id} />
          </SnapshotTabsContent>

          <SnapshotTabsContent value="debriefs" className="w-full">
            <TrainingStudentDebriefsTab userId={memberId} syllabusId={snapshotRow.syllabus_id} />
          </SnapshotTabsContent>

          <SnapshotTabsContent value="theory" className="w-full">
            <TrainingStudentTheoryTab userId={memberId} syllabusId={snapshotRow.syllabus_id} />
          </SnapshotTabsContent>

          <SnapshotTabsContent value="programme" className="w-full">
            <TrainingStudentProgrammeTab
              userId={memberId}
              syllabi={syllabi}
              enrollments={enrollments}
              timeZone={timeZone}
              onRefresh={async () => {
                await refetch()
              }}
            />
          </SnapshotTabsContent>
        </SnapshotTabs>
      ) : snapshotLoading ? (
        <div className="rounded-xl border border-border/60 bg-card shadow-sm overflow-hidden">
          <div className="border-b border-border/60 px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                {["Overview", "Flying", "Debriefs", "Theory", "Syllabus"].map((label) => (
                  <div
                    key={label}
                    className="h-8 w-20 rounded-md bg-muted/40 animate-pulse"
                  />
                ))}
              </div>
              <div className="ml-auto h-8 w-56 rounded-full bg-muted/40 animate-pulse" />
            </div>
          </div>
          <div className="p-6 space-y-4">
            <div className="h-5 w-56 rounded bg-muted/40 animate-pulse" />
            <div className="h-28 w-full rounded-xl border border-border/60 bg-muted/10 animate-pulse" />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="h-28 w-full rounded-xl border border-border/60 bg-muted/10 animate-pulse" />
              <div className="h-28 w-full rounded-xl border border-border/60 bg-muted/10 animate-pulse" />
            </div>
            <div className="h-44 w-full rounded-xl border border-border/60 bg-muted/10 animate-pulse" />
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-border/60 bg-muted/10 p-8 text-center text-sm text-muted-foreground">
          No syllabus enrollments found for this member.
        </div>
      )}
    </div>
  )
}
