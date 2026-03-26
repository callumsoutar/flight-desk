"use client"

import * as React from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Edit, Plus } from "lucide-react"
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

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent className="max-w-xl p-0">
        <DialogHeader className="border-b px-5 py-4 text-left">
          <DialogTitle className="flex items-center gap-2 text-base">
            {isEditing ? <Edit className="h-4 w-4 text-slate-500" /> : <Plus className="h-4 w-4 text-slate-500" />}
            {isEditing ? "Edit lesson" : "Add lesson"}
          </DialogTitle>
          <DialogDescription>
            {isEditing ? "Update lesson details." : "Create a lesson for this training program."}
          </DialogDescription>
        </DialogHeader>

        <form id="lesson-form" onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
          <div className="space-y-1.5">
            <Label htmlFor="lesson-name">Lesson name</Label>
            <Input
              id="lesson-name"
              value={formValues.name}
              onChange={(e) => updateField("name", e.target.value)}
              placeholder="e.g., Circuit training - touch and go"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="lesson-description">Description</Label>
            <Textarea
              id="lesson-description"
              value={formValues.description}
              onChange={(e) => updateField("description", e.target.value)}
              placeholder="Optional lesson objectives"
              rows={4}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Syllabus stage</Label>
              <Select
                value={formValues.syllabusStage}
                onValueChange={(value) => updateField("syllabusStage", value as SyllabusStage | "none")}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select stage" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {SYLLABUS_STAGES.map((stage) => (
                    <SelectItem key={stage} value={stage}>
                      {titleCaseStage(stage)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between rounded-md border px-3 py-2">
              <div>
                <Label htmlFor="required">Required lesson</Label>
                <p className="text-xs text-slate-500">Students must complete this lesson.</p>
              </div>
              <Switch
                checked={formValues.isRequired}
                onCheckedChange={(checked) => updateField("isRequired", checked)}
                id="required"
              />
            </div>
          </div>
        </form>

        <div className="flex justify-end gap-2 border-t px-5 py-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="lesson-form" disabled={mutation.isPending || !formValues.name.trim()}>
            {mutation.isPending
              ? `${isEditing ? "Updating" : "Creating"}...`
              : isEditing
                ? "Save changes"
                : "Create lesson"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
