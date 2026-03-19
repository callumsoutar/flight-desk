"use client"

import { BookOpen, Plus } from "lucide-react"

import { Button } from "@/components/ui/button"

type LessonsEmptyStateProps = {
  variant: "no-syllabus" | "no-lessons" | "no-programs"
  syllabusName?: string
  onAddLesson?: () => void
}

export function LessonsEmptyState({ variant, syllabusName, onAddLesson }: LessonsEmptyStateProps) {
  if (variant === "no-programs") {
    return (
      <div className="flex min-h-[260px] flex-col items-center justify-center py-10 text-center">
        <BookOpen className="mb-3 h-5 w-5 text-slate-400" />
        <h4 className="mb-1 text-sm font-semibold text-slate-900">Create a training program first</h4>
        <p className="max-w-[280px] text-sm text-slate-500">
          Add a syllabus in the &quot;Training Programs&quot; tab before creating lessons.
        </p>
      </div>
    )
  }

  if (variant === "no-syllabus") {
    return (
      <div className="flex min-h-[260px] flex-col items-center justify-center py-10 text-center">
        <h4 className="mb-1 text-sm font-semibold text-slate-900">Select a training program</h4>
        <p className="max-w-[260px] text-sm text-slate-500">
          Choose a syllabus above to start managing lessons.
        </p>
      </div>
    )
  }

  return (
    <div className="flex min-h-[260px] flex-col items-center justify-center py-10 text-center">
      <Plus className="mb-3 h-5 w-5 text-slate-400" />
      <h4 className="mb-1 text-sm font-semibold text-slate-900">No lessons yet</h4>
      <p className="mb-4 max-w-[260px] text-sm text-slate-500">Add the first lesson to {syllabusName}.</p>
      <Button
        onClick={onAddLesson}
        className="h-10 rounded-xl border-none bg-indigo-600 px-4 font-semibold text-white shadow-sm shadow-indigo-100 transition-all hover:bg-indigo-700 active:scale-[0.98]"
      >
        <Plus className="h-4 w-4" />
        Add Lesson
      </Button>
    </div>
  )
}
