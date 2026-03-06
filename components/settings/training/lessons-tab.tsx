"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  Archive,
  BookOpen,
  ChevronRight,
  Edit,
  GraduationCap,
  GripVertical,
  HelpCircle,
  Plus,
} from "lucide-react"
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  type DragEndEvent,
  type DragStartEvent,
  pointerWithin,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import { restrictToVerticalAxis } from "@dnd-kit/modifiers"
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import type { Syllabus } from "@/lib/types/syllabus"
import type { Lesson, LessonInsert, LessonUpdate, SyllabusStage } from "@/lib/types/lessons"

const fetchSyllabi = async (): Promise<Syllabus[]> => {
  const response = await fetch("/api/syllabus?include_inactive=true")
  if (!response.ok) throw new Error("Failed to fetch syllabi")
  const data = (await response.json().catch(() => null)) as { syllabi?: Syllabus[] } | null
  return Array.isArray(data?.syllabi) ? data.syllabi : []
}

const fetchLessons = async (syllabusId: string): Promise<Lesson[]> => {
  const response = await fetch(`/api/lessons?include_inactive=true&syllabus_id=${encodeURIComponent(syllabusId)}`)
  if (!response.ok) throw new Error("Failed to fetch lessons")
  const data = (await response.json().catch(() => null)) as { lessons?: Lesson[] } | null
  return Array.isArray(data?.lessons) ? data.lessons : []
}

function titleCaseStage(stage: SyllabusStage) {
  return stage.charAt(0).toUpperCase() + stage.slice(1)
}

function SortableLessonItem({
  lesson,
  onEdit,
  onDelete,
}: {
  lesson: Lesson
  onEdit: (lesson: Lesson) => void
  onDelete: (id: string) => void
}) {
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
      className={cn(
        "group flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl transition-colors duration-200",
        "hover:border-slate-300 hover:shadow-sm"
      )}
    >
      <div
        {...attributes}
        {...listeners}
        className="text-slate-400 hover:text-slate-600 cursor-grab active:cursor-grabbing p-1 touch-none"
      >
        <GripVertical className="w-4 h-4" />
      </div>

      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-[10px] font-bold text-slate-500 font-mono">
          #{lesson.order}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-semibold text-sm text-slate-900 truncate">{lesson.name}</h4>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {(lesson.is_required ?? true) ? (
                <Badge
                  variant="default"
                  className="text-[10px] px-1.5 py-0 bg-indigo-100 text-indigo-700 border-indigo-200 shadow-none hover:bg-indigo-100"
                >
                  Required
                </Badge>
              ) : null}
              {lesson.syllabus_stage ? (
                <Badge
                  variant="outline"
                  className="text-[10px] px-1.5 py-0 border-slate-200 text-slate-600 font-medium bg-slate-50"
                >
                  {lesson.syllabus_stage}
                </Badge>
              ) : null}
              {!lesson.is_active ? (
                <Badge
                  variant="outline"
                  className="text-[10px] px-1.5 py-0 border-orange-200 text-orange-600 font-medium bg-orange-50"
                >
                  Inactive
                </Badge>
              ) : null}
            </div>
          </div>
          {lesson.description ? (
            <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{lesson.description}</p>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button variant="outline" size="sm" onClick={() => onEdit(lesson)} className="hover:bg-slate-50">
          <Edit className="w-4 h-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onDelete(lesson.id)}
          className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
          title="Delete lesson"
        >
          <Archive className="w-4 h-4" />
        </Button>
      </div>
    </div>
  )
}

function LessonDragOverlay({ lesson }: { lesson: Lesson }) {
  return (
    <div className="flex items-center gap-3 p-3 bg-white border-2 border-indigo-400 rounded-xl shadow-2xl ring-4 ring-indigo-100 cursor-grabbing rotate-2 scale-105">
      <div className="text-slate-400 p-1">
        <GripVertical className="w-4 h-4" />
      </div>

      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-100 text-[10px] font-bold text-indigo-700 font-mono">
          #{lesson.order}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-semibold text-sm text-slate-900 truncate">{lesson.name}</h4>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {(lesson.is_required ?? true) ? (
                <Badge variant="default" className="text-[10px] px-1.5 py-0 bg-indigo-100 text-indigo-700 border-indigo-200 shadow-none">
                  Required
                </Badge>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function LessonModal({
  isOpen,
  onClose,
  syllabusId,
  lesson,
}: {
  isOpen: boolean
  onClose: () => void
  syllabusId: string
  lesson: Lesson | null
}) {
  const queryClient = useQueryClient()
  const isEditing = Boolean(lesson)

  const syllabusStages: SyllabusStage[] = ["basic syllabus", "advances syllabus"]

  const [formValues, setFormValues] = React.useState<{
    name: string
    description: string
    isRequired: boolean
    syllabusStage: SyllabusStage | "none"
  }>({
    name: "",
    description: "",
    isRequired: true,
    syllabusStage: "none",
  })

  React.useEffect(() => {
    if (!isOpen) return
    setFormValues({
      name: lesson?.name ?? "",
      description: lesson?.description ?? "",
      isRequired: lesson?.is_required ?? true,
      syllabusStage: (lesson?.syllabus_stage ?? "none") as SyllabusStage | "none",
    })
  }, [isOpen, lesson])

  const mutation = useMutation({
    mutationFn: async (data: LessonInsert | (LessonUpdate & { id: string })) => {
      const url = "/api/lessons"
      const method = isEditing ? "PATCH" : "POST"
      const body = isEditing ? { id: lesson?.id, ...data } : data

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!response.ok) {
        const errorData = (await response.json().catch(() => null)) as { error?: string } | null
        throw new Error(errorData?.error || `Failed to ${isEditing ? "update" : "create"} lesson`)
      }
      return response.json()
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["lessons", syllabusId] })
      toast.success(`Lesson ${isEditing ? "updated" : "created"} successfully`)
      onClose()
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formValues.name.trim()) return

    const data = {
      name: formValues.name.trim(),
      description: formValues.description.trim() || null,
      is_required: formValues.isRequired,
      syllabus_stage: formValues.syllabusStage === "none" ? null : formValues.syllabusStage,
      ...(!isEditing && { syllabus_id: syllabusId }),
    }

    mutation.mutate(data as LessonInsert | (LessonUpdate & { id: string }))
  }

  const updateField = <K extends keyof typeof formValues>(field: K, value: (typeof formValues)[K]) => {
    setFormValues((prev) => ({ ...prev, [field]: value }))
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent
        className={cn(
          "p-0 border-none shadow-2xl rounded-[24px] overflow-hidden",
          "w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] sm:w-full sm:max-w-[600px]",
          "top-[calc(env(safe-area-inset-top)+1rem)] sm:top-[50%] translate-y-0 sm:translate-y-[-50%]",
          "h-[calc(100dvh-2rem)] sm:h-auto sm:max-h-[calc(100dvh-4rem)]"
        )}
      >
        <div className="flex h-full min-h-0 flex-col bg-white">
          <DialogHeader className="px-6 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-4 text-left sm:pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
                {isEditing ? <Edit className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
              </div>
              <div>
                <DialogTitle className="text-xl font-bold tracking-tight text-slate-900">
                  {isEditing ? "Edit Lesson" : "Add Lesson"}
                </DialogTitle>
                <DialogDescription className="mt-0.5 text-sm text-slate-500">
                  {isEditing ? "Update the lesson details below." : "Add a new training lesson to this syllabus."}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form
            id="lesson-form"
            onSubmit={handleSubmit}
            className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-6 pb-6"
          >
            <div className="space-y-6">
              <section>
                <div className="mb-3 flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                  <span className="text-xs font-semibold tracking-tight text-slate-900">Lesson Details</span>
                </div>

                <div className="grid gap-5">
                  <div>
                    <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                      LESSON NAME <span className="text-destructive">*</span>
                    </label>
                    <Input
                      value={formValues.name}
                      onChange={(e) => updateField("name", e.target.value)}
                      placeholder="e.g., Circuit Training - Touch and Go"
                      className="h-10 rounded-xl border-slate-200 bg-white px-3 text-base font-medium shadow-none hover:bg-slate-50 focus-visible:ring-0"
                      required
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                      DESCRIPTION
                    </label>
                    <Textarea
                      value={formValues.description}
                      onChange={(e) => updateField("description", e.target.value)}
                      placeholder="Objectives, coverage, and outcomes..."
                      rows={4}
                      className="rounded-xl border-slate-200 bg-white px-3 py-2 text-base font-medium shadow-none hover:bg-slate-50 focus-visible:ring-0"
                    />
                  </div>

                  <div className="grid gap-5 sm:grid-cols-2">
                    <div className="flex flex-col">
                      <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                        SYLLABUS STAGE
                      </label>
                      <Select
                        value={formValues.syllabusStage}
                        onValueChange={(value) =>
                          updateField("syllabusStage", value as SyllabusStage | "none")
                        }
                      >
                        <SelectTrigger className="h-10 w-full rounded-xl border-slate-200 bg-white px-3 text-base font-medium shadow-none hover:bg-slate-50 focus-visible:ring-0">
                          <SelectValue placeholder="Select a stage" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {syllabusStages.map((stage) => (
                            <SelectItem key={stage} value={stage}>
                              {titleCaseStage(stage)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex flex-col">
                      <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-wider text-slate-400 opacity-0 pointer-events-none">
                        Required
                      </label>
                      <div className="flex items-center min-h-[40px]">
                        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 w-full">
                          <Switch
                            checked={formValues.isRequired}
                            onCheckedChange={(checked) => updateField("isRequired", checked)}
                            id="required"
                            className="flex-shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <Label
                                htmlFor="required"
                                className="text-xs font-semibold text-slate-900 leading-none cursor-pointer"
                              >
                                Required
                              </Label>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger type="button">
                                    <HelpCircle className="w-3 h-3 text-slate-400" />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="text-[11px] max-w-[200px]">
                                      Required lessons must be completed before progressing.
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                            <p className="text-[10px] text-slate-500 mt-1 leading-snug">Mandatory for completion.</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </form>

          <div className="border-t bg-white px-6 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-[0_-4px_12px_rgba(0,0,0,0.05)] sm:pb-4">
            <div className="flex items-center justify-between gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="h-10 flex-1 rounded-xl border-slate-200 text-xs font-bold shadow-none hover:bg-slate-50"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                form="lesson-form"
                disabled={mutation.isPending || !formValues.name.trim()}
                className="h-10 flex-[1.4] rounded-xl bg-slate-900 text-xs font-bold text-white shadow-lg shadow-slate-900/10 hover:bg-slate-800"
              >
                {mutation.isPending
                  ? `${isEditing ? "Updating" : "Creating"}...`
                  : isEditing
                    ? "Update Lesson"
                    : "Create Lesson"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function LessonsTab() {
  const [mounted, setMounted] = React.useState(false)
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

  React.useEffect(() => {
    setMounted(true)
  }, [])

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8, delay: 100, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const { data: syllabi = [], isLoading: syllabusLoading } = useQuery({
    queryKey: ["syllabi"],
    queryFn: fetchSyllabi,
  })

  const { data: lessons = [], isLoading: lessonsLoading } = useQuery({
    queryKey: ["lessons", selectedSyllabus],
    queryFn: () => (selectedSyllabus ? fetchLessons(selectedSyllabus) : Promise.resolve([])),
    enabled: Boolean(selectedSyllabus),
  })

  const deleteLessonMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/lessons?id=${encodeURIComponent(id)}`, { method: "DELETE" })
      if (!response.ok) throw new Error("Failed to delete lesson")
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["lessons", selectedSyllabus] })
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
      const response = await fetch("/api/lessons/reorder", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ syllabus_id: syllabusId, lesson_orders: lessonOrders }),
      })
      if (!response.ok) {
        const errorData = (await response.json().catch(() => null)) as { error?: string } | null
        throw new Error(errorData?.error || "Failed to reorder lessons")
      }
      return response.json()
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["lessons", variables.syllabusId] })
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

    queryClient.setQueryData(["lessons", selectedSyllabus], updatedLessons)

    if (pendingReorderRef.current) {
      window.clearTimeout(pendingReorderRef.current.timeoutId)
      pendingReorderRef.current = null
    }

    const toastId = toast.success("Lesson order updated", {
      description: "Click undo to revert changes",
      action: {
        label: "Undo",
        onClick: () => {
          queryClient.setQueryData(["lessons", selectedSyllabus], previousLessons)
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

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
        <BookOpen className="w-5 h-5 text-indigo-600" />
        <h3 className="text-lg font-semibold text-slate-900">Lessons Management</h3>
      </div>

      <p className="text-sm text-slate-600">
        Create and manage training lessons for each syllabus. Drag and drop to reorder.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[600px]">
        <div className="lg:col-span-4 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Syllabi</h4>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {syllabusLoading ? (
              <div className="text-center py-8 text-slate-400 text-xs">Loading syllabi...</div>
            ) : syllabi.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/30">
                <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                  <GraduationCap className="w-5 h-5 text-slate-400" />
                </div>
                <h4 className="text-sm font-semibold text-slate-900 mb-1">No Syllabi Found</h4>
                <p className="text-xs text-slate-500 max-w-[200px] leading-relaxed">
                  Create a training program (syllabus) first to start adding lessons.
                </p>
              </div>
            ) : (
              syllabi.map((syllabus) => (
                <div
                  key={syllabus.id}
                  className={cn(
                    "group relative p-4 border rounded-xl cursor-pointer transition-all duration-200",
                    selectedSyllabus === syllabus.id
                      ? "border-indigo-600 bg-indigo-50/50 shadow-sm ring-1 ring-indigo-600"
                      : "border-slate-200 bg-white hover:border-indigo-300 hover:bg-slate-50"
                  )}
                  onClick={() => setSelectedSyllabus(syllabus.id)}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4
                          className={cn(
                            "font-bold text-sm truncate",
                            selectedSyllabus === syllabus.id ? "text-indigo-900" : "text-slate-900"
                          )}
                        >
                          {syllabus.name}
                        </h4>
                        {!syllabus.is_active ? (
                          <Badge
                            variant="outline"
                            className="text-[9px] h-4 px-1 py-0 border-orange-200 text-orange-600"
                          >
                            Inactive
                          </Badge>
                        ) : null}
                      </div>
                      {syllabus.description ? (
                        <p className="text-[11px] text-slate-500 mt-1 line-clamp-1">{syllabus.description}</p>
                      ) : null}
                    </div>
                    {selectedSyllabus === syllabus.id ? (
                      <ChevronRight className="w-4 h-4 text-indigo-600 shrink-0" />
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="lg:col-span-8 flex flex-col gap-4 border-l border-slate-100 pl-6">
          <div className="flex items-center justify-between min-h-[32px]">
            {selectedSyllabusData ? (
              <div className="flex items-center gap-3">
                <h4 className="text-sm font-bold text-slate-900">{selectedSyllabusData.name} Lessons</h4>
                <Badge variant="secondary" className="text-[10px] bg-slate-100 text-slate-600 border-none">
                  {lessons.length} total
                </Badge>
              </div>
            ) : (
              <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Lessons</h4>
            )}

            {selectedSyllabus ? (
              <Button
                onClick={() => {
                  setEditingLesson(null)
                  setLessonModalOpen(true)
                }}
                className="h-10 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm shadow-indigo-100 transition-all active:scale-[0.98] whitespace-nowrap font-semibold border-none"
              >
                <Plus className="w-4 h-4 mr-1.5" />
                Add Lesson
              </Button>
            ) : null}
          </div>

          <div className="flex-1">
            {!selectedSyllabus ? (
              <div className="flex flex-col items-center justify-center py-20 text-center border-2 border-dashed border-slate-200 rounded-[24px] bg-slate-50/30">
                {syllabi.length === 0 ? (
                  <>
                    <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                      <BookOpen className="w-6 h-6 text-slate-400" />
                    </div>
                    <h4 className="text-sm font-bold text-slate-900 mb-1">Create a Syllabus First</h4>
                    <p className="text-xs text-slate-500 max-w-[280px] leading-relaxed">
                      To create lessons, you&apos;ll need to add a training program (syllabus) first. Navigate
                      to the &quot;Training Programs&quot; tab to get started.
                    </p>
                  </>
                ) : (
                  <>
                    <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                      <GraduationCap className="w-6 h-6 text-slate-400" />
                    </div>
                    <h4 className="text-sm font-bold text-slate-900 mb-1">Select a Syllabus</h4>
                    <p className="text-xs text-slate-500 max-w-[240px]">
                      Choose a syllabus from the left to manage its training lessons.
                    </p>
                  </>
                )}
              </div>
            ) : lessonsLoading ? (
              <div className="text-center py-20 text-slate-400 text-xs">Loading lessons...</div>
            ) : lessons.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center border-2 border-dashed border-slate-200 rounded-[24px] bg-slate-50/30">
                <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                  <Plus className="w-6 h-6 text-slate-400" />
                </div>
                <h4 className="text-sm font-bold text-slate-900 mb-1">No Lessons Found</h4>
                <p className="text-xs text-slate-500 max-w-[240px] mb-4">
                  Add the first lesson to the {selectedSyllabusData?.name} syllabus.
                </p>
                <Button
                  onClick={() => {
                    setEditingLesson(null)
                    setLessonModalOpen(true)
                  }}
                  className="h-10 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm shadow-indigo-100 transition-all active:scale-[0.98] whitespace-nowrap font-semibold border-none"
                >
                  <Plus className="w-4 h-4 mr-1.5" />
                  Add Lesson
                </Button>
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={pointerWithin}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                modifiers={[restrictToVerticalAxis]}
              >
                <SortableContext items={lessons.map((l) => l.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2 pb-4 scroll-smooth">
                    {lessons.map((lesson) => (
                      <SortableLessonItem
                        key={lesson.id}
                        lesson={lesson}
                        onEdit={(l) => {
                          setEditingLesson(l)
                          setLessonModalOpen(true)
                        }}
                        onDelete={(id) => deleteLessonMutation.mutate(id)}
                      />
                    ))}
                  </div>
                </SortableContext>

                {mounted
                  ? createPortal(
                      <DragOverlay dropAnimation={null}>
                        {activeLesson ? <LessonDragOverlay lesson={activeLesson} /> : null}
                      </DragOverlay>,
                      document.body
                    )
                  : null}
              </DndContext>
            )}
          </div>
        </div>
      </div>

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
