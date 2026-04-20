"use client"

import * as React from "react"
import { useQueryClient } from "@tanstack/react-query"
import {
  IconBan,
  IconLoader2,
  IconPencil,
  IconPlus,
  IconSearch,
  IconTrash,
} from "@tabler/icons-react"
import { toast } from "sonner"

import {
  cancellationCategoriesQueryKey,
  createCancellationCategory,
  deleteCancellationCategory,
  updateCancellationCategory,
  useCancellationCategoriesQuery,
} from "@/hooks/use-cancellation-categories-query"
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import type { CancellationCategory } from "@/lib/types/cancellations"
import { cn } from "@/lib/utils"

type CategoryFormData = {
  name: string
  description: string
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message
  return "Something went wrong."
}

function normalizeName(value: string) {
  return value.trim().replaceAll(/\s+/g, " ")
}

function normalizeDescription(value: string) {
  return value.trim()
}

export function CancellationCategoriesConfig({ showHeader = true }: { showHeader?: boolean }) {
  const queryClient = useQueryClient()
  const [saving, setSaving] = React.useState(false)
  const [mutationError, setMutationError] = React.useState<string | null>(null)
  const [searchTerm, setSearchTerm] = React.useState("")
  const {
    data: categories = [],
    isLoading,
    error: categoriesQueryError,
  } = useCancellationCategoriesQuery()

  const [isAddDialogOpen, setIsAddDialogOpen] = React.useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false)
  const [editingCategory, setEditingCategory] = React.useState<CancellationCategory | null>(null)

  const [formData, setFormData] = React.useState<CategoryFormData>({
    name: "",
    description: "",
  })

  const error = mutationError ?? (categoriesQueryError ? getErrorMessage(categoriesQueryError) : null)

  const resetForm = React.useCallback(() => {
    setFormData({ name: "", description: "" })
  }, [])

  const openEditDialog = React.useCallback((category: CancellationCategory) => {
    setEditingCategory(category)
    setFormData({
      name: category.name ?? "",
      description: category.description ?? "",
    })
    setIsEditDialogOpen(true)
  }, [])

  const filtered = React.useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    if (!term) return categories
    return categories.filter((category) => {
      return (
        category.name.toLowerCase().includes(term) ||
        (category.description ?? "").toLowerCase().includes(term)
      )
    })
  }, [categories, searchTerm])

  const handleAdd = async () => {
    const name = normalizeName(formData.name)
    if (!name.length) {
      toast.error("Name is required")
      return
    }

    setSaving(true)
    setMutationError(null)
    try {
      await createCancellationCategory({
        name,
        description: normalizeDescription(formData.description) || null,
      })

      await queryClient.invalidateQueries({ queryKey: cancellationCategoriesQueryKey })
      setIsAddDialogOpen(false)
      resetForm()
      toast.success("Cancellation category created")
    } catch (err) {
      const message = getErrorMessage(err)
      setMutationError(message)
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = async () => {
    const current = editingCategory
    if (!current) return

    const name = normalizeName(formData.name)
    if (!name.length) {
      toast.error("Name is required")
      return
    }

    setSaving(true)
    setMutationError(null)
    try {
      await updateCancellationCategory({
        id: current.id,
        name,
        description: normalizeDescription(formData.description) || null,
      })

      await queryClient.invalidateQueries({ queryKey: cancellationCategoriesQueryKey })
      setIsEditDialogOpen(false)
      setEditingCategory(null)
      resetForm()
      toast.success("Cancellation category updated")
    } catch (err) {
      const message = getErrorMessage(err)
      setMutationError(message)
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (category: CancellationCategory) => {
    if (!confirm(`Delete "${category.name}"?`)) return

    setSaving(true)
    setMutationError(null)
    try {
      await deleteCancellationCategory(category.id)

      await queryClient.invalidateQueries({ queryKey: cancellationCategoriesQueryKey })
      toast.success("Cancellation category deleted")
    } catch (err) {
      const message = getErrorMessage(err)
      setMutationError(message)
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-slate-600">
        <IconLoader2 className="h-5 w-5 animate-spin text-slate-400" />
        <span className="ml-2 text-sm font-medium">Loading cancellation categories…</span>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {showHeader ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <IconBan className="h-5 w-5 text-indigo-600" />
              <h3 className="text-lg font-semibold text-slate-900">Cancellation categories</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Create and manage cancellation categories for your organization.
            </p>
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="flex items-center gap-2 bg-slate-50/80 p-1.5 rounded-2xl border border-slate-100/80">
        <div className="relative flex-1">
          <IconSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <Input
            placeholder="Search categories…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-10 pl-10 bg-white border-none rounded-xl shadow-none focus-visible:ring-indigo-500/20 focus-visible:border-indigo-500"
          />
        </div>

        <div className="h-6 w-px bg-slate-200 mx-1" />

        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button
              onClick={resetForm}
              className="h-10 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm shadow-indigo-100 transition-all active:scale-[0.98] whitespace-nowrap font-semibold border-none"
            >
              <IconPlus className="mr-1 h-4 w-4" />
              Add category
            </Button>
          </DialogTrigger>
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
                    <IconBan className="h-5 w-5" />
                  </div>
                  <div>
                    <DialogTitle className="text-xl font-bold tracking-tight text-slate-900">
                      Add Category
                    </DialogTitle>
                    <DialogDescription className="mt-0.5 text-sm text-slate-500">
                      Create a custom cancellation category. Required fields are marked with{" "}
                      <span className="text-destructive">*</span>.
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-6 pb-6">
                <div className="space-y-5">
                  <div>
                    <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                      Name <span className="text-destructive">*</span>
                    </label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                      className="h-11 rounded-xl border-slate-200 bg-white px-3 text-[15px] shadow-none transition-colors focus-visible:ring-0"
                      placeholder="e.g. Weather, Maintenance"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                      Description
                    </label>
                    <Textarea
                      value={formData.description}
                      onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                      className="min-h-[96px] rounded-xl border-slate-200 bg-white px-3 py-2 text-[15px] shadow-none transition-colors focus-visible:ring-0"
                      placeholder="Optional internal notes"
                    />
                  </div>
                </div>
              </div>

              <div className="shrink-0 border-t bg-white px-6 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-[0_-4px_12px_rgba(0,0,0,0.05)] sm:pb-4">
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
                    disabled={saving || !normalizeName(formData.name).length}
                    className="h-10 flex-[1.4] rounded-xl bg-slate-900 text-xs font-bold text-white shadow-lg shadow-slate-900/10 hover:bg-slate-800"
                  >
                    {saving ? <IconLoader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
                    Create Category
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
          <IconBan className="mx-auto h-10 w-10 text-slate-400" />
          <p className="mt-3 text-sm font-semibold text-slate-900">
            {searchTerm.trim() ? "No matching categories" : "No cancellation categories configured"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {searchTerm.trim() ? "Try a different search term." : "Add your first custom category to get started."}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50 hover:bg-slate-50">
                <TableHead className="font-semibold text-slate-700">Name</TableHead>
                <TableHead className="text-right font-semibold text-slate-700 w-[140px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((category) => (
                <TableRow key={category.id} className="hover:bg-slate-50">
                  <TableCell className="py-4">
                    <div className="flex flex-col">
                      <span className="font-medium text-slate-900">{category.name}</span>
                      {category.description ? (
                        <span className="mt-0.5 line-clamp-1 text-xs text-slate-500">
                          {category.description}
                        </span>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="icon-sm"
                        onClick={() => openEditDialog(category)}
                        disabled={saving}
                        title="Edit category"
                      >
                        <IconPencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon-sm"
                        onClick={() => handleDelete(category)}
                        disabled={saving}
                        className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                        title="Delete category"
                      >
                        <IconTrash className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog
        open={isEditDialogOpen}
        onOpenChange={(open) => {
          setIsEditDialogOpen(open)
          if (!open) {
            setEditingCategory(null)
            resetForm()
          }
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
                  <IconPencil className="h-5 w-5" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-bold tracking-tight text-slate-900">
                    Edit Category
                  </DialogTitle>
                  <DialogDescription className="mt-0.5 text-sm text-slate-500">
                    Update custom cancellation category. Required fields are marked with{" "}
                    <span className="text-destructive">*</span>.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-6 pb-6">
              <div className="space-y-5">
                <div>
                  <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    Name <span className="text-destructive">*</span>
                  </label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                    className="h-11 rounded-xl border-slate-200 bg-white px-3 text-[15px] shadow-none transition-colors focus-visible:ring-0"
                    placeholder="e.g. Weather, Maintenance"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    Description
                  </label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                    className="min-h-[96px] rounded-xl border-slate-200 bg-white px-3 py-2 text-[15px] shadow-none transition-colors focus-visible:ring-0"
                    placeholder="Optional internal notes"
                  />
                </div>
              </div>
            </div>

            <div className="shrink-0 border-t bg-white px-6 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-[0_-4px_12px_rgba(0,0,0,0.05)] sm:pb-4">
              <div className="flex items-center justify-between gap-3">
                <div />
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsEditDialogOpen(false)}
                    className="h-10 rounded-xl border-slate-200 text-xs font-bold shadow-none hover:bg-slate-50"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleEdit}
                    disabled={saving || !normalizeName(formData.name).length || !editingCategory}
                    className="h-10 rounded-xl bg-slate-900 text-xs font-bold text-white shadow-lg shadow-slate-900/10 hover:bg-slate-800"
                  >
                    {saving ? <IconLoader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
                    Save Changes
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
