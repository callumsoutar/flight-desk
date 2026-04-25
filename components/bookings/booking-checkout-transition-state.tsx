"use client"

import { Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"

export function BookingCheckoutTransitionState({
  overlay = false,
  message = "Checking flight out...",
}: {
  overlay?: boolean
  message?: string
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-center px-4 py-6 sm:px-6",
        overlay
          ? "fixed inset-0 z-50 bg-slate-950/18 backdrop-blur-md"
          : "flex-1 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.55),_rgba(241,245,249,0.9)_42%,_rgba(226,232,240,0.95))] py-10 lg:px-8"
      )}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div
        className={cn(
          "inline-flex items-center gap-3 rounded-full bg-white/72 px-5 py-3 text-sm font-medium text-slate-900 shadow-[0_20px_60px_-24px_rgba(15,23,42,0.55)] ring-1 ring-white/65 backdrop-blur-xl",
          overlay && "bg-white/68 shadow-[0_24px_80px_-28px_rgba(15,23,42,0.7)]"
        )}
      >
        <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin text-slate-500" />
        <p>{message}</p>
      </div>
    </div>
  )
}
