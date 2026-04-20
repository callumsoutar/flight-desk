"use client"

import * as React from "react"
import { DndContext, closestCenter, type DragEndEvent } from "@dnd-kit/core"
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { IconGripVertical, IconLoader2, IconArrowsSort } from "@tabler/icons-react"
import { toast } from "sonner"

import { reorderAircraft } from "@/hooks/use-aircraft-query"
import type { AircraftWithType } from "@/lib/types/aircraft"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type SortableId = string

function SortableRow(props: {
  id: SortableId
  primary: string
  secondary?: string | null
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props.id,
  })

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn(
        "flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm",
        isDragging && "opacity-70 shadow-md ring-1 ring-indigo-500/20 z-10 relative"
      )}
    >
      <button
        type="button"
        className="inline-flex h-8 w-8 items-center justify-center rounded hover:bg-slate-50"
        aria-label="Drag to reorder"
        {...attributes}
        {...listeners}
      >
        <IconGripVertical className="h-4 w-4 text-slate-500" />
      </button>
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium text-slate-900">{props.primary}</div>
        {props.secondary ? (
          <div className="truncate text-xs text-slate-600">{props.secondary}</div>
        ) : null}
      </div>
    </div>
  )
}

export function ReorderAircraftModal(props: {
  open: boolean
  onOpenChange: (open: boolean) => void
  aircraft: AircraftWithType[]
  onSaved?: (orderedIds: string[]) => void
}) {
  const [ids, setIds] = React.useState<SortableId[]>([])
  const [saving, setSaving] = React.useState(false)

  const aircraftById = React.useMemo(() => {
    return new Map(props.aircraft.map((a) => [a.id, a]))
  }, [props.aircraft])

  React.useEffect(() => {
    if (!props.open) return
    setIds(props.aircraft.map((a) => a.id))
  }, [props.open, props.aircraft])

  const onDragEnd = React.useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (!over) return
    if (active.id === over.id) return
    setIds((prev) => {
      const oldIndex = prev.indexOf(String(active.id))
      const newIndex = prev.indexOf(String(over.id))
      if (oldIndex === -1 || newIndex === -1) return prev
      return arrayMove(prev, oldIndex, newIndex)
    })
  }, [])

  const canSave = ids.length > 0 && !saving

  const handleSave = React.useCallback(async () => {
    if (!canSave) return
    setSaving(true)
    try {
      const items = ids.map((id, idx) => ({ id, order: idx + 1 }))
      await reorderAircraft(items)
      toast.success("Aircraft order updated")
      props.onOpenChange(false)
      props.onSaved?.(ids)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update aircraft order")
    } finally {
      setSaving(false)
    }
  }, [canSave, ids, props])

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
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
                <IconArrowsSort className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold tracking-tight text-slate-900">
                  Reorder Aircraft
                </DialogTitle>
                <DialogDescription className="mt-0.5 text-sm text-slate-500">
                  Drag aircraft to set the scheduler display order.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-6 pb-6">
            <div className="flex flex-col gap-2">
              <DndContext collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                <SortableContext items={ids} strategy={verticalListSortingStrategy}>
                  {ids.map((id) => {
                    const a = aircraftById.get(id)
                    if (!a) return null
                    return (
                      <SortableRow
                        key={id}
                        id={id}
                        primary={a.registration}
                        secondary={a.type || a.aircraft_type?.name || null}
                      />
                    )
                  })}
                </SortableContext>
              </DndContext>
            </div>
          </div>

          <div className="shrink-0 border-t bg-white px-6 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-[0_-4px_12px_rgba(0,0,0,0.05)] sm:pb-4">
            <div className="flex items-center justify-between gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => props.onOpenChange(false)}
                className="h-10 flex-1 rounded-xl border-slate-200 text-xs font-bold shadow-none hover:bg-slate-50"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={!canSave}
                className="h-10 flex-[1.4] rounded-xl bg-slate-900 text-xs font-bold text-white shadow-lg shadow-slate-900/10 hover:bg-slate-800"
              >
                {saving ? <IconLoader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
