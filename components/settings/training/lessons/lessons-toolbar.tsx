"use client"

import { Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { Syllabus } from "@/lib/types/syllabus"

type LessonsToolbarProps = {
  selectedSyllabus: string | null
  selectedSyllabusData?: Syllabus
  syllabi: Syllabus[]
  syllabusLoading: boolean
  totalLessons: number
  requiredLessons: number
  inactiveLessons: number
  onSelectSyllabus: (syllabusId: string) => void
  onAddLesson: () => void
}

export function LessonsToolbar({
  selectedSyllabus,
  selectedSyllabusData,
  syllabi,
  syllabusLoading,
  totalLessons,
  requiredLessons,
  inactiveLessons,
  onSelectSyllabus,
  onAddLesson,
}: LessonsToolbarProps) {
  const metaParts = selectedSyllabusData
    ? [
        selectedSyllabusData.name,
        `${totalLessons} lessons`,
        `${requiredLessons} required`,
        inactiveLessons > 0 ? `${inactiveLessons} inactive` : null,
      ].filter(Boolean)
    : []

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="w-full max-w-md space-y-1.5">
          <Label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Training program</Label>
          <Select
            value={selectedSyllabus ?? undefined}
            onValueChange={onSelectSyllabus}
            disabled={syllabusLoading || syllabi.length === 0}
          >
            <SelectTrigger className="h-10 rounded-lg bg-white">
              <SelectValue
                placeholder={syllabusLoading ? "Loading training programs..." : "Select a training program"}
              />
            </SelectTrigger>
            <SelectContent>
              {syllabi.map((syllabus) => (
                <SelectItem key={syllabus.id} value={syllabus.id}>
                  {syllabus.name}
                  {!syllabus.is_active ? " (inactive)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button disabled={!selectedSyllabus} onClick={onAddLesson} className="h-10 rounded-lg px-4">
          <Plus className="mr-1.5 h-4 w-4" />
          Add Lesson
        </Button>
      </div>

      {metaParts.length > 0 ? (
        <p className="text-xs text-slate-500">{metaParts.join("  •  ")}</p>
      ) : null}
    </div>
  )
}
