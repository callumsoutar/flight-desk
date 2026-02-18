"use client"

import React, { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { DatePicker } from "@/components/ui/date-picker"
import type { Database } from "@/lib/types"
import type { AircraftComponentsRow } from "@/lib/types/tables"
import { toast } from "sonner"
import {
  CalendarIcon,
  Pencil,
  Info,
  Repeat,
  Settings,
  FileText,
  Tag,
  Clock,
  Calendar,
  ArrowUpRight,
  RotateCcw,
  Loader2,
} from "lucide-react"
import { cn } from "@/lib/utils"

type ComponentType = Database["public"]["Enums"]["component_type_enum"]
type IntervalType = Database["public"]["Enums"]["interval_type_enum"]
type ComponentStatus = Database["public"]["Enums"]["component_status_enum"]

interface ComponentEditModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  component: AircraftComponentsRow | null
  onSave: (updated: Partial<AircraftComponentsRow>) => Promise<void>
}

const PRIORITY_OPTIONS = ["LOW", "MEDIUM", "HIGH"]
const STATUS_OPTIONS: ComponentStatus[] = ["active", "inactive", "removed"]
const COMPONENT_TYPE_OPTIONS: ComponentType[] = [
  "battery",
  "inspection",
  "service",
  "engine",
  "fuselage",
  "avionics",
  "elt",
  "propeller",
  "landing_gear",
  "other",
]
const INTERVAL_TYPE_OPTIONS: IntervalType[] = ["HOURS", "CALENDAR", "BOTH"]

function toDate(dateString: string | null | undefined): Date | null {
  if (!dateString) return null
  const parsed = new Date(dateString)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function formatDate(date: Date | null): string {
  if (!date) return "Pick a date"
  return date.toLocaleDateString("en-NZ", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

function toYyyyMmDd(date: Date | null): string | null {
  if (!date) return null
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, "0")
  const day = `${date.getDate()}`.padStart(2, "0")
  return `${year}-${month}-${day}`
}

const ComponentEditModal: React.FC<ComponentEditModalProps> = ({
  open,
  onOpenChange,
  component,
  onSave,
}) => {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [componentType, setComponentType] = useState<ComponentType>("inspection")
  const [intervalType, setIntervalType] = useState<IntervalType>("HOURS")
  const [intervalHours, setIntervalHours] = useState<number | null>(null)
  const [intervalDays, setIntervalDays] = useState<number | null>(null)
  const [currentDueDate, setCurrentDueDate] = useState<Date | null>(null)
  const [currentDueHours, setCurrentDueHours] = useState<number | null>(null)
  const [lastCompletedDate, setLastCompletedDate] = useState<Date | null>(null)
  const [lastCompletedHours, setLastCompletedHours] = useState<number | null>(null)
  const [status, setStatus] = useState<ComponentStatus>("active")
  const [priority, setPriority] = useState<string | null>("MEDIUM")
  const [notes, setNotes] = useState<string>("")
  const [loadingExtend, setLoadingExtend] = useState(false)
  const [revertLoading, setRevertLoading] = useState(false)
  const [showRevertConfirm, setShowRevertConfirm] = useState(false)

  useEffect(() => {
    if (component && open) {
      setName(component.name || "")
      setDescription(component.description || "")
      setComponentType(component.component_type || "inspection")
      setIntervalType(component.interval_type || "HOURS")
      setIntervalHours(component.interval_hours ?? null)
      setIntervalDays(component.interval_days ?? null)
      setCurrentDueDate(toDate(component.current_due_date))
      setCurrentDueHours(component.current_due_hours ?? null)
      setLastCompletedDate(toDate(component.last_completed_date))
      setLastCompletedHours(component.last_completed_hours ?? null)
      setStatus(component.status || "active")
      setPriority(component.priority || "MEDIUM")
      setNotes(component.notes || "")
      setShowRevertConfirm(false)
    }
  }, [component, open])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()

    if (intervalType === "HOURS" && (intervalHours === null || intervalHours === undefined)) {
      toast.error("Interval Hours is required when Interval Type is HOURS")
      return
    }
    if (intervalType === "CALENDAR" && (intervalDays === null || intervalDays === undefined)) {
      toast.error("Interval Days is required when Interval Type is CALENDAR")
      return
    }
    if (intervalType === "BOTH") {
      if (intervalHours === null || intervalHours === undefined) {
        toast.error("Interval Hours is required when Interval Type is BOTH")
        return
      }
      if (intervalDays === null || intervalDays === undefined) {
        toast.error("Interval Days is required when Interval Type is BOTH")
        return
      }
    }

    const payload: Partial<AircraftComponentsRow> = {
      name,
      description,
      component_type: componentType,
      interval_type: intervalType,
      interval_hours: intervalHours,
      interval_days: intervalDays,
      current_due_date: toYyyyMmDd(currentDueDate),
      current_due_hours: currentDueHours,
      last_completed_date: toYyyyMmDd(lastCompletedDate),
      last_completed_hours: lastCompletedHours,
      status,
      priority,
      notes,
    }
    try {
      await Promise.resolve(onSave(payload))
      onOpenChange(false)
    } catch (error) {
      console.error("Failed to save component:", error)
    }
  }

  async function handleExtend() {
    if (!component) return
    setLoadingExtend(true)
    try {
      const res = await fetch("/api/aircraft-components", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: component.id, extension_limit_hours: 10 }),
      })
      if (!res.ok) {
        const errorData = await res.json()
        toast.error(errorData.error || "Failed to extend component")
        setLoadingExtend(false)
        return
      }
      toast.success("Component extension applied!", {
        description: "Extension limit set to 10%",
      })
      setTimeout(() => {
        if (typeof window !== "undefined") window.location.reload()
      }, 1200)
    } catch (err: unknown) {
      if (err instanceof Error) {
        toast.error(err.message || "Failed to extend component")
      } else {
        toast.error("Failed to extend component")
      }
    } finally {
      setLoadingExtend(false)
    }
  }

  async function handleRevertExtension() {
    if (!component) return
    setRevertLoading(true)
    try {
      const res = await fetch("/api/aircraft-components", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: component.id, extension_limit_hours: null }),
      })
      if (!res.ok) {
        const errorData = await res.json()
        toast.error(errorData.error || "Failed to revert extension")
        setRevertLoading(false)
        return
      }
      toast.success("Extension reverted. Component is now back to original due logic.")
      setTimeout(() => {
        if (typeof window !== "undefined") window.location.reload()
      }, 1200)
    } catch (e: unknown) {
      if (e instanceof Error) {
        toast.error(e.message || "Failed to revert extension")
      } else {
        toast.error("Failed to revert extension")
      }
    } finally {
      setRevertLoading(false)
      setShowRevertConfirm(false)
    }
  }

  if (!component) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "p-0 border-none shadow-2xl rounded-[24px] overflow-hidden flex flex-col",
          "w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] sm:w-full sm:max-w-[700px]",
          "top-[calc(env(safe-area-inset-top)+1rem)] sm:top-[50%] translate-y-0 sm:translate-y-[-50%]",
          "h-[calc(100dvh-2rem)] sm:h-[min(calc(100dvh-4rem),850px)]"
        )}
      >
        <div className="flex h-full min-h-0 flex-col bg-white">
          <DialogHeader className="px-6 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-4 text-left sm:pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                <Pencil className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold tracking-tight text-slate-900">
                  Edit Component
                </DialogTitle>
                <DialogDescription className="mt-0.5 text-sm text-slate-500">
                  Update details for this aircraft component. Required fields are marked with{" "}
                  <span className="text-destructive">*</span>.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleSave} className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-6 pb-6">
            <div className="space-y-6">
              <section>
                <div className="mb-3 flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                  <span className="text-xs font-semibold tracking-tight text-slate-900">Component Info</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                      Name <span className="text-destructive">*</span>
                    </label>
                    <div className="relative">
                      <Tag className="absolute left-3 top-3 h-3.5 w-3.5 text-slate-400" />
                      <Input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. 100 Hour Inspection"
                        required
                        className="h-10 rounded-xl border-slate-200 bg-white pl-9 text-base font-medium shadow-none hover:bg-slate-50 focus:ring-0"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                      Component Type <span className="text-destructive">*</span>
                    </label>
                    <Select value={componentType} onValueChange={(v) => setComponentType(v as ComponentType)}>
                      <SelectTrigger className="h-10 w-full rounded-xl border-slate-200 bg-white px-3 text-base font-medium shadow-none hover:bg-slate-50 focus:ring-0">
                        <div className="flex items-center gap-2">
                          <Settings className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <SelectValue placeholder="Select type" />
                        </div>
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-slate-200 shadow-xl">
                        {COMPONENT_TYPE_OPTIONS.map((type) => (
                          <SelectItem key={type} value={type} className="rounded-lg py-2 text-base">
                            {type.charAt(0).toUpperCase() + type.slice(1).replace("_", " ")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="mt-4 space-y-1.5">
                  <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Description</label>
                  <div className="relative">
                    <Info className="absolute left-3 top-3 h-3.5 w-3.5 text-slate-400" />
                    <Textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Add any notes or details..."
                      className="rounded-xl border-slate-200 bg-white pl-9 text-base font-medium shadow-none hover:bg-slate-50 focus:ring-0 min-h-[80px] resize-none"
                    />
                  </div>
                </div>
              </section>

              <section>
                <div className="mb-3 flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                  <span className="text-xs font-semibold tracking-tight text-slate-900">Dates & Hours</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Last Completed Hours</label>
                    <div className="relative">
                      <Clock className="absolute left-3 top-3 h-3.5 w-3.5 text-slate-400" />
                      <Input
                        type="number"
                        value={lastCompletedHours ?? ""}
                        onChange={(e) => setLastCompletedHours(e.target.value ? Number(e.target.value) : null)}
                        className="h-10 rounded-xl border-slate-200 bg-white pl-9 text-base font-medium shadow-none hover:bg-slate-50 focus:ring-0"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Last Completed Date</label>
                    <div className="relative">
                      <CalendarIcon className="pointer-events-none absolute left-3 top-3 h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <DatePicker
                        date={toYyyyMmDd(lastCompletedDate)}
                        onChange={(value) => setLastCompletedDate(value ? new Date(value) : null)}
                        className={cn(
                          "h-10 w-full rounded-xl border-slate-200 bg-white pl-9 pr-3 text-base font-medium shadow-none hover:bg-slate-50 focus:ring-0",
                          !lastCompletedDate && "text-slate-400"
                        )}
                      />
                    </div>
                    <p className="text-[10px] text-slate-500">{formatDate(lastCompletedDate)}</p>
                  </div>
                </div>

                <div className="mt-5 p-4 bg-slate-50/50 rounded-2xl border border-slate-100 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Current Due Hours</label>
                      <div className="relative">
                        <Clock className="absolute left-3 top-3 h-3.5 w-3.5 text-slate-400" />
                        <Input
                          type="number"
                          value={currentDueHours ?? ""}
                          onChange={(e) => setCurrentDueHours(e.target.value ? Number(e.target.value) : null)}
                          className="h-10 rounded-xl border-slate-200 bg-white pl-9 text-base font-medium shadow-none hover:bg-slate-50 focus:ring-0"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Current Due Date</label>
                      <div className="relative">
                        <CalendarIcon className="pointer-events-none absolute left-3 top-3 h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <DatePicker
                          date={toYyyyMmDd(currentDueDate)}
                          onChange={(value) => setCurrentDueDate(value ? new Date(value) : null)}
                          className={cn(
                            "h-10 w-full rounded-xl border-slate-200 bg-white pl-9 pr-3 text-base font-medium shadow-none hover:bg-slate-50 focus:ring-0",
                            !currentDueDate && "text-slate-400"
                          )}
                        />
                      </div>
                      <p className="text-[10px] text-slate-500">{formatDate(currentDueDate)}</p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2 pt-2">
                    <Button
                      type="button"
                      onClick={handleExtend}
                      disabled={loadingExtend || !component || component.extension_limit_hours !== null}
                      className="h-9 flex-1 rounded-xl bg-indigo-50 text-indigo-700 text-sm font-bold hover:bg-indigo-100 border-none shadow-none"
                    >
                      {loadingExtend ? (
                        <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <ArrowUpRight className="mr-2 h-3.5 w-3.5" />
                      )}
                      Extend by 10%
                    </Button>
                    {component && component.extension_limit_hours !== null && (
                      <Button
                        type="button"
                        variant="destructive"
                        disabled={revertLoading}
                        onClick={() => setShowRevertConfirm(true)}
                        className="h-9 flex-1 rounded-xl text-sm font-bold shadow-none"
                      >
                        {revertLoading ? (
                          <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <RotateCcw className="mr-2 h-3.5 w-3.5" />
                        )}
                        Revert Extension
                      </Button>
                    )}
                  </div>

                  {showRevertConfirm && (
                    <div className="p-3 bg-red-50 border border-red-100 rounded-xl space-y-2">
                      <p className="text-[10px] text-red-700 font-medium leading-relaxed">
                        Are you sure you want to revert the extension? This will restore the original due logic.
                      </p>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={handleRevertExtension}
                          disabled={revertLoading}
                          className="h-7 rounded-lg text-[10px] font-bold px-3"
                        >
                          Yes, Revert
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setShowRevertConfirm(false)}
                          disabled={revertLoading}
                          className="h-7 rounded-lg text-[10px] font-bold px-3 border-red-100 text-red-700 hover:bg-red-50 hover:text-red-800"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </section>

              <section>
                <div className="mb-3 flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                  <span className="text-xs font-semibold tracking-tight text-slate-900">Intervals</span>
                </div>
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                      Interval Type <span className="text-destructive">*</span>
                    </label>
                    <Select value={intervalType} onValueChange={(v) => setIntervalType(v as IntervalType)}>
                      <SelectTrigger className="h-10 w-full rounded-xl border-slate-200 bg-white px-3 text-base font-medium shadow-none hover:bg-slate-50 focus:ring-0">
                        <div className="flex items-center gap-2">
                          <Repeat className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <SelectValue placeholder="Select interval" />
                        </div>
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-slate-200 shadow-xl">
                        {INTERVAL_TYPE_OPTIONS.map((type) => (
                          <SelectItem key={type} value={type} className="rounded-lg py-2 text-base">
                            {type.charAt(0) + type.slice(1).toLowerCase()}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    {(intervalType === "HOURS" || intervalType === "BOTH") && (
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                          Interval Hours <span className="text-destructive">*</span>
                        </label>
                        <div className="relative">
                          <Clock className="absolute left-3 top-3 h-3.5 w-3.5 text-slate-400" />
                          <Input
                            type="number"
                            value={intervalHours ?? ""}
                            onChange={(e) => setIntervalHours(e.target.value ? Number(e.target.value) : null)}
                            placeholder="e.g. 100"
                            required={intervalType === "HOURS" || intervalType === "BOTH"}
                            className="h-10 rounded-xl border-slate-200 bg-white pl-9 text-base font-medium shadow-none hover:bg-slate-50 focus:ring-0"
                          />
                        </div>
                      </div>
                    )}
                    {(intervalType === "CALENDAR" || intervalType === "BOTH") && (
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                          Interval Days <span className="text-destructive">*</span>
                        </label>
                        <div className="relative">
                          <Calendar className="absolute left-3 top-3 h-3.5 w-3.5 text-slate-400" />
                          <Input
                            type="number"
                            value={intervalDays ?? ""}
                            onChange={(e) => setIntervalDays(e.target.value ? Number(e.target.value) : null)}
                            placeholder="e.g. 365"
                            required={intervalType === "CALENDAR" || intervalType === "BOTH"}
                            className="h-10 rounded-xl border-slate-200 bg-white pl-9 text-base font-medium shadow-none hover:bg-slate-50 focus:ring-0"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </section>

              <section>
                <div className="mb-3 flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                  <span className="text-xs font-semibold tracking-tight text-slate-900">Status & Priority</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                      Status <span className="text-destructive">*</span>
                    </label>
                    <Select value={status} onValueChange={(v) => setStatus(v as ComponentStatus)}>
                      <SelectTrigger className="h-10 w-full rounded-xl border-slate-200 bg-white px-3 text-base font-medium shadow-none hover:bg-slate-50 focus:ring-0">
                        <div className="flex items-center gap-2">
                          <Settings className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <SelectValue placeholder="Select status" />
                        </div>
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-slate-200 shadow-xl">
                        {STATUS_OPTIONS.map((statusOption) => (
                          <SelectItem key={statusOption} value={statusOption} className="rounded-lg py-2 text-base">
                            {statusOption.charAt(0).toUpperCase() + statusOption.slice(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Priority</label>
                    <Select value={priority || ""} onValueChange={(v) => setPriority(v)}>
                      <SelectTrigger className="h-10 w-full rounded-xl border-slate-200 bg-white px-3 text-base font-medium shadow-none hover:bg-slate-50 focus:ring-0">
                        <div className="flex items-center gap-2">
                          <Tag className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <SelectValue placeholder="Select priority" />
                        </div>
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-slate-200 shadow-xl">
                        {PRIORITY_OPTIONS.map((p) => (
                          <SelectItem key={p} value={p} className="rounded-lg py-2 text-base">
                            {p.charAt(0) + p.slice(1).toLowerCase()}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </section>

              <section>
                <div className="mb-3 flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                  <span className="text-xs font-semibold tracking-tight text-slate-900">Notes & Remarks</span>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Internal Notes</label>
                  <div className="relative">
                    <FileText className="absolute left-3 top-3 h-3.5 w-3.5 text-slate-400" />
                    <Textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Any additional notes..."
                      className="rounded-xl border-slate-200 bg-white pl-9 text-base font-medium shadow-none hover:bg-slate-50 focus:ring-0 min-h-[100px] resize-none"
                    />
                  </div>
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
                className="h-10 flex-1 rounded-xl border-slate-200 text-sm font-bold shadow-none hover:bg-slate-50"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                onClick={handleSave}
                disabled={!component}
                className="h-10 flex-[1.4] rounded-xl bg-slate-900 text-sm font-bold text-white shadow-lg shadow-slate-900/10 hover:bg-slate-800"
              >
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default ComponentEditModal
