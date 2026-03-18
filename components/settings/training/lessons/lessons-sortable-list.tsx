"use client"

import * as React from "react"
import { Archive, Edit, GripVertical } from "lucide-react"
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { DragOverlay } from "@dnd-kit/core"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { Lesson } from "@/lib/types/lessons"

import { titleCaseStage } from "./lessons-api"

type LessonsSortableListProps = {
  lessons: Lesson[]
  activeLesson: Lesson | null
  onEditLesson: (lesson: Lesson) => void
  onDeleteLesson: (id: string) => void
}

type SortableLessonRowProps = {
  lesson: Lesson
  onEditLesson: (lesson: Lesson) => void
  onDeleteLesson: (id: string) => void
}

function SortableLessonRow({ lesson, onEditLesson, onDeleteLesson }: SortableLessonRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: lesson.id,
  })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn("grid grid-cols-[40px_52px_minmax(0,1fr)_84px] items-center gap-2 px-3 py-2.5 hover:bg-slate-50")}
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none p-1 text-slate-400 hover:text-slate-600 active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4" />
      </div>

      <div className="font-mono text-xs font-semibold text-slate-500">#{lesson.order}</div>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="truncate text-sm font-medium text-slate-900">{lesson.name}</h4>
          {(lesson.is_required ?? true) ? (
            <Badge
              variant="secondary"
              className="rounded-sm border-0 bg-indigo-100 px-1.5 py-0 text-[10px] font-medium text-indigo-700"
            >
              Required
            </Badge>
          ) : null}
          {lesson.syllabus_stage ? (
            <Badge
              variant="outline"
              className="rounded-sm border-slate-200 bg-white px-1.5 py-0 text-[10px] font-normal text-slate-600"
            >
              {titleCaseStage(lesson.syllabus_stage)}
            </Badge>
          ) : null}
          {!lesson.is_active ? (
            <Badge
              variant="outline"
              className="rounded-sm border-orange-200 bg-orange-50 px-1.5 py-0 text-[10px] font-normal text-orange-600"
            >
              Inactive
            </Badge>
          ) : null}
        </div>
        {lesson.description ? (
          <p className="mt-0.5 truncate text-xs text-slate-500">{lesson.description}</p>
        ) : (
          <p className="mt-0.5 truncate text-xs text-slate-400">No description</p>
        )}
      </div>

      <div className="flex justify-end gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onEditLesson(lesson)}
          className="h-8 w-8 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          title="Edit lesson"
        >
          <Edit className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onDeleteLesson(lesson.id)}
          className="h-8 w-8 text-orange-600 hover:bg-orange-50 hover:text-orange-700"
          title="Delete lesson"
        >
          <Archive className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

function LessonsListHeader() {
  return (
    <div className="grid grid-cols-[40px_52px_minmax(0,1fr)_84px] items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
      <span />
      <span>Order</span>
      <span>Lesson</span>
      <span className="text-right">Actions</span>
    </div>
  )
}

export function LessonsSortableList({
  lessons,
  activeLesson,
  onEditLesson,
  onDeleteLesson,
}: LessonsSortableListProps) {
  return (
    <>
      <p className="mb-3 text-xs text-slate-500">
        Drag lessons to reorder. Changes save automatically after 8 seconds (or undo from the toast).
      </p>

      <div className="overflow-hidden rounded-lg border border-slate-200">
        <LessonsListHeader />
        <SortableContext items={lessons.map((lesson) => lesson.id)} strategy={verticalListSortingStrategy}>
          <div className="max-h-[580px] divide-y divide-slate-200 overflow-y-auto">
            {lessons.map((lesson) => (
              <SortableLessonRow
                key={lesson.id}
                lesson={lesson}
                onEditLesson={onEditLesson}
                onDeleteLesson={onDeleteLesson}
              />
            ))}
          </div>
        </SortableContext>
      </div>

      <DragOverlay dropAnimation={null}>
        {activeLesson ? (
          <div className="grid w-[min(900px,92vw)] cursor-grabbing grid-cols-[40px_52px_minmax(0,1fr)_84px] items-center gap-2 rounded-lg border border-indigo-300 bg-white px-3 py-2.5 shadow-xl">
            <div className="p-1 text-slate-400">
              <GripVertical className="h-4 w-4" />
            </div>
            <div className="font-mono text-xs font-semibold text-slate-500">#{activeLesson.order}</div>
            <div className="min-w-0">
              <h4 className="truncate text-sm font-medium text-slate-900">{activeLesson.name}</h4>
            </div>
            <div />
          </div>
        ) : null}
      </DragOverlay>
    </>
  )
}
