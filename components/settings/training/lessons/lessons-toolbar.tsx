"use client"

import { Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { Syllabus } from "@/lib/types/syllabus"

type LessonsToolbarProps = {
  selectedSyllabus: string | null
  syllabi: Syllabus[]
  syllabusLoading: boolean
  hasLessons: boolean
  onSelectSyllabus: (syllabusId: string) => void
  onAddLesson: () => void
}

export function LessonsToolbar({
  selectedSyllabus,
  syllabi,
  syllabusLoading,
  hasLessons,
  onSelectSyllabus,
  onAddLesson,
}: LessonsToolbarProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex w-full max-w-md items-center gap-4">
        <Label className="shrink-0 text-sm font-medium text-slate-700">
          Training Program
        </Label>
        <Select
          value={selectedSyllabus || ""}
          onValueChange={onSelectSyllabus}
          disabled={syllabusLoading || syllabi.length === 0}
        >
          <SelectTrigger className="h-10 flex-1 rounded-lg border-slate-200 bg-slate-50 text-sm font-medium shadow-none transition-colors hover:bg-slate-100 focus-visible:ring-1 focus-visible:ring-indigo-500">
            <SelectValue
              placeholder={syllabusLoading ? "Loading programs..." : "Select a program"}
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

      {hasLessons && (
        <Button
          disabled={!selectedSyllabus}
          onClick={onAddLesson}
          className="h-10 shrink-0 rounded-lg bg-indigo-600 px-4 font-medium text-white shadow-sm transition-all hover:bg-indigo-700 active:scale-[0.98]"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Lesson
        </Button>
      )}
    </div>
  )
}
