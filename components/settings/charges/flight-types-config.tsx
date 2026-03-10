"use client"

import * as React from "react"
import {
  IconArchive,
  IconPencil,
  IconPlane,
  IconPlus,
  IconSearch,
} from "@tabler/icons-react"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import type { FlightTypesRow } from "@/lib/types/tables"
import { cn } from "@/lib/utils"

type InstructionType = "dual" | "solo" | "trial"

type FlightType = Pick<
  FlightTypesRow,
  | "id"
  | "name"
  | "description"
  | "instruction_type"
  | "aircraft_gl_code"
  | "instructor_gl_code"
  | "is_active"
  | "is_default_solo"
  | "updated_at"
>

type FlightTypeFormData = {
  name: string
  description: string
  instruction_type: InstructionType
  aircraft_gl_code: string
  instructor_gl_code: string
  is_active: boolean
}

const instructionTypeOptions: Array<{ value: InstructionType; label: string }> = [
  { value: "dual", label: "Dual" },
  { value: "solo", label: "Solo" },
  { value: "trial", label: "Trial" },
]

function formatInstructionType(value: string | null) {
  if (!value) return "—"
  const match = instructionTypeOptions.find((option) => option.value === value)
  return match?.label ?? value
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message
  return "Something went wrong."
}

async function fetchFlightTypes(): Promise<FlightType[]> {
  const response = await fetch("/api/flight-types?include_inactive=true", { cache: "no-store" })
  if (!response.ok) {
    const data = await response.json().catch(() => null)
    const message = data && typeof data === "object" && typeof data.error === "string"
      ? data.error
      : "Failed to load flight types"
    throw new Error(message)
  }

  const data = (await response.json().catch(() => null)) as { flight_types?: unknown } | null
  return Array.isArray(data?.flight_types) ? (data?.flight_types as FlightType[]) : []
}

export function FlightTypesConfig() {
  const [flightTypes, setFlightTypes] = React.useState<FlightType[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [searchTerm, setSearchTerm] = React.useState("")
  const [isAddDialogOpen, setIsAddDialogOpen] = React.useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [editingFlightType, setEditingFlightType] = React.useState<FlightType | null>(null)
  const [formData, setFormData] = React.useState<FlightTypeFormData>({
    name: "",
    description: "",
    instruction_type: "dual",
    aircraft_gl_code: "",
    instructor_gl_code: "",
    is_active: true,
  })

  const load = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const items = await fetchFlightTypes()
      setFlightTypes(items)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load flight types")
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void load()
  }, [load])

  const resetForm = React.useCallback(() => {
    setFormData({
      name: "",
      description: "",
      instruction_type: "dual",
      aircraft_gl_code: "",
      instructor_gl_code: "",
      is_active: true,
    })
  }, [])

  const openEditDialog = React.useCallback((flightType: FlightType) => {
    setEditingFlightType(flightType)
    setFormData({
      name: flightType.name ?? "",
      description: flightType.description ?? "",
      instruction_type: (flightType.instruction_type as InstructionType) ?? "dual",
      aircraft_gl_code: flightType.aircraft_gl_code ?? "",
      instructor_gl_code: flightType.instructor_gl_code ?? "",
      is_active: Boolean(flightType.is_active),
    })
    setIsEditDialogOpen(true)
  }, [])

  const filteredTypes = React.useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    if (!term) return flightTypes
    return flightTypes.filter((type) => {
      const haystack = [
        type.name,
        type.description ?? "",
        type.instruction_type ?? "",
      ]
        .join(" ")
        .toLowerCase()
      return haystack.includes(term)
    })
  }, [flightTypes, searchTerm])

  const handleAdd = async () => {
    if (!formData.name.trim()) return
    setSaving(true)
    setError(null)
    try {
      const response = await fetch("/api/flight-types", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          instruction_type: formData.instruction_type,
          aircraft_gl_code: formData.aircraft_gl_code || null,
          instructor_gl_code:
            formData.instruction_type === "solo" ? null : formData.instructor_gl_code || null,
          is_active: formData.is_active,
        }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => null)
        const message = data && typeof data === "object" && typeof data.error === "string"
          ? data.error
          : "Failed to create flight type"
        throw new Error(message)
      }
      await load()
      toast.success("Flight type created")
      setIsAddDialogOpen(false)
      resetForm()
    } catch (err) {
      toast.error(getErrorMessage(err))
      setError(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = async () => {
    if (!editingFlightType) return
    if (!formData.name.trim()) return
    setSaving(true)
    setError(null)
    try {
      const response = await fetch("/api/flight-types", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: editingFlightType.id,
          name: formData.name,
          description: formData.description,
          instruction_type: formData.instruction_type,
          aircraft_gl_code: formData.aircraft_gl_code || null,
          instructor_gl_code:
            formData.instruction_type === "solo" ? null : formData.instructor_gl_code || null,
          is_active: formData.is_active,
        }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => null)
        const message = data && typeof data === "object" && typeof data.error === "string"
          ? data.error
          : "Failed to update flight type"
        throw new Error(message)
      }
      await load()
      toast.success("Flight type updated")
      setIsEditDialogOpen(false)
      setEditingFlightType(null)
      resetForm()
    } catch (err) {
      toast.error(getErrorMessage(err))
      setError(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const handleDeactivate = async (flightType: FlightType) => {
    if (!flightType.is_active) return
    const confirmed = window.confirm(
      "Deactivate this flight type? It will no longer be available for new bookings."
    )
    if (!confirmed) return

    setSaving(true)
    setError(null)
    try {
      const response = await fetch(`/api/flight-types?id=${encodeURIComponent(flightType.id)}`, {
        method: "DELETE",
      })
      if (!response.ok) {
        const data = await response.json().catch(() => null)
        const message = data && typeof data === "object" && typeof data.error === "string"
          ? data.error
          : "Failed to deactivate flight type"
        throw new Error(message)
      }
      await load()
      toast.success("Flight type deactivated")
    } catch (err) {
      toast.error(getErrorMessage(err))
      setError(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
        <IconPlane className="h-5 w-5 text-indigo-600" />
        <h3 className="text-lg font-semibold text-slate-900">Flight types</h3>
      </div>
      <p className="text-sm text-slate-600">
        Flight types control how bookings are categorised and which hourly aircraft rates apply.
      </p>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-2">
        <div className="relative flex-1">
          <IconSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search flight types..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-10 border-none bg-transparent pl-9 shadow-none focus-visible:ring-0"
          />
        </div>
        <div className="h-6 w-px bg-slate-200" />

        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button
              onClick={resetForm}
              className="h-10 rounded-xl bg-indigo-600 font-semibold text-white hover:bg-indigo-700"
              disabled={saving}
            >
              <IconPlus className="mr-2 h-4 w-4" />
              Add
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-2xl p-0 overflow-hidden">
            <DialogHeader className="border-b border-border/40 px-6 py-5 text-left">
              <DialogTitle className="text-lg text-slate-900">Add flight type</DialogTitle>
              <DialogDescription>
                Create a new booking category. Required fields are marked with{" "}
                <span className="text-destructive">*</span>.
              </DialogDescription>
            </DialogHeader>
            <div className="px-6 py-6 space-y-5">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  className="h-11 rounded-xl border-slate-200 bg-white"
                  placeholder="e.g. Aero Club Dual"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Description
                </Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                  className="min-h-[96px] resize-none rounded-xl border-slate-200 bg-white"
                  placeholder="Optional notes shown to staff."
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Instruction type
                  </Label>
                  <Select
                    value={formData.instruction_type}
                    onValueChange={(value) =>
                      setFormData((prev) => ({
                        ...prev,
                        instruction_type: value as InstructionType,
                      }))
                    }
                  >
                    <SelectTrigger className="h-11 rounded-xl border-slate-200 bg-white">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {instructionTypeOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                  <Switch
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, is_active: checked }))}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 leading-none">Active</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Available for new bookings.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Aircraft GL code
                  </Label>
                  <Input
                    value={formData.aircraft_gl_code}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, aircraft_gl_code: e.target.value }))
                    }
                    className="h-11 rounded-xl border-slate-200 bg-white"
                    placeholder="e.g. 4100"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Instructor GL code
                  </Label>
                  <Input
                    value={formData.instructor_gl_code}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, instructor_gl_code: e.target.value }))
                    }
                    className="h-11 rounded-xl border-slate-200 bg-white"
                    placeholder={
                      formData.instruction_type === "solo" ? "Not required for solo" : "e.g. 4200"
                    }
                    disabled={formData.instruction_type === "solo"}
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-border/40 bg-white px-6 py-4">
              <div className="flex items-center justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 rounded-xl"
                  onClick={() => setIsAddDialogOpen(false)}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleAdd}
                  disabled={
                    saving ||
                    !formData.name.trim() ||
                    (formData.instruction_type !== "solo" && !formData.instructor_gl_code.trim())
                  }
                  className="h-10 rounded-xl bg-slate-900 font-semibold text-white hover:bg-slate-800"
                >
                  Create
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-muted-foreground">
          Loading flight types…
        </div>
      ) : filteredTypes.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/60 p-12 text-center">
          <p className="text-sm font-semibold text-slate-900">
            {searchTerm ? "No matching flight types" : "No flight types configured"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {searchTerm ? "Try a different search term." : "Add your first flight type to get started."}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50 hover:bg-slate-50">
                <TableHead className="font-semibold text-slate-700">Name</TableHead>
                <TableHead className="font-semibold text-slate-700">Instruction type</TableHead>
                <TableHead className="font-semibold text-slate-700">Aircraft GL</TableHead>
                <TableHead className="font-semibold text-slate-700">Instructor GL</TableHead>
                <TableHead className="font-semibold text-slate-700">Status</TableHead>
                <TableHead className="text-right font-semibold text-slate-700">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTypes.map((flightType) => (
                <TableRow key={flightType.id} className="hover:bg-slate-50/60">
                  <TableCell className="font-medium text-slate-900">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span>{flightType.name}</span>
                        {flightType.is_default_solo ? (
                          <span className="rounded-md border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">
                            Default solo
                          </span>
                        ) : null}
                      </div>
                      {flightType.description ? (
                        <p className="text-xs text-muted-foreground">{flightType.description}</p>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="text-slate-600">
                    <span className="inline-flex items-center rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold">
                      {formatInstructionType(flightType.instruction_type)}
                    </span>
                  </TableCell>
                  <TableCell className="text-slate-600">{flightType.aircraft_gl_code || "—"}</TableCell>
                  <TableCell className="text-slate-600">
                    {flightType.instruction_type === "solo"
                      ? "N/A"
                      : flightType.instructor_gl_code || "—"}
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-semibold",
                        flightType.is_active
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-slate-200 bg-slate-100 text-slate-600"
                      )}
                    >
                      {flightType.is_active ? "Active" : "Inactive"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Dialog open={isEditDialogOpen && editingFlightType?.id === flightType.id} onOpenChange={(open) => {
                        if (!open) {
                          setIsEditDialogOpen(false)
                          setEditingFlightType(null)
                          resetForm()
                          return
                        }
                        openEditDialog(flightType)
                      }}>
                        <DialogTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-9 w-9 rounded-xl p-0"
                            onClick={() => openEditDialog(flightType)}
                            disabled={saving}
                          >
                            <IconPencil className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="rounded-2xl p-0 overflow-hidden">
                          <DialogHeader className="border-b border-border/40 px-6 py-5 text-left">
                            <DialogTitle className="text-lg text-slate-900">Edit flight type</DialogTitle>
                            <DialogDescription>Update the name, description, and status.</DialogDescription>
                          </DialogHeader>
                          <div className="px-6 py-6 space-y-5">
                            <div className="space-y-2">
                              <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                                Name <span className="text-destructive">*</span>
                              </Label>
                              <Input
                                value={formData.name}
                                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                                className="h-11 rounded-xl border-slate-200 bg-white"
                              />
                            </div>

                            <div className="space-y-2">
                              <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                                Description
                              </Label>
                              <Textarea
                                value={formData.description}
                                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                                className="min-h-[96px] resize-none rounded-xl border-slate-200 bg-white"
                              />
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                              <div className="space-y-2">
                                <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                                  Instruction type
                                </Label>
                              <Select
                                  value={formData.instruction_type}
                                  onValueChange={(value) =>
                                    setFormData((prev) => ({
                                      ...prev,
                                      instruction_type: value as InstructionType,
                                    }))
                                  }
                                >
                                  <SelectTrigger className="h-11 rounded-xl border-slate-200 bg-white">
                                    <SelectValue placeholder="Select type" />
                                  </SelectTrigger>
                                  <SelectContent className="rounded-xl">
                                    {instructionTypeOptions.map((option) => (
                                      <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                                <Switch
                                  checked={formData.is_active}
                                  onCheckedChange={(checked) =>
                                    setFormData((prev) => ({ ...prev, is_active: checked }))
                                  }
                                />
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-slate-900 leading-none">Active</p>
                                  <p className="mt-1 text-sm text-muted-foreground">
                                    Available for new bookings.
                                  </p>
                                </div>
                              </div>
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                              <div className="space-y-2">
                                <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                                  Aircraft GL code
                                </Label>
                                <Input
                                  value={formData.aircraft_gl_code}
                                  onChange={(e) =>
                                    setFormData((prev) => ({ ...prev, aircraft_gl_code: e.target.value }))
                                  }
                                  className="h-11 rounded-xl border-slate-200 bg-white"
                                  placeholder="e.g. 4100"
                                />
                              </div>

                              <div className="space-y-2">
                                <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                                  Instructor GL code
                                </Label>
                                <Input
                                  value={formData.instructor_gl_code}
                                  onChange={(e) =>
                                    setFormData((prev) => ({ ...prev, instructor_gl_code: e.target.value }))
                                  }
                                  className="h-11 rounded-xl border-slate-200 bg-white"
                                  placeholder={
                                    formData.instruction_type === "solo"
                                      ? "Not required for solo"
                                      : "e.g. 4200"
                                  }
                                  disabled={formData.instruction_type === "solo"}
                                />
                              </div>
                            </div>
                          </div>

                          <div className="border-t border-border/40 bg-white px-6 py-4">
                            <div className="flex items-center justify-end gap-3">
                              <Button
                                type="button"
                                variant="outline"
                                className="h-10 rounded-xl"
                                onClick={() => {
                                  setIsEditDialogOpen(false)
                                  setEditingFlightType(null)
                                  resetForm()
                                }}
                                disabled={saving}
                              >
                                Cancel
                              </Button>
                              <Button
                                onClick={handleEdit}
                                disabled={
                                  saving ||
                                  !formData.name.trim() ||
                                  (formData.instruction_type !== "solo" &&
                                    !formData.instructor_gl_code.trim())
                                }
                                className="h-10 rounded-xl bg-slate-900 font-semibold text-white hover:bg-slate-800"
                              >
                                Save changes
                              </Button>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-9 w-9 rounded-xl p-0 text-orange-600 hover:bg-orange-50 hover:text-orange-700"
                        onClick={() => void handleDeactivate(flightType)}
                        disabled={saving || !flightType.is_active}
                        title="Deactivate"
                      >
                        <IconArchive className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
