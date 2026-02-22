"use client"

import * as React from "react"
import { FileText, Wrench } from "lucide-react"
import { toast } from "sonner"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import type { Equipment } from "@/lib/types/equipment"

const updateSchema = z.object({
  next_due_at: z.string().optional(),
  notes: z.string().optional(),
})

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  equipment: Equipment
  onSuccess?: () => void
}

export function UpdateEquipmentModal({ open, onOpenChange, equipment, onSuccess }: Props) {
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [nextDueAt, setNextDueAt] = React.useState("")
  const [notes, setNotes] = React.useState("")

  React.useEffect(() => {
    if (open) {
      setNextDueAt("")
      setNotes("")
    }
  }, [open])

  const handleSubmit = async (event?: React.FormEvent) => {
    event?.preventDefault()

    const parsed = updateSchema.safeParse({ next_due_at: nextDueAt, notes })
    if (!parsed.success) {
      toast.error("Invalid update details")
      return
    }

    setIsSubmitting(true)
    try {
      const response = await fetch("/api/equipment-updates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          equipment_id: equipment.id,
          next_due_at: parsed.data.next_due_at?.trim() ? parsed.data.next_due_at : null,
          notes: parsed.data.notes?.trim() ? parsed.data.notes : null,
        }),
      })

      const payload = (await response.json().catch(() => null)) as { error?: string } | null
      if (!response.ok) {
        toast.error(payload?.error || "Failed to log update")
        return
      }

      toast.success("Equipment update logged")
      onOpenChange(false)
      onSuccess?.()
    } catch {
      toast.error("Network error while logging update")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="h-4 w-4" />
            Log Equipment Update
          </DialogTitle>
          <DialogDescription>Record a maintenance or inspection update for {equipment.name}.</DialogDescription>
        </DialogHeader>

        <form
          id="update-equipment-form"
          onSubmit={(event) => {
            event.preventDefault()
            void handleSubmit()
          }}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Next Due At</label>
            <Input type="date" value={nextDueAt} onChange={(event) => setNextDueAt(event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Notes</label>
            <div className="relative">
              <FileText className="absolute top-3 left-3 h-3.5 w-3.5 text-slate-400" />
              <Textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Describe the work completed..."
                className="min-h-[100px] resize-none pl-9"
              />
            </div>
          </div>
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" form="update-equipment-form" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Log Update"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
