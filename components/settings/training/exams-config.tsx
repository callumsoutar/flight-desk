"use client"

import { useMemo, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import {
  AlertCircle,
  Archive,
  Edit,
  Filter,
  FileText,
  Plus,
  Search,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { createExam, deactivateExam, examsQueryKey, updateExam, useExamsQuery } from "@/hooks/use-exams-query"
import { useSyllabiQuery } from "@/hooks/use-syllabi-query"
import { cn } from "@/lib/utils"
import type { Exam, ExamFormData } from "@/lib/types/exam"

export function ExamsConfig() {
  const queryClient = useQueryClient()
  const [mutationError, setMutationError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedSyllabusFilter, setSelectedSyllabusFilter] = useState("all")
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingExam, setEditingExam] = useState<Exam | null>(null)
  const {
    data: exams = [],
    isLoading,
    error: examsQueryError,
  } = useExamsQuery({ includeInactive: true })
  const { data: syllabi = [] } = useSyllabiQuery({ includeInactive: true })
  const [formData, setFormData] = useState<ExamFormData>({
    name: "",
    description: "",
    syllabus_id: "none",
    passing_score: 70,
    is_active: true,
  })

  const error = mutationError ?? (examsQueryError instanceof Error ? examsQueryError.message : null)

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      syllabus_id: "none",
      passing_score: 70,
      is_active: true,
    })
  }

  const handleAdd = async () => {
    try {
      setMutationError(null)
      await createExam({
        name: formData.name,
        description: formData.description,
        passing_score: formData.passing_score,
        is_active: formData.is_active,
        syllabus_id: formData.syllabus_id === "none" ? null : formData.syllabus_id,
      })

      await queryClient.invalidateQueries({
        queryKey: examsQueryKey({ includeInactive: true }),
      })
      setIsAddDialogOpen(false)
      resetForm()
    } catch (err) {
      setMutationError(err instanceof Error ? err.message : "An error occurred")
    }
  }

  const handleEdit = async () => {
    if (!editingExam) return

    try {
      setMutationError(null)
      await updateExam({
        id: editingExam.id,
        name: formData.name,
        description: formData.description,
        passing_score: formData.passing_score,
        is_active: formData.is_active,
        syllabus_id: formData.syllabus_id === "none" ? null : formData.syllabus_id,
      })

      await queryClient.invalidateQueries({
        queryKey: examsQueryKey({ includeInactive: true }),
      })
      setIsEditDialogOpen(false)
      setEditingExam(null)
      resetForm()
    } catch (err) {
      setMutationError(err instanceof Error ? err.message : "An error occurred")
    }
  }

  const handleDelete = async (id: string) => {
    if (
      !confirm(
        "Are you sure you want to deactivate this exam? This will make it unavailable for new entries."
      )
    ) {
      return
    }

    try {
      setMutationError(null)
      await deactivateExam(id)

      await queryClient.invalidateQueries({
        queryKey: examsQueryKey({ includeInactive: true }),
      })
    } catch (err) {
      setMutationError(err instanceof Error ? err.message : "An error occurred")
    }
  }

  const openEditDialog = (exam: Exam) => {
    setEditingExam(exam)
    setFormData({
      name: exam.name,
      description: exam.description || "",
      syllabus_id: exam.syllabus_id || "none",
      passing_score: Math.round(exam.passing_score),
      is_active: exam.is_active,
    })
    setIsEditDialogOpen(true)
  }

  const getSyllabusName = (syllabusId: string) => {
    const syllabus = syllabi.find((s) => s.id === syllabusId)
    return syllabus ? syllabus.name : "Independent"
  }

  const filteredExams = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()

    return exams.filter((exam) => {
      const matchesSyllabus =
        selectedSyllabusFilter === "all"
          ? true
          : selectedSyllabusFilter === "none"
            ? !exam.syllabus_id
            : exam.syllabus_id === selectedSyllabusFilter

      if (!matchesSyllabus) return false
      if (!term) return true

      return (
        exam.name.toLowerCase().includes(term) || (exam.description || "").toLowerCase().includes(term)
      )
    })
  }, [exams, searchTerm, selectedSyllabusFilter])

  if (isLoading) {
    return (
      <div className="space-y-6 w-full min-w-0">
        <div className="flex items-center justify-center py-12">
          <div className="text-slate-500">Loading exams...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 w-full min-w-0">
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
        <FileText className="w-5 h-5 text-indigo-600" />
        <h3 className="text-lg font-semibold text-slate-900">Exams</h3>
      </div>

      <p className="text-sm text-slate-600">
        Configure theoretical exams, assessments, and passing requirements.
      </p>

      {error ? (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 text-red-700">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      ) : null}

      <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-3 sm:flex-row sm:items-end">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
          <Input
            placeholder="Search exams..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-10 rounded-xl border-slate-200 bg-white pl-10 shadow-none transition-all focus-visible:border-indigo-500 focus-visible:ring-indigo-500/20"
          />
        </div>

        <div className="w-full sm:w-[260px]">
          <Label className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            <Filter className="h-3.5 w-3.5" />
            Syllabus
          </Label>
          <Select value={selectedSyllabusFilter} onValueChange={setSelectedSyllabusFilter}>
            <SelectTrigger className="h-10 rounded-xl border-slate-200 bg-white text-sm font-medium shadow-none">
              <SelectValue placeholder="All syllabi" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All syllabi</SelectItem>
              <SelectItem value="none">Independent exams</SelectItem>
              {syllabi.map((syllabus) => (
                <SelectItem key={syllabus.id} value={syllabus.id}>
                  {syllabus.name}
                  {!syllabus.is_active ? " (inactive)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Dialog
          open={isAddDialogOpen}
          onOpenChange={(open) => {
            setIsAddDialogOpen(open)
            if (!open) resetForm()
          }}
        >
          <DialogTrigger asChild>
            <Button
              onClick={resetForm}
              className="h-10 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm shadow-indigo-100 transition-all active:scale-[0.98] whitespace-nowrap font-semibold border-none"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Add New
            </Button>
          </DialogTrigger>
          <DialogContent
            className={cn(
              "p-0 border-none shadow-2xl rounded-[24px] overflow-hidden",
              "w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] sm:w-full sm:max-w-[540px]",
              "top-[calc(env(safe-area-inset-top)+1rem)] sm:top-[50%] translate-y-0 sm:translate-y-[-50%]",
              "h-[calc(100dvh-2rem)] sm:h-auto sm:max-h-[calc(100dvh-4rem)]"
            )}
          >
            <div className="flex h-full min-h-0 flex-col bg-white">
              <DialogHeader className="px-6 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-4 text-left sm:pt-6">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <DialogTitle className="text-xl font-bold tracking-tight text-slate-900">
                      Add New Exam
                    </DialogTitle>
                    <DialogDescription className="mt-0.5 text-sm text-slate-500">
                      Create a new theoretical exam or assessment. Required fields are marked with{" "}
                      <span className="text-destructive">*</span>.
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-6 pb-6">
                <div className="space-y-6">
                  <section>
                    <div className="mb-3 flex items-center gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                      <span className="text-xs font-semibold tracking-tight text-slate-900">Exam Details</span>
                    </div>

                    <div className="grid gap-5">
                      <div>
                        <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                          NAME <span className="text-destructive">*</span>
                        </label>
                        <Input
                          id="name"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          placeholder="e.g., PPL Law Exam"
                          className="h-10 rounded-xl border-slate-200 bg-white px-3 text-base font-medium shadow-none hover:bg-slate-50 focus-visible:ring-0"
                        />
                      </div>

                      <div>
                        <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                          DESCRIPTION
                        </label>
                        <Textarea
                          id="description"
                          value={formData.description}
                          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                          placeholder="Enter a brief description"
                          rows={3}
                          className="rounded-xl border-slate-200 bg-white px-3 py-2 text-base font-medium shadow-none hover:bg-slate-50 focus-visible:ring-0"
                        />
                      </div>

                      <div>
                        <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                          SYLLABUS (OPTIONAL)
                        </label>
                        <Select
                          value={formData.syllabus_id}
                          onValueChange={(value) => setFormData({ ...formData, syllabus_id: value })}
                        >
                          <SelectTrigger className="h-10 rounded-xl border-slate-200 bg-white px-3 text-base font-medium shadow-none hover:bg-slate-50 focus-visible:ring-0">
                            <SelectValue placeholder="Select a syllabus" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No Syllabus</SelectItem>
                            {syllabi.map((syllabus) => (
                              <SelectItem key={syllabus.id} value={syllabus.id}>
                                {syllabus.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid gap-5 sm:grid-cols-2">
                        <div>
                          <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                            PASSING SCORE (%)
                          </label>
                          <Input
                            id="passing_score"
                            type="number"
                            min="0"
                            max="100"
                            value={formData.passing_score}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                passing_score: Math.max(0, Math.min(100, parseInt(e.target.value, 10) || 0)),
                              })
                            }
                            className="h-10 rounded-xl border-slate-200 bg-white px-3 text-base font-medium shadow-none hover:bg-slate-50 focus-visible:ring-0"
                          />
                        </div>

                        <div className="flex items-center h-full pt-5">
                          <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3 w-full">
                            <Switch
                              id="is_active"
                              checked={formData.is_active}
                              onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                            />
                            <div className="min-w-0">
                              <Label
                                htmlFor="is_active"
                                className="text-xs font-semibold text-slate-900 leading-none cursor-pointer"
                              >
                                Active
                              </Label>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </section>
                </div>
              </div>

              <div className="border-t bg-white px-6 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-[0_-4px_12px_rgba(0,0,0,0.05)] sm:pb-4">
                <div className="flex items-center justify-between gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsAddDialogOpen(false)}
                    className="h-10 flex-1 rounded-xl border-slate-200 text-xs font-bold shadow-none hover:bg-slate-50"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleAdd}
                    disabled={!formData.name.trim()}
                    className="h-10 flex-[1.4] rounded-xl bg-slate-900 text-xs font-bold text-white shadow-lg shadow-slate-900/10 hover:bg-slate-800"
                  >
                    Create Exam
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {filteredExams.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 py-16 text-center">
          <FileText className="w-12 h-12 mx-auto mb-4 text-slate-400" />
          <p className="mb-2 font-semibold text-slate-900">
            {exams.length === 0 ? "No exams configured" : "No exams match this view"}
          </p>
          <p className="mb-4 text-sm text-slate-500">
            {exams.length === 0
              ? 'Click "Add New" to get started.'
              : "Try a different search term or syllabus filter."}
          </p>
        </div>
      ) : (
        <div className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="min-w-0 w-full overflow-x-auto">
            <Table className="table-fixed w-full">
              <TableHeader>
                <TableRow className="border-t bg-slate-50 hover:bg-slate-50">
                  <TableHead className="pl-6 font-semibold text-slate-700">Exam</TableHead>
                  <TableHead className="font-semibold text-slate-700 whitespace-nowrap">Syllabus</TableHead>
                  <TableHead className="text-center font-semibold text-slate-700 whitespace-nowrap">Pass Mark</TableHead>
                  <TableHead className="font-semibold text-slate-700 whitespace-nowrap">Status</TableHead>
                  <TableHead className="pr-6 text-right font-semibold text-slate-700 whitespace-nowrap">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredExams.map((exam) => (
                  <TableRow key={exam.id} className="hover:bg-slate-50">
                    <TableCell className="min-w-0 whitespace-normal py-4 pl-6 align-top font-medium text-slate-900">
                      <div>
                        <div>{exam.name}</div>
                        {exam.description ? (
                          <div className="mt-0.5 line-clamp-1 text-xs text-slate-500">{exam.description}</div>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-600">
                      <span className="inline-flex items-center rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700">
                        {exam.syllabus_id ? getSyllabusName(exam.syllabus_id) : "Independent"}
                      </span>
                    </TableCell>
                    <TableCell className="text-center text-slate-600">
                      <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                        {Math.round(exam.passing_score)}%
                      </span>
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-semibold",
                          exam.is_active
                            ? "bg-green-50 text-green-700 border-green-200"
                            : "bg-slate-100 text-slate-600 border-slate-200"
                        )}
                      >
                        {exam.is_active ? "Active" : "Inactive"}
                      </span>
                    </TableCell>
                    <TableCell className="pr-6 text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditDialog(exam)}
                          className="hover:bg-slate-50"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        {exam.is_active ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              void handleDelete(exam.id)
                            }}
                            className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                            title="Deactivate exam"
                          >
                            <Archive className="w-4 h-4" />
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      <Dialog
        open={isEditDialogOpen}
        onOpenChange={(open) => {
          setIsEditDialogOpen(open)
          if (!open) {
            setEditingExam(null)
            resetForm()
          }
        }}
      >
        <DialogContent
          className={cn(
            "p-0 border-none shadow-2xl rounded-[24px] overflow-hidden",
            "w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] sm:w-full sm:max-w-[540px]",
            "top-[calc(env(safe-area-inset-top)+1rem)] sm:top-[50%] translate-y-0 sm:translate-y-[-50%]",
            "h-[calc(100dvh-2rem)] sm:h-auto sm:max-h-[calc(100dvh-4rem)]"
          )}
        >
          <div className="flex h-full min-h-0 flex-col bg-white">
            <DialogHeader className="px-6 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-4 text-left sm:pt-6">
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
                  <Edit className="h-5 w-5" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-bold tracking-tight text-slate-900">
                    Edit Exam
                  </DialogTitle>
                  <DialogDescription className="mt-0.5 text-sm text-slate-500">
                    Update exam details. Required fields are marked with{" "}
                    <span className="text-destructive">*</span>.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-6 pb-6">
              <div className="space-y-6">
                <section>
                  <div className="mb-3 flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                    <span className="text-xs font-semibold tracking-tight text-slate-900">Exam Details</span>
                  </div>

                  <div className="grid gap-5">
                    <div>
                      <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                        NAME <span className="text-destructive">*</span>
                      </label>
                      <Input
                        id="edit-name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="e.g., PPL Law Exam"
                        className="h-10 rounded-xl border-slate-200 bg-white px-3 text-base font-medium shadow-none hover:bg-slate-50 focus-visible:ring-0"
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                        DESCRIPTION
                      </label>
                      <Textarea
                        id="edit-description"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder="Enter a brief description"
                        rows={3}
                        className="rounded-xl border-slate-200 bg-white px-3 py-2 text-base font-medium shadow-none hover:bg-slate-50 focus-visible:ring-0"
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                        SYLLABUS (OPTIONAL)
                      </label>
                      <Select
                        value={formData.syllabus_id}
                        onValueChange={(value) => setFormData({ ...formData, syllabus_id: value })}
                      >
                        <SelectTrigger className="h-10 rounded-xl border-slate-200 bg-white px-3 text-base font-medium shadow-none hover:bg-slate-50 focus-visible:ring-0">
                          <SelectValue placeholder="Select a syllabus" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No Syllabus</SelectItem>
                          {syllabi.map((syllabus) => (
                            <SelectItem key={syllabus.id} value={syllabus.id}>
                              {syllabus.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid gap-5 sm:grid-cols-2">
                      <div>
                        <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                          PASSING SCORE (%)
                        </label>
                        <Input
                          id="edit-passing_score"
                          type="number"
                          min="0"
                          max="100"
                          value={formData.passing_score}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              passing_score: Math.max(0, Math.min(100, parseInt(e.target.value, 10) || 0)),
                            })
                          }
                          className="h-10 rounded-xl border-slate-200 bg-white px-3 text-base font-medium shadow-none hover:bg-slate-50 focus-visible:ring-0"
                        />
                      </div>

                      <div className="flex items-center h-full pt-5">
                        <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3 w-full">
                          <Switch
                            id="edit-is_active"
                            checked={formData.is_active}
                            onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                          />
                          <div className="min-w-0">
                            <Label
                              htmlFor="edit-is_active"
                              className="text-xs font-semibold text-slate-900 leading-none cursor-pointer"
                            >
                              Active
                            </Label>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            </div>

            <div className="border-t bg-white px-6 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-[0_-4px_12px_rgba(0,0,0,0.05)] sm:pb-4">
              <div className="flex items-center justify-between gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsEditDialogOpen(false)
                    setEditingExam(null)
                    resetForm()
                  }}
                  className="h-10 flex-1 rounded-xl border-slate-200 text-xs font-bold shadow-none hover:bg-slate-50"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleEdit}
                  disabled={!formData.name.trim()}
                  className="h-10 flex-[1.4] rounded-xl bg-slate-900 text-xs font-bold text-white shadow-lg shadow-slate-900/10 hover:bg-slate-800"
                >
                  Update Exam
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
