"use client"

import { Filter, Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { Syllabus } from "@/lib/types/syllabus"

type LessonsToolbarProps = {
  selectedSyllabus: string | null
  syllabi: Syllabus[]
  syllabusLoading: boolean
  onSelectSyllabus: (syllabusId: string) => void
  onAddLesson: () => void
}

export function LessonsToolbar({
  selectedSyllabus,
  syllabi,
  syllabusLoading,
  onSelectSyllabus,
  onAddLesson,
}: LessonsToolbarProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="w-full max-w-md space-y-2">
        <Label className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          <Filter className="h-3.5 w-3.5" />
          Syllabus
        </Label>
        <Select
          value={selectedSyllabus ?? undefined}
          onValueChange={onSelectSyllabus}
          disabled={syllabusLoading || syllabi.length === 0}
        >
          <SelectTrigger className="h-11 rounded-xl border-slate-200 bg-white text-left text-sm font-medium shadow-none transition-colors hover:bg-slate-50 focus-visible:ring-1 focus-visible:ring-indigo-100">
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

      <Button
        disabled={!selectedSyllabus}
        onClick={onAddLesson}
        className="h-10 rounded-xl border-none bg-indigo-600 px-4 font-semibold text-white shadow-sm shadow-indigo-100 transition-all hover:bg-indigo-700 active:scale-[0.98]"
      >
        <Plus className="h-4 w-4" />
        Add Lesson
      </Button>
    </div>
  )
}
