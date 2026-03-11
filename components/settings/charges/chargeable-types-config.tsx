"use client"

import * as React from "react"
import { IconArchive, IconCategory, IconPencil, IconPlus } from "@tabler/icons-react"
import { toast } from "sonner"

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
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { XeroAccountSelect } from "@/components/settings/xero-account-select"
import { cn } from "@/lib/utils"
import type { ChargeableTypesRow } from "@/lib/types/tables"

type ChargeableType = Pick<
  ChargeableTypesRow,
  "id" | "code" | "name" | "description" | "gl_code" | "is_active" | "is_global" | "is_system"
>

type FormState = {
  code: string
  name: string
  description: string
  gl_code: string
  is_active: boolean
}

function blankForm(): FormState {
  return { code: "", name: "", description: "", gl_code: "", is_active: true }
}

export function ChargeableTypesConfig() {
  const [items, setItems] = React.useState<ChargeableType[]>([])
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [form, setForm] = React.useState<FormState>(blankForm())
  const [editing, setEditing] = React.useState<ChargeableType | null>(null)
  const [addOpen, setAddOpen] = React.useState(false)
  const [editOpen, setEditOpen] = React.useState(false)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/chargeable_types?is_active=true", { cache: "no-store" })
      if (!response.ok) throw new Error("Failed to load chargeable types")
      const data = (await response.json().catch(() => null)) as { chargeable_types?: ChargeableType[] } | null
      setItems(data?.chargeable_types ?? [])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load chargeable types")
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void load()
  }, [load])

  const handleCreate = async () => {
    setSaving(true)
    try {
      const response = await fetch("/api/chargeable_types", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          code: form.code,
          name: form.name,
          description: form.description || null,
          gl_code: form.gl_code || null,
          is_active: form.is_active,
        }),
      })
      if (!response.ok) throw new Error("Failed to create chargeable type")
      await load()
      setAddOpen(false)
      setForm(blankForm())
      toast.success("Chargeable type created")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create chargeable type")
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = async () => {
    if (!editing) return
    setSaving(true)
    try {
      const response = await fetch("/api/chargeable_types", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: editing.id,
          code: form.code,
          name: form.name,
          description: form.description || null,
          gl_code: form.gl_code || null,
          is_active: form.is_active,
        }),
      })
      if (!response.ok) throw new Error("Failed to update chargeable type")
      await load()
      setEditOpen(false)
      setEditing(null)
      setForm(blankForm())
      toast.success("Chargeable type updated")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update chargeable type")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <IconCategory className="h-4 w-4 text-indigo-600" />
          <h4 className="text-base font-semibold text-slate-900">Chargeable categories</h4>
        </div>
        <Dialog
          open={addOpen}
          onOpenChange={(open) => {
            setAddOpen(open)
            if (open) setForm(blankForm())
          }}
        >
          <DialogTrigger asChild>
            <Button
              size="sm"
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
              "h-[calc(100dvh-2rem)] sm:h-auto sm:max-h-[calc(100dvh-4rem)]"
            )}
          >
            <div className="flex h-full min-h-0 flex-col bg-white">
              <DialogHeader className="px-6 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-4 text-left sm:pt-6">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
                    <IconCategory className="h-5 w-5" />
                  </div>
                  <div>
                    <DialogTitle className="text-xl font-bold tracking-tight text-slate-900">
                      Add Chargeable Category
                    </DialogTitle>
                    <DialogDescription className="mt-0.5 text-sm text-slate-500">
                      Define the category and default GL code. Required fields are marked with{" "}
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
                      <span className="text-xs font-semibold tracking-tight text-slate-900">Category Details</span>
                    </div>

                    <div className="grid gap-5">
                      <div>
                        <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                          CODE <span className="text-destructive">*</span>
                        </label>
                        <Input
                          value={form.code}
                          onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))}
                          placeholder="e.g., admin_fee"
                          className="h-10 rounded-xl border-slate-200 bg-white px-3 text-base font-medium shadow-none hover:bg-slate-50 focus-visible:ring-0"
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                          NAME <span className="text-destructive">*</span>
                        </label>
                        <Input
                          value={form.name}
                          onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                          placeholder="e.g., Administration Fee"
                          className="h-10 rounded-xl border-slate-200 bg-white px-3 text-base font-medium shadow-none hover:bg-slate-50 focus-visible:ring-0"
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                          GL CODE
                        </label>
                        <XeroAccountSelect
                          value={form.gl_code}
                          onChange={(code) => setForm((p) => ({ ...p, gl_code: code }))}
                          accountTypes={["REVENUE"]}
                          className="h-10"
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                          DESCRIPTION
                        </label>
                        <Textarea
                          value={form.description}
                          onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                          placeholder="Enter a brief description"
                          rows={3}
                          className="rounded-xl border-slate-200 bg-white px-3 py-2 text-base font-medium shadow-none hover:bg-slate-50 focus-visible:ring-0"
                        />
                      </div>
                      <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                        <Switch
                          checked={form.is_active}
                          onCheckedChange={(v) => setForm((p) => ({ ...p, is_active: v }))}
                        />
                        <div className="min-w-0">
                          <Label className="text-xs font-semibold text-slate-900 leading-none cursor-pointer">
                            Active
                          </Label>
                          <p className="text-[11px] text-slate-600 mt-1 leading-snug">
                            Whether this category is available for selection.
                          </p>
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
                    onClick={() => setAddOpen(false)}
                    className="h-10 flex-1 rounded-xl border-slate-200 text-xs font-bold shadow-none hover:bg-slate-50"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreate}
                    disabled={saving || !form.name.trim() || !form.code.trim()}
                    className="h-10 flex-[1.4] rounded-xl bg-slate-900 text-xs font-bold text-white shadow-lg shadow-slate-900/10 hover:bg-slate-800"
                  >
                    Create Category
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>GL code</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  Loading...
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.name}</TableCell>
                  <TableCell>{item.code}</TableCell>
                  <TableCell>{item.gl_code || "—"}</TableCell>
                  <TableCell>{item.is_active ? "Active" : "Inactive"}</TableCell>
                  <TableCell className="text-right">
                    <Dialog
                      open={editOpen && editing?.id === item.id}
                      onOpenChange={(open) => {
                        setEditOpen(open)
                        if (!open) {
                          setEditing(null)
                          setForm(blankForm())
                        }
                      }}
                    >
                      <DialogTrigger asChild>
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() => {
                            setEditing(item)
                            setForm({
                              code: item.code ?? "",
                              name: item.name ?? "",
                              description: item.description ?? "",
                              gl_code: item.gl_code ?? "",
                              is_active: Boolean(item.is_active),
                            })
                            setEditOpen(true)
                          }}
                          disabled={Boolean(item.is_system)}
                        >
                          <IconPencil className="h-4 w-4" />
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
                                <IconPencil className="h-5 w-5" />
                              </div>
                              <div>
                                <DialogTitle className="text-xl font-bold tracking-tight text-slate-900">
                                  Edit Chargeable Category
                                </DialogTitle>
                                <DialogDescription className="mt-0.5 text-sm text-slate-500">
                                  Update category details and GL code mapping. Required fields are marked with{" "}
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
                                  <span className="text-xs font-semibold tracking-tight text-slate-900">
                                    Category Details
                                  </span>
                                </div>

                                <div className="grid gap-5">
                                  <div>
                                    <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                                      CODE <span className="text-destructive">*</span>
                                    </label>
                                    <Input
                                      value={form.code}
                                      onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))}
                                      disabled={Boolean(item.is_system)}
                                      className="h-10 rounded-xl border-slate-200 bg-white px-3 text-base font-medium shadow-none hover:bg-slate-50 focus-visible:ring-0"
                                    />
                                  </div>
                                  <div>
                                    <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                                      NAME <span className="text-destructive">*</span>
                                    </label>
                                    <Input
                                      value={form.name}
                                      onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                                      className="h-10 rounded-xl border-slate-200 bg-white px-3 text-base font-medium shadow-none hover:bg-slate-50 focus-visible:ring-0"
                                    />
                                  </div>
                                  <div>
                                    <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                                      GL CODE
                                    </label>
                                    <XeroAccountSelect
                                      value={form.gl_code}
                                      onChange={(code) => setForm((p) => ({ ...p, gl_code: code }))}
                                      accountTypes={["REVENUE"]}
                                      className="h-10"
                                    />
                                  </div>
                                  <div>
                                    <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                                      DESCRIPTION
                                    </label>
                                    <Textarea
                                      value={form.description}
                                      onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                                      rows={3}
                                      className="rounded-xl border-slate-200 bg-white px-3 py-2 text-base font-medium shadow-none hover:bg-slate-50 focus-visible:ring-0"
                                    />
                                  </div>
                                  <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                                    <Switch
                                      checked={form.is_active}
                                      onCheckedChange={(v) => setForm((p) => ({ ...p, is_active: v }))}
                                      disabled={Boolean(item.is_system)}
                                    />
                                    <div className="min-w-0">
                                      <Label className="text-xs font-semibold text-slate-900 leading-none cursor-pointer">
                                        Active
                                      </Label>
                                      <p className="text-[11px] text-slate-600 mt-1 leading-snug">
                                        Whether this category is available for selection.
                                      </p>
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
                                  setEditOpen(false)
                                  setEditing(null)
                                  setForm(blankForm())
                                }}
                                className="h-10 flex-1 rounded-xl border-slate-200 text-xs font-bold shadow-none hover:bg-slate-50"
                              >
                                Cancel
                              </Button>
                              <Button
                                onClick={handleEdit}
                                disabled={
                                  saving ||
                                  Boolean(item.is_system) ||
                                  !form.name.trim() ||
                                  !form.code.trim()
                                }
                                className="h-10 flex-[1.4] rounded-xl bg-slate-900 text-xs font-bold text-white shadow-lg shadow-slate-900/10 hover:bg-slate-800"
                              >
                                Update Category
                              </Button>
                            </div>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                    {item.is_system ? (
                      <Button size="icon" variant="ghost" disabled className="ml-2">
                        <IconArchive className="h-4 w-4" />
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
