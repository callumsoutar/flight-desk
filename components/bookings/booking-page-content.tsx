"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

export function BookingPageContent({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return <div className={cn("mx-auto w-full max-w-7xl", className)}>{children}</div>
}
