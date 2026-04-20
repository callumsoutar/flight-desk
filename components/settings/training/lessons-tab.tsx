"use client"

import * as React from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  type DragEndEvent,
  type DragStartEvent,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import { restrictToVerticalAxis } from "@dnd-kit/modifiers"
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable"
import { toast } from "sonner"

import {
  deactivateLesson,
  lessonsQueryKey,
  reorderLessons,
  useLessonsQuery,
} from "@/hooks/use-lessons-query"
import { useSyllabiQuery } from "@/hooks/use-syllabi-query"
import type { Lesson } from "@/lib/types/lessons"

import { LessonModal } from "@/components/settings/training/lessons/lesson-modal"
import { LessonsEmptyState } from "@/components/settings/training/lessons/lessons-empty-state"
import { LessonsSortableList } from "@/components/settings/training/lessons/lessons-sortable-list"
import { LessonsToolbar } from "@/components/settings/training/lessons/lessons-toolbar"

export function LessonsTab() {
  const [selectedSyllabus, setSelectedSyllabus] = React.useState<string | null>(null)
  const [lessonModalOpen, setLessonModalOpen] = React.useState(false)
  const [editingLesson, setEditingLesson] = React.useState<Lesson | null>(null)
  const [activeLesson, setActiveLesson] = React.useState<Lesson | null>(null)

  const queryClient = useQueryClient()
  const pendingReorderRef = React.useRef<{
    syllabusId: string
    lessonOrders: { id: string; order: number }[]
    previousLessons: Lesson[]
    timeoutId: number
  } | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8, delay: 100, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const { data: syllabi = [], isLoading: syllabusLoading } = useSyllabiQuery({ includeInactive: true })
  const { data: lessons = [], isLoading: lessonsLoading } = useLessonsQuery({
    syllabusId: selectedSyllabus,
    includeInactive: true,
  })

  React.useEffect(() => {
    if (syllabusLoading) return

    if (syllabi.length === 0) {
      setSelectedSyllabus(null)
      return
    }

    if (selectedSyllabus && syllabi.some((syllabus) => syllabus.id === selectedSyllabus)) return
    const preferredSyllabus = syllabi.find((syllabus) => syllabus.is_active) ?? syllabi[0]
    setSelectedSyllabus(preferredSyllabus.id)
  }, [selectedSyllabus, syllabusLoading, syllabi])

  const deleteLessonMutation = useMutation({
    mutationFn: (id: string) => deactivateLesson(id),
    onSuccess: () => {
      if (!selectedSyllabus) return
      void queryClient.invalidateQueries({
        queryKey: lessonsQueryKey({ syllabusId: selectedSyllabus, includeInactive: true }),
      })
      toast.success("Lesson deleted successfully")
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to delete lesson")
    },
  })

  const reorderMutation = useMutation({
    mutationFn: async ({
      syllabusId,
      lessonOrders,
    }: {
      syllabusId: string
      lessonOrders: { id: string; order: number }[]
    }) => {
      await reorderLessons({
        syllabus_id: syllabusId,
        lesson_orders: lessonOrders,
      })
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: lessonsQueryKey({ syllabusId: variables.syllabusId, includeInactive: true }),
      })
      if (pendingReorderRef.current?.syllabusId === variables.syllabusId) {
        window.clearTimeout(pendingReorderRef.current.timeoutId)
        pendingReorderRef.current = null
      }
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to save lesson order")
      if (pendingReorderRef.current) {
        window.clearTimeout(pendingReorderRef.current.timeoutId)
        pendingReorderRef.current = null
      }
    },
  })

  const handleDragStart = (event: DragStartEvent) => {
    const draggedLesson = lessons.find((l) => l.id === event.active.id)
    setActiveLesson(draggedLesson || null)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveLesson(null)

    const { active, over } = event
    if (!over || !selectedSyllabus || active.id === over.id) return

    const oldIndex = lessons.findIndex((l) => l.id === active.id)
    const newIndex = lessons.findIndex((l) => l.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const previousLessons = lessons
    const reorderedItems = arrayMove(lessons, oldIndex, newIndex)
    const lessonOrders = reorderedItems.map((lesson, index) => ({ id: lesson.id, order: index + 1 }))
    const updatedLessons = reorderedItems.map((lesson, index) => ({ ...lesson, order: index + 1 }))
    const currentLessonsQueryKey = lessonsQueryKey({ syllabusId: selectedSyllabus, includeInactive: true })

    queryClient.setQueryData(currentLessonsQueryKey, updatedLessons)

    if (pendingReorderRef.current) {
      window.clearTimeout(pendingReorderRef.current.timeoutId)
      pendingReorderRef.current = null
    }

    const toastId = toast.success("Lesson order updated", {
      description: "Click undo to revert changes",
      action: {
        label: "Undo",
        onClick: () => {
          queryClient.setQueryData(currentLessonsQueryKey, previousLessons)
          if (pendingReorderRef.current) {
            window.clearTimeout(pendingReorderRef.current.timeoutId)
            pendingReorderRef.current = null
          }
          toast.dismiss(toastId)
          toast.success("Changes reverted")
        },
      },
      duration: 8000,
    })

    const timeoutId = window.setTimeout(() => {
      const pending = pendingReorderRef.current
      if (!pending || pending.syllabusId !== selectedSyllabus) return
      reorderMutation.mutate({ syllabusId: pending.syllabusId, lessonOrders: pending.lessonOrders })
    }, 8000)

    pendingReorderRef.current = {
      syllabusId: selectedSyllabus,
      lessonOrders,
      previousLessons,
      timeoutId,
    }
  }

  const selectedSyllabusData = syllabi.find((s) => s.id === selectedSyllabus)
  const hasNoSyllabi = syllabi.length === 0
  const noSelectedSyllabus = !selectedSyllabus

  return (
    <div className="w-full min-w-0 space-y-4">
      <LessonsToolbar
        selectedSyllabus={selectedSyllabus}
        syllabi={syllabi}
        syllabusLoading={syllabusLoading}
        hasLessons={lessons.length > 0}
        onSelectSyllabus={setSelectedSyllabus}
        onAddLesson={() => {
          setEditingLesson(null)
          setLessonModalOpen(true)
        }}
      />

      {hasNoSyllabi ? (
        <LessonsEmptyState variant="no-programs" />
      ) : noSelectedSyllabus ? (
        <LessonsEmptyState variant="no-syllabus" />
      ) : lessonsLoading ? (
        <div className="py-20 text-center text-xs text-slate-400">Loading lessons...</div>
      ) : lessons.length === 0 ? (
        <LessonsEmptyState
          variant="no-lessons"
          syllabusName={selectedSyllabusData?.name}
          onAddLesson={() => {
            setEditingLesson(null)
            setLessonModalOpen(true)
          }}
        />
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          modifiers={[restrictToVerticalAxis]}
        >
          <LessonsSortableList
            lessons={lessons}
            activeLesson={activeLesson}
            onEditLesson={(lesson) => {
              setEditingLesson(lesson)
              setLessonModalOpen(true)
            }}
            onDeleteLesson={(id) => {
              const confirmed = window.confirm(
                "Delete this lesson? Existing student records will not be changed."
              )
              if (!confirmed) return
              deleteLessonMutation.mutate(id)
            }}
          />
        </DndContext>
      )}

      {selectedSyllabus ? (
        <LessonModal
          isOpen={lessonModalOpen}
          onClose={() => {
            setLessonModalOpen(false)
            setEditingLesson(null)
          }}
          syllabusId={selectedSyllabus}
          lesson={editingLesson}
        />
      ) : null}
    </div>
  )
}
