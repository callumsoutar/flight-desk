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
      <div className="flex min-h-[320px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50/50 py-12 text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
          <BookOpen className="h-6 w-6 text-slate-400" />
        </div>
        <h4 className="mb-2 text-base font-semibold text-slate-900">Create a training program first</h4>
        <p className="max-w-[300px] text-sm text-slate-500">
          Add a syllabus in the &quot;Training Programs&quot; tab before creating lessons.
        </p>
      </div>
    )
  }

  if (variant === "no-syllabus") {
    return (
      <div className="flex min-h-[320px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50/50 py-12 text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
          <BookOpen className="h-6 w-6 text-slate-400" />
        </div>
        <h4 className="mb-2 text-base font-semibold text-slate-900">Select a training program</h4>
        <p className="max-w-[300px] text-sm text-slate-500">
          Choose a syllabus above to start managing lessons.
        </p>
      </div>
    )
  }

  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50/50 py-12 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50">
        <BookOpen className="h-6 w-6 text-indigo-600" />
      </div>
      <h4 className="mb-2 text-base font-semibold text-slate-900">No lessons yet</h4>
      <p className="mb-6 max-w-[300px] text-sm text-slate-500">
        Get started by adding the first lesson to <span className="font-medium text-slate-700">{syllabusName}</span>.
      </p>
      <Button
        onClick={onAddLesson}
        className="h-10 rounded-lg bg-indigo-600 px-6 font-medium text-white shadow-sm transition-all hover:bg-indigo-700 active:scale-[0.98]"
      >
        <Plus className="mr-2 h-4 w-4" />
        Add First Lesson
      </Button>
    </div>
  )
}
