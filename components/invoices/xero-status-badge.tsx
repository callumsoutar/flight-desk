"use client"

import { CheckCircle2, XCircle } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import type { Database } from "@/lib/types"

type XeroStatus = Database["public"]["Enums"]["xero_export_status"] | null | undefined

export function XeroStatusBadge({ status }: { status: XeroStatus }) {
  if (!status) return <span className="text-muted-foreground">-</span>

  if (status === "exported") {
    return (
      <span className="inline-flex items-center gap-1 text-emerald-600">
        <CheckCircle2 className="h-4 w-4" />
        <span className="text-xs font-medium">Exported</span>
      </span>
    )
  }

  if (status === "failed") {
    return (
      <span className="inline-flex items-center gap-1 text-red-600">
        <XCircle className="h-4 w-4" />
        <span className="text-xs font-medium">Failed</span>
      </span>
    )
  }

  if (status === "pending") {
    return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Pending</Badge>
  }

  if (status === "voided") {
    return <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100">Voided</Badge>
  }

  return null
}
