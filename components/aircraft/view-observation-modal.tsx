"use client"

import React, { useEffect, useState } from "react"
import {
  AlertTriangle,
  Calendar,
  Eye,
  FileText,
  Info,
  Loader2,
  Tag,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import type {
  ObservationPriority,
  ObservationStage,
  ObservationWithUser,
} from "@/lib/types/observations"
import { toast } from "sonner"

const OBSERVATION_PRIORITIES: ObservationPriority[] = ["low", "medium", "high"]
const OBSERVATION_STAGES: ObservationStage[] = ["open", "investigation", "resolution", "closed"]

function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return "—"
  const parsed = new Date(dateString)
  if (Number.isNaN(parsed.getTime())) return "—"
  return parsed.toLocaleDateString("en-NZ", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

const getPriorityColor = (priority: string): string => {
  switch (priority) {
    case "low":
      return "bg-green-100 text-green-800 border-green-200"
    case "medium":
      return "bg-yellow-100 text-yellow-800 border-yellow-200"
    case "high":
      return "bg-red-100 text-red-800 border-red-200"
    default:
      return "bg-gray-100 text-gray-800 border-gray-200"
  }
}

const getStageColor = (stage: ObservationStage): string => {
  switch (stage) {
    case "open":
      return "bg-blue-100 text-blue-800 border-blue-200"
    case "investigation":
      return "bg-orange-100 text-orange-800 border-orange-200"
    case "resolution":
      return "bg-purple-100 text-purple-800 border-purple-200"
    case "closed":
      return "bg-gray-100 text-gray-800 border-gray-200"
    default:
      return "bg-gray-100 text-gray-800 border-gray-200"
  }
}

type ViewObservationModalProps = {
  open: boolean
  onClose: () => void
  observationId: string
  refresh?: () => void
}

export function ViewObservationModal({
  open,
  onClose,
  observationId,
  refresh,
}: ViewObservationModalProps) {
  const [observation, setObservation] = useState<ObservationWithUser | null>(null)
  const [loadingObs, setLoadingObs] = useState(false)

  const [editName, setEditName] = useState("")
  const [editDescription, setEditDescription] = useState("")
  const [editPriority, setEditPriority] = useState<ObservationPriority>("medium")
  const [editStage, setEditStage] = useState<ObservationStage>("open")
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  useEffect(() => {
    if (observation) {
      setEditName(observation.name)
      setEditDescription(observation.description || "")
      const normalizedPriority = (observation.priority || "medium").toLowerCase().trim() as ObservationPriority
      setEditPriority(
        OBSERVATION_PRIORITIES.includes(normalizedPriority) ? normalizedPriority : "medium"
      )
      const normalizedStage = (observation.stage || "open").toLowerCase().trim() as ObservationStage
      setEditStage(OBSERVATION_STAGES.includes(normalizedStage) ? normalizedStage : "open")
    }
  }, [observation])

  useEffect(() => {
    if (!open || !observationId) return
    setLoadingObs(true)
    fetch(`/api/observations?id=${observationId}`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("Failed to fetch observation"))))
      .then((data: ObservationWithUser) => setObservation(data))
      .catch(() => setObservation(null))
      .finally(() => setLoadingObs(false))
  }, [open, observationId])

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault()
    setEditError(null)
    if (!editName || !editStage) {
      setEditError("Name and Stage are required.")
      return
    }

    setEditLoading(true)
    const payload = {
      id: observationId,
      name: editName.trim(),
      description: editDescription.trim() || null,
      priority: editPriority,
      stage: editStage,
    }

    try {
      const res = await fetch("/api/observations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(data.error || "Failed to update observation")
      }

      const updated = await fetch(`/api/observations?id=${observationId}`, { cache: "no-store" }).then((response) =>
        response.ok ? (response.json() as Promise<ObservationWithUser>) : null
      )
      setObservation(updated)
      toast.success("Observation changes saved.")
      refresh?.()
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to update observation"
      setEditError(errorMsg)
      toast.error(errorMsg)
    } finally {
      setEditLoading(false)
    }
  }

  const getUserName = (user: ObservationWithUser["reported_by_user"]) => {
    if (!user) return "Unknown"
    const name = [user.first_name, user.last_name].filter(Boolean).join(" ")
    return name || user.email || "Unknown"
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent
        className={cn(
          "w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] top-[calc(env(safe-area-inset-top)+1rem)] h-[calc(100dvh-2rem)] translate-y-0 overflow-hidden rounded-[20px] border-none p-0 shadow-2xl sm:top-[50%] sm:h-[min(calc(100dvh-4rem),700px)] sm:w-full sm:max-w-[700px] sm:translate-y-[-50%]"
        )}
      >
        <div className="flex h-full min-h-0 flex-col bg-white">
          <DialogHeader className="px-5 pt-[calc(1.25rem+env(safe-area-inset-top))] pb-3 text-left sm:pt-5">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-50 text-orange-600">
                <Eye className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <DialogTitle className="text-xl font-bold tracking-tight text-slate-900">
                  Observation Details
                </DialogTitle>
                <DialogDescription className="mt-0.5 text-sm text-slate-500">
                  View and manage observation information.
                </DialogDescription>
              </div>
              {observation ? (
                <div className="hidden items-center gap-2 sm:flex">
                  <Badge
                    className={cn(
                      getStageColor(observation.stage),
                      "rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase"
                    )}
                  >
                    {observation.stage}
                  </Badge>
                  <Badge
                    className={cn(
                      getPriorityColor(observation.priority || "medium"),
                      "rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase"
                    )}
                  >
                    {observation.priority || "medium"}
                  </Badge>
                </div>
              ) : null}
            </div>
            {observation ? (
              <div className="mt-3 flex items-center gap-4 text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  Created {formatDate(observation.created_at)}
                </div>
                {observation.reported_by_user ? (
                  <div className="flex items-center gap-1.5">
                    <Info className="h-3.5 w-3.5" />
                    Reported by {getUserName(observation.reported_by_user)}
                  </div>
                ) : null}
              </div>
            ) : null}
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5">
            {loadingObs ? (
              <div className="space-y-6">
                <section>
                  <Skeleton className="mb-3 h-4 w-24" />
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <Skeleton className="h-10 w-full rounded-xl" />
                    <Skeleton className="h-10 w-full rounded-xl" />
                  </div>
                </section>
                <section>
                  <Skeleton className="mb-3 h-4 w-24" />
                  <Skeleton className="h-24 w-full rounded-xl" />
                </section>
              </div>
            ) : observation ? (
              <form id="observation-form" onSubmit={handleSaveEdit} className="space-y-4">
                <section>
                  <div className="mb-2 flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-orange-500" />
                    <span className="text-xs font-semibold tracking-tight text-slate-900">Observation Info</span>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-bold tracking-wider text-slate-400 uppercase">
                        Name <span className="text-destructive">*</span>
                      </label>
                      <div className="relative">
                        <Tag className="absolute top-3 left-3 h-3.5 w-3.5 text-slate-400" />
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          required
                          placeholder="Enter observation name..."
                          className="h-10 rounded-xl border-slate-200 bg-white pl-9 text-base font-medium shadow-none hover:bg-slate-50 focus:ring-0"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-bold tracking-wider text-slate-400 uppercase">
                          Priority Level <span className="text-destructive">*</span>
                        </label>
                        <Select value={editPriority || "medium"} onValueChange={(val) => setEditPriority(val as ObservationPriority)}>
                          <SelectTrigger className="h-10 w-full rounded-xl border-slate-200 bg-white px-3 text-base font-medium shadow-none hover:bg-slate-50 focus:ring-0">
                            <div className="flex items-center gap-2">
                              <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                              <SelectValue />
                            </div>
                          </SelectTrigger>
                          <SelectContent className="rounded-xl border-slate-200 shadow-xl">
                            {OBSERVATION_PRIORITIES.map((value) => (
                              <SelectItem key={value} value={value} className="rounded-lg py-2 text-base capitalize">
                                {value}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[9px] font-bold tracking-wider text-slate-400 uppercase">
                          Stage <span className="text-destructive">*</span>
                        </label>
                        <Select value={editStage || "open"} onValueChange={(val) => setEditStage(val as ObservationStage)}>
                          <SelectTrigger className="h-10 w-full rounded-xl border-slate-200 bg-white px-3 text-base font-medium shadow-none hover:bg-slate-50 focus:ring-0">
                            <div className="flex items-center gap-2">
                              <Info className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                              <SelectValue />
                            </div>
                          </SelectTrigger>
                          <SelectContent className="rounded-xl border-slate-200 shadow-xl">
                            {OBSERVATION_STAGES.map((value) => (
                              <SelectItem key={value} value={value} className="rounded-lg py-2 text-base capitalize">
                                {value}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[9px] font-bold tracking-wider text-slate-400 uppercase">Description</label>
                      <div className="relative">
                        <FileText className="absolute top-3 left-3 h-3.5 w-3.5 text-slate-400" />
                        <Textarea
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          placeholder="Provide additional details about this observation..."
                          className="min-h-[96px] resize-none rounded-xl border-slate-200 bg-white pl-9 text-base font-medium shadow-none hover:bg-slate-50 focus:ring-0"
                        />
                      </div>
                    </div>
                  </div>
                </section>

                {editError ? (
                  <div className="flex items-start gap-3 rounded-2xl border border-red-100 bg-red-50/50 p-4">
                    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
                    <div className="text-sm font-medium text-red-800">{editError}</div>
                  </div>
                ) : null}
              </form>
            ) : (
              <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 py-12 text-center">
                <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
                  <AlertTriangle className="h-6 w-6" />
                </div>
                <div className="font-bold text-slate-900">Observation not found</div>
                <div className="mt-1 text-sm text-slate-500">
                  The requested observation could not be loaded.
                </div>
              </div>
            )}
          </div>

          <div className="border-t bg-white px-5 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-[0_-4px_12px_rgba(0,0,0,0.05)] sm:pb-3">
            <div className="flex items-center justify-between gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="h-10 flex-1 rounded-xl border-slate-200 text-sm font-bold shadow-none hover:bg-slate-50"
              >
                Close
              </Button>
              {observation ? (
                <Button
                  form="observation-form"
                  type="submit"
                  disabled={editLoading || !editName || !editStage}
                  className="h-10 flex-[1.4] rounded-xl bg-slate-900 text-sm font-bold text-white shadow-lg shadow-slate-900/10 hover:bg-slate-800"
                >
                  {editLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
