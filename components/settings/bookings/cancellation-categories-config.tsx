"use client"

import * as React from "react"
import {
  IconBan,
  IconLoader2,
  IconPencil,
  IconPlus,
  IconSearch,
  IconShieldCheck,
  IconTrash,
  IconUser,
} from "@tabler/icons-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import type { CancellationCategory } from "@/lib/types/cancellations"

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

async function fetchCategories(): Promise<CancellationCategory[]> {
  const response = await fetch("/api/cancellation-categories", { cache: "no-store" })
  if (!response.ok) {
    const data = await response.json().catch(() => null)
    const message =
      data && typeof data === "object" && typeof data.error === "string"
        ? data.error
        : "Failed to load cancellation categories"
    throw new Error(message)
  }

  const data = (await response.json().catch(() => null)) as { categories?: unknown } | null
  return Array.isArray(data?.categories) ? (data?.categories as CancellationCategory[]) : []
}

export function CancellationCategoriesConfig({ showHeader = true }: { showHeader?: boolean }) {
  const [categories, setCategories] = React.useState<CancellationCategory[]>([])
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [searchTerm, setSearchTerm] = React.useState("")

  const [isAddDialogOpen, setIsAddDialogOpen] = React.useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false)
  const [editingCategory, setEditingCategory] = React.useState<CancellationCategory | null>(null)

  const [formData, setFormData] = React.useState<CategoryFormData>({
    name: "",
    description: "",
  })

  const load = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const items = await fetchCategories()
      setCategories(items)
    } catch (err) {
      setCategories([])
      setError(err instanceof Error ? err.message : "Failed to load cancellation categories")
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void load()
  }, [load])

  const resetForm = React.useCallback(() => {
    setFormData({ name: "", description: "" })
  }, [])

  const openEditDialog = React.useCallback((category: CancellationCategory) => {
    if (category.is_global) return
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
    setError(null)
    try {
      const response = await fetch("/api/cancellation-categories", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          description: normalizeDescription(formData.description) || null,
        }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        const message =
          data && typeof data === "object" && typeof data.error === "string"
            ? data.error
            : "Failed to create cancellation category"
        throw new Error(message)
      }

      await load()
      setIsAddDialogOpen(false)
      resetForm()
      toast.success("Cancellation category created")
    } catch (err) {
      const message = getErrorMessage(err)
      setError(message)
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = async () => {
    const current = editingCategory
    if (!current || current.is_global) return

    const name = normalizeName(formData.name)
    if (!name.length) {
      toast.error("Name is required")
      return
    }

    setSaving(true)
    setError(null)
    try {
      const response = await fetch("/api/cancellation-categories", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: current.id,
          name,
          description: normalizeDescription(formData.description) || null,
        }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        const message =
          data && typeof data === "object" && typeof data.error === "string"
            ? data.error
            : "Failed to update cancellation category"
        throw new Error(message)
      }

      await load()
      setIsEditDialogOpen(false)
      setEditingCategory(null)
      resetForm()
      toast.success("Cancellation category updated")
    } catch (err) {
      const message = getErrorMessage(err)
      setError(message)
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (category: CancellationCategory) => {
    if (category.is_global) return

    if (!confirm(`Delete "${category.name}"?`)) return

    setSaving(true)
    setError(null)
    try {
      const response = await fetch(`/api/cancellation-categories?id=${category.id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        const message =
          data && typeof data === "object" && typeof data.error === "string"
            ? data.error
            : "Failed to delete cancellation category"
        throw new Error(message)
      }

      await load()
      toast.success("Cancellation category deleted")
    } catch (err) {
      const message = getErrorMessage(err)
      setError(message)
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
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
              Global categories are available to all tenants and can&apos;t be modified.
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
              className="h-10 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm shadow-indigo-100 font-semibold border-none"
            >
              <IconPlus className="h-4 w-4" />
              Add
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-[520px]">
            <DialogHeader>
              <DialogTitle>Add cancellation category</DialogTitle>
              <DialogDescription>Create a custom cancellation category for your organization.</DialogDescription>
            </DialogHeader>

            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="add-name" className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="add-name"
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  className="h-11 rounded-xl border-slate-200"
                  placeholder="e.g. Weather, Maintenance"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="add-description" className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Description
                </Label>
                <Textarea
                  id="add-description"
                  value={formData.description}
                  onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                  className="min-h-[96px] rounded-xl border-slate-200"
                  placeholder="Optional internal notes"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={handleAdd} disabled={saving || !normalizeName(formData.name).length}>
                {saving ? "Creating…" : "Create"}
              </Button>
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
                <TableHead className="font-semibold text-slate-700 w-[140px]">Scope</TableHead>
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
                  <TableCell>
                    {category.is_global ? (
                      <Badge variant="secondary" className="gap-1 bg-blue-50 text-blue-700 border-blue-100">
                        <IconShieldCheck className="h-3 w-3" />
                        System
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="gap-1 bg-slate-100 text-slate-700 border-slate-200">
                        <IconUser className="h-3 w-3" />
                        Custom
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="icon-sm"
                        onClick={() => openEditDialog(category)}
                        disabled={saving || category.is_global}
                        className={cn(category.is_global ? "opacity-50" : "")}
                        title={category.is_global ? "System categories cannot be edited" : "Edit category"}
                      >
                        <IconPencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon-sm"
                        onClick={() => handleDelete(category)}
                        disabled={saving || category.is_global}
                        className={cn(
                          category.is_global
                            ? "opacity-50"
                            : "border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                        )}
                        title={category.is_global ? "System categories cannot be deleted" : "Delete category"}
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
        <DialogContent className="max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Edit cancellation category</DialogTitle>
            <DialogDescription>Update a custom cancellation category.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-name" className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                className="h-11 rounded-xl border-slate-200"
                placeholder="Category name"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-description" className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Description
              </Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                className="min-h-[96px] rounded-xl border-slate-200"
                placeholder="Optional internal notes"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsEditDialogOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleEdit}
              disabled={saving || !normalizeName(formData.name).length || !editingCategory || editingCategory.is_global}
            >
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
