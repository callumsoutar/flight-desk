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
          <h4 className="text-base font-semibold text-slate-900">Chargeable types</h4>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700">
              <IconPlus className="mr-1 h-4 w-4" />
              Add type
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create chargeable type</DialogTitle>
              <DialogDescription>Set a type-level GL code used by all chargeables in this type.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Code</Label>
                <Input value={form.code} onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>GL code</Label>
                <Input value={form.gl_code} onChange={(e) => setForm((p) => ({ ...p, gl_code: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                />
              </div>
              <div className="flex items-center justify-between rounded-md border px-3 py-2">
                <span className="text-sm">Active</span>
                <Switch checked={form.is_active} onCheckedChange={(v) => setForm((p) => ({ ...p, is_active: v }))} />
              </div>
              <Button
                onClick={handleCreate}
                disabled={saving || !form.name.trim() || !form.code.trim()}
                className="w-full"
              >
                Create
              </Button>
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
                    <Dialog open={editOpen && editing?.id === item.id} onOpenChange={setEditOpen}>
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
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Edit chargeable type</DialogTitle>
                          <DialogDescription>Update name, code, and GL code mapping.</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-3">
                          <div className="space-y-2">
                            <Label>Code</Label>
                            <Input
                              value={form.code}
                              onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))}
                              disabled={Boolean(item.is_system)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Name</Label>
                            <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
                          </div>
                          <div className="space-y-2">
                            <Label>GL code</Label>
                            <Input
                              value={form.gl_code}
                              onChange={(e) => setForm((p) => ({ ...p, gl_code: e.target.value }))}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Description</Label>
                            <Textarea
                              value={form.description}
                              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                            />
                          </div>
                          <div className="flex items-center justify-between rounded-md border px-3 py-2">
                            <span className="text-sm">Active</span>
                            <Switch
                              checked={form.is_active}
                              onCheckedChange={(v) => setForm((p) => ({ ...p, is_active: v }))}
                              disabled={Boolean(item.is_system)}
                            />
                          </div>
                          <Button
                            onClick={handleEdit}
                            disabled={
                              saving ||
                              Boolean(item.is_system) ||
                              !form.name.trim() ||
                              !form.code.trim()
                            }
                            className="w-full"
                          >
                            Save changes
                          </Button>
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
