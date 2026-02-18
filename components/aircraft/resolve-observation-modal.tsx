"use client"

import React, { useEffect, useState } from "react"
import { Calendar, CheckCircle2, FileText, Info } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import type { ObservationWithUser } from "@/lib/types/observations"
import { toast } from "sonner"

type ResolveObservationModalProps = {
  open: boolean
  onClose: () => void
  observationId: string
  refresh: () => void
}

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

export function ResolveObservationModal({
  open,
  onClose,
  observationId,
  refresh,
}: ResolveObservationModalProps) {
  const [observation, setObservation] = useState<ObservationWithUser | null>(null)
  const [loadingObs, setLoadingObs] = useState(false)
  const [resolutionComments, setResolutionComments] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !observationId) return
    setLoadingObs(true)
    fetch(`/api/observations?id=${observationId}`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("Failed to fetch observation"))))
      .then((data: ObservationWithUser) => {
        setObservation(data)
        setResolutionComments(data.resolution_comments || "")
      })
      .catch(() => setObservation(null))
      .finally(() => setLoadingObs(false))
  }, [open, observationId])

  const handleResolve = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!resolutionComments.trim()) {
      setError("Resolution comments are required")
      return
    }

    setLoading(true)
    try {
      const response = await fetch("/api/observations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: observationId,
          stage: "closed",
          resolution_comments: resolutionComments.trim(),
          resolved_at: new Date().toISOString(),
        }),
      })

      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string }
        throw new Error(data.error || "Failed to resolve observation")
      }

      toast.success("Observation resolved successfully")
      setResolutionComments("")
      onClose()
      refresh()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to resolve observation"
      setError(errorMessage)
      toast.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent
        className={cn(
          "top-[calc(env(safe-area-inset-top)+1rem)] h-[calc(100dvh-2rem)] max-w-[calc(100vw-1rem)] translate-y-0 overflow-hidden rounded-[20px] border-none p-0 shadow-2xl sm:top-[50%] sm:h-auto sm:max-h-[calc(100dvh-4rem)] sm:w-full sm:max-w-[640px] sm:translate-y-[-50%]"
        )}
      >
        <div className="flex h-full min-h-0 flex-col bg-white">
          <DialogHeader className="px-5 pt-[calc(1.25rem+env(safe-area-inset-top))] pb-3 text-left sm:pt-5">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-50 text-green-600">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold tracking-tight text-slate-900">
                  Resolve Observation
                </DialogTitle>
                <DialogDescription className="mt-0.5 text-sm text-slate-500">
                  Mark this observation as resolved.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {loadingObs ? (
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5">
              <div className="space-y-4">
                <Skeleton className="h-20 w-full rounded-xl" />
                <Skeleton className="h-32 w-full rounded-xl" />
              </div>
            </div>
          ) : observation ? (
            <form onSubmit={handleResolve} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5">
              <div className="space-y-4">
                <section>
                  <div className="mb-2 flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                    <span className="text-xs font-semibold tracking-tight text-slate-900">Observation Details</span>
                  </div>
                  <div className="space-y-2 rounded-xl border border-slate-100 bg-slate-50/50 p-3.5">
                    <div>
                      <div className="mb-1 text-[9px] font-bold tracking-wider text-slate-400 uppercase">Title</div>
                      <div className="text-base font-semibold text-slate-900">{observation.name}</div>
                    </div>
                    {observation.description ? (
                      <div>
                        <div className="mb-1 text-[9px] font-bold tracking-wider text-slate-400 uppercase">Description</div>
                        <div className="text-sm leading-relaxed text-slate-600">{observation.description}</div>
                      </div>
                    ) : null}
                    <div className="border-slate-200 pt-2">
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <Calendar className="h-3.5 w-3.5" />
                        <span>Created {formatDate(observation.created_at)}</span>
                      </div>
                    </div>
                  </div>
                </section>

                <section>
                  <div className="mb-2 flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                    <span className="text-xs font-semibold tracking-tight text-slate-900">Resolution Details</span>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold tracking-wider text-slate-400 uppercase">
                      Resolution Comments <span className="text-destructive">*</span>
                    </label>
                    <div className="relative">
                      <FileText className="absolute top-3 left-3 h-3.5 w-3.5 text-slate-400" />
                      <Textarea
                        value={resolutionComments}
                        onChange={(e) => setResolutionComments(e.target.value)}
                        placeholder="Describe how this observation was resolved..."
                        rows={4}
                        required
                        autoFocus
                        className="min-h-[104px] resize-none rounded-xl border-slate-200 bg-white pl-9 text-base font-medium shadow-none hover:bg-slate-50 focus:ring-0"
                      />
                    </div>
                  </div>
                </section>

                {error ? (
                  <div className="flex items-center gap-3 rounded-xl border border-destructive/10 bg-destructive/5 p-3 text-destructive">
                    <Info className="h-4 w-4 shrink-0" />
                    <p className="text-sm font-medium">{error}</p>
                  </div>
                ) : null}
              </div>
            </form>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
              <div className="mb-4 rounded-full bg-red-50 p-4 text-red-600 ring-1 ring-red-200">
                <Info className="h-8 w-8" />
              </div>
              <div className="mb-2 text-lg font-bold text-red-600">Observation not found</div>
              <div className="text-center text-sm text-slate-500">
                The requested observation could not be loaded.
              </div>
            </div>
          )}

          {!loadingObs && observation ? (
            <div className="border-t bg-white px-5 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-[0_-4px_12px_rgba(0,0,0,0.05)] sm:pb-3">
              <div className="flex items-center justify-between gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  disabled={loading}
                  className="h-10 flex-1 rounded-xl border-slate-200 text-sm font-bold shadow-none hover:bg-slate-50"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  onClick={handleResolve}
                  disabled={loading || !resolutionComments.trim()}
                  className="h-10 flex-[1.4] rounded-xl bg-green-600 text-sm font-bold text-white shadow-lg shadow-green-600/10 hover:bg-green-700"
                >
                  {loading ? "Resolving..." : "Resolve Observation"}
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
