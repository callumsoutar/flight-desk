"use client"

import * as React from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { IconBook, IconLoader2, IconPencil } from "@tabler/icons-react"
import { toast } from "sonner"

import { createLesson, lessonsQueryKey, updateLesson } from "@/hooks/use-lessons-query"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { SYLLABUS_STAGES, type Lesson, type LessonInsert, type LessonUpdate, type SyllabusStage } from "@/lib/types/lessons"
import { cn } from "@/lib/utils"

import { titleCaseStage } from "./lessons-api"

type LessonModalProps = {
  isOpen: boolean
  onClose: () => void
  syllabusId: string
  lesson: Lesson | null
}

export function LessonModal({ isOpen, onClose, syllabusId, lesson }: LessonModalProps) {
  const queryClient = useQueryClient()
  const isEditing = Boolean(lesson)

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
    const normalizedStage = (lesson?.syllabus_stage ?? "none") as SyllabusStage | "none"
    setFormValues({
      name: lesson?.name ?? "",
      description: lesson?.description ?? "",
      isRequired: lesson?.is_required ?? true,
      syllabusStage: normalizedStage,
    })
  }, [isOpen, lesson])

  const mutation = useMutation({
    mutationFn: async (data: LessonInsert | (LessonUpdate & { id: string })) => {
      if (isEditing) {
        await updateLesson({ ...(data as LessonUpdate), id: lesson!.id })
      } else {
        await createLesson(data as LessonInsert)
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: lessonsQueryKey({ syllabusId, includeInactive: true }),
      })
      toast.success(`Lesson ${isEditing ? "updated" : "created"} successfully`)
      onClose()
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })

  const updateField = <K extends keyof typeof formValues>(field: K, value: (typeof formValues)[K]) => {
    setFormValues((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = () => {
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

  const canSave = Boolean(formValues.name.trim()) && !mutation.isPending

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
          "w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] sm:w-full sm:max-w-[540px]",
          "top-[calc(env(safe-area-inset-top)+1rem)] sm:top-[50%] translate-y-0 sm:translate-y-[-50%]",
          "h-[calc(100dvh-2rem)] sm:flex sm:flex-col sm:h-auto sm:max-h-[calc(100dvh-4rem)]"
        )}
      >
        <div className="flex flex-col flex-1 min-h-0 bg-white">
          <DialogHeader className="px-6 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-4 text-left sm:pt-6 shrink-0">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
                {isEditing ? <IconPencil className="h-5 w-5" /> : <IconBook className="h-5 w-5" />}
              </div>
              <div>
                <DialogTitle className="text-xl font-bold tracking-tight text-slate-900">
                  {isEditing ? "Edit Lesson" : "Add Lesson"}
                </DialogTitle>
                <DialogDescription className="mt-0.5 text-sm text-slate-500">
                  {isEditing ? "Update lesson details." : "Create a lesson for this training program."} Required fields are marked with <span className="text-destructive">*</span>.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-6 pb-6">
            <div className="space-y-5">
              <div>
                <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Lesson Name <span className="text-destructive">*</span>
                </label>
                <Input
                  value={formValues.name}
                  onChange={(e) => updateField("name", e.target.value)}
                  placeholder="e.g., Circuit training - touch and go"
                  className="h-11 rounded-xl border-slate-200 bg-white px-3 text-[15px] shadow-none transition-colors focus-visible:ring-0"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Description
                </label>
                <Textarea
                  value={formValues.description}
                  onChange={(e) => updateField("description", e.target.value)}
                  placeholder="Optional lesson objectives and notes."
                  rows={4}
                  className="rounded-xl border-slate-200 bg-white px-3 py-2 text-[15px] shadow-none transition-colors focus-visible:ring-0"
                />
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    Syllabus Stage
                  </label>
                  <Select
                    value={formValues.syllabusStage}
                    onValueChange={(value) => updateField("syllabusStage", value as SyllabusStage | "none")}
                  >
                    <SelectTrigger className="h-11 w-full rounded-xl border-slate-200 bg-white shadow-none focus:ring-0">
                      <SelectValue placeholder="Select stage" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="none">None</SelectItem>
                      {SYLLABUS_STAGES.map((stage) => (
                        <SelectItem key={stage} value={stage}>
                          {titleCaseStage(stage)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Label className="text-sm font-semibold text-slate-900 leading-none">Required lesson</Label>
                    <p className="mt-1 text-xs text-slate-600 leading-snug">
                      Students must complete this lesson.
                    </p>
                  </div>
                  <Switch
                    checked={formValues.isRequired}
                    onCheckedChange={(checked) => updateField("isRequired", checked)}
                    disabled={mutation.isPending}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="shrink-0 border-t bg-white px-6 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-[0_-4px_12px_rgba(0,0,0,0.05)] sm:pb-4">
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
                onClick={handleSubmit}
                disabled={!canSave}
                className="h-10 flex-[1.4] rounded-xl bg-slate-900 text-xs font-bold text-white shadow-lg shadow-slate-900/10 hover:bg-slate-800"
              >
                {mutation.isPending ? <IconLoader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
                {isEditing ? "Save Changes" : "Create Lesson"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
