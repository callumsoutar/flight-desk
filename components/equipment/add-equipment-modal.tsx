"use client"

import * as React from "react"
import { Calendar, FileText, Hash, Info, MapPin, Plus, Settings, Tag } from "lucide-react"
import { toast } from "sonner"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { EQUIPMENT_STATUS_OPTIONS, EQUIPMENT_TYPE_OPTIONS } from "@/lib/types/equipment"
import { cn } from "@/lib/utils"
import { equipmentCreateSchema } from "@/lib/validation/equipment"

interface AddEquipmentModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

type FormValues = z.infer<typeof equipmentCreateSchema>
type FormErrors = Partial<Record<keyof FormValues, string>>

type FormState = {
  name: string
  label: string
  type: FormValues["type"]
  status: FormValues["status"]
  serial_number: string
  location: string
  notes: string
  year_purchased: string
}

const defaultState: FormState = {
  name: "",
  label: "",
  type: "Other",
  status: "active",
  serial_number: "",
  location: "",
  notes: "",
  year_purchased: "",
}

export function AddEquipmentModal({ open, onOpenChange, onSuccess }: AddEquipmentModalProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [form, setForm] = React.useState<FormState>(defaultState)
  const [errors, setErrors] = React.useState<FormErrors>({})

  React.useEffect(() => {
    if (open) {
      setForm(defaultState)
      setErrors({})
    }
  }, [open])

  const onSubmit = async (event?: React.FormEvent) => {
    event?.preventDefault()

    const parsedYear = form.year_purchased.trim().length > 0 ? Number(form.year_purchased) : undefined
    const payload = {
      name: form.name,
      label: form.label,
      type: form.type,
      status: form.status,
      serial_number: form.serial_number,
      location: form.location,
      notes: form.notes,
      year_purchased: parsedYear,
    }

    const parsed = equipmentCreateSchema.safeParse(payload)
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors
      setErrors({
        name: fieldErrors.name?.[0],
        label: fieldErrors.label?.[0],
        type: fieldErrors.type?.[0],
        status: fieldErrors.status?.[0],
        serial_number: fieldErrors.serial_number?.[0],
        location: fieldErrors.location?.[0],
        notes: fieldErrors.notes?.[0],
        year_purchased: fieldErrors.year_purchased?.[0],
      })
      return
    }

    setErrors({})
    setIsSubmitting(true)
    try {
      const response = await fetch("/api/equipment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      })

      const result = (await response.json().catch(() => null)) as { error?: string } | null
      if (!response.ok) {
        throw new Error(result?.error || "Failed to add equipment")
      }

      toast.success("Equipment added successfully")
      onOpenChange(false)
      onSuccess?.()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add equipment")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "p-0 border-none shadow-2xl rounded-[24px] overflow-hidden flex flex-col",
          "w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] sm:w-full sm:max-w-[600px]",
          "top-[calc(env(safe-area-inset-top)+1rem)] sm:top-[50%] translate-y-0 sm:translate-y-[-50%]",
          "h-[calc(100dvh-2rem)] sm:h-auto sm:max-h-[min(calc(100dvh-4rem),850px)]"
        )}
      >
        <div className="flex h-full min-h-0 flex-col bg-white">
          <DialogHeader className="px-6 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-4 text-left sm:pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                <Plus className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold tracking-tight text-slate-900">Add Equipment</DialogTitle>
                <DialogDescription className="mt-0.5 text-sm text-slate-500">
                  Add a new equipment item to the inventory. Required fields are marked with{" "}
                  <span className="text-destructive">*</span>.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form
            onSubmit={(event) => {
              event.preventDefault()
              void onSubmit()
            }}
            className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-6 pb-6"
          >
            <div className="space-y-6">
              <section>
                <div className="mb-3 flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                  <span className="text-xs font-semibold tracking-tight text-slate-900">Basic Info</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                      Name <span className="text-destructive">*</span>
                    </label>
                    <div className="relative">
                      <Tag className="absolute left-3 top-3 h-3.5 w-3.5 text-slate-400" />
                      <Input
                        placeholder="Equipment name"
                        value={form.name}
                        onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                        className="h-10 rounded-xl border-slate-200 bg-white pl-9 text-base font-medium shadow-none hover:bg-slate-50 focus:ring-0"
                      />
                    </div>
                    {errors.name ? <p className="text-[10px] font-medium text-destructive">{errors.name}</p> : null}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Label</label>
                    <div className="relative">
                      <Info className="absolute left-3 top-3 h-3.5 w-3.5 text-slate-400" />
                      <Input
                        placeholder="Optional label"
                        value={form.label}
                        onChange={(event) => setForm((prev) => ({ ...prev, label: event.target.value }))}
                        className="h-10 rounded-xl border-slate-200 bg-white pl-9 text-base font-medium shadow-none hover:bg-slate-50 focus:ring-0"
                      />
                    </div>
                    {errors.label ? <p className="text-[10px] font-medium text-destructive">{errors.label}</p> : null}
                  </div>
                </div>
              </section>

              <section>
                <div className="mb-3 flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                  <span className="text-xs font-semibold tracking-tight text-slate-900">Classification</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                      Type <span className="text-destructive">*</span>
                    </label>
                    <Select
                      value={form.type}
                      onValueChange={(value) => setForm((prev) => ({ ...prev, type: value as FormValues["type"] }))}
                    >
                      <SelectTrigger className="h-10 w-full rounded-xl border-slate-200 bg-white px-3 text-base font-medium shadow-none hover:bg-slate-50 focus:ring-0">
                        <div className="flex items-center gap-2">
                          <Settings className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <SelectValue placeholder="Select type" />
                        </div>
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-slate-200 shadow-xl">
                        {EQUIPMENT_TYPE_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value} className="rounded-lg py-2 text-base">
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.type ? <p className="text-[10px] font-medium text-destructive">{errors.type}</p> : null}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Status</label>
                    <Select
                      value={form.status}
                      onValueChange={(value) =>
                        setForm((prev) => ({ ...prev, status: value as FormValues["status"] }))
                      }
                    >
                      <SelectTrigger className="h-10 w-full rounded-xl border-slate-200 bg-white px-3 text-base font-medium shadow-none hover:bg-slate-50 focus:ring-0">
                        <div className="flex items-center gap-2">
                          <Plus className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <SelectValue placeholder="Select status" />
                        </div>
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-slate-200 shadow-xl">
                        {EQUIPMENT_STATUS_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value} className="rounded-lg py-2 text-base">
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.status ? <p className="text-[10px] font-medium text-destructive">{errors.status}</p> : null}
                  </div>
                </div>
              </section>

              <section>
                <div className="mb-3 flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                  <span className="text-xs font-semibold tracking-tight text-slate-900">Details & Location</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Serial Number</label>
                    <div className="relative">
                      <Hash className="absolute left-3 top-3 h-3.5 w-3.5 text-slate-400" />
                      <Input
                        placeholder="Serial number"
                        value={form.serial_number}
                        onChange={(event) =>
                          setForm((prev) => ({ ...prev, serial_number: event.target.value }))
                        }
                        className="h-10 rounded-xl border-slate-200 bg-white pl-9 text-base font-medium shadow-none hover:bg-slate-50 focus:ring-0"
                      />
                    </div>
                    {errors.serial_number ? (
                      <p className="text-[10px] font-medium text-destructive">{errors.serial_number}</p>
                    ) : null}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Location</label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-3 h-3.5 w-3.5 text-slate-400" />
                      <Input
                        placeholder="Storage location"
                        value={form.location}
                        onChange={(event) => setForm((prev) => ({ ...prev, location: event.target.value }))}
                        className="h-10 rounded-xl border-slate-200 bg-white pl-9 text-base font-medium shadow-none hover:bg-slate-50 focus:ring-0"
                      />
                    </div>
                    {errors.location ? <p className="text-[10px] font-medium text-destructive">{errors.location}</p> : null}
                  </div>
                </div>

                <div className="mt-5 space-y-1.5">
                  <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Year Purchased</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-3 h-3.5 w-3.5 text-slate-400" />
                    <Input
                      type="number"
                      placeholder="2024"
                      value={form.year_purchased}
                      onChange={(event) => setForm((prev) => ({ ...prev, year_purchased: event.target.value }))}
                      className="h-10 rounded-xl border-slate-200 bg-white pl-9 text-base font-medium shadow-none hover:bg-slate-50 focus:ring-0"
                    />
                  </div>
                  {errors.year_purchased ? (
                    <p className="text-[10px] font-medium text-destructive">{errors.year_purchased}</p>
                  ) : null}
                </div>
              </section>

              <section>
                <div className="mb-3 flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                  <span className="text-xs font-semibold tracking-tight text-slate-900">Notes & Remarks</span>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Additional Notes</label>
                  <div className="relative">
                    <FileText className="absolute left-3 top-3 h-3.5 w-3.5 text-slate-400" />
                    <Textarea
                      placeholder="Any additional notes..."
                      value={form.notes}
                      onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
                      className="rounded-xl border-slate-200 bg-white pl-9 text-base font-medium shadow-none hover:bg-slate-50 focus:ring-0 min-h-[100px] resize-none"
                    />
                  </div>
                  {errors.notes ? <p className="text-[10px] font-medium text-destructive">{errors.notes}</p> : null}
                </div>
              </section>
            </div>
          </form>

          <div className="border-t bg-white px-6 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-[0_-4px_12px_rgba(0,0,0,0.05)] sm:pb-4">
            <div className="flex items-center justify-between gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
                className="h-10 flex-1 rounded-xl border-slate-200 text-sm font-bold shadow-none hover:bg-slate-50"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                onClick={() => void onSubmit()}
                disabled={isSubmitting}
                className="h-10 flex-[1.4] rounded-xl bg-slate-900 text-sm font-bold text-white shadow-lg shadow-slate-900/10 hover:bg-slate-800"
              >
                {isSubmitting ? "Adding..." : "Add Equipment"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
