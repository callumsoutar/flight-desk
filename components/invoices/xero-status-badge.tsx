"use client"

import { Badge } from "@/components/ui/badge"
import type { Database } from "@/lib/types"

type XeroStatus = Database["public"]["Enums"]["xero_export_status"] | null | undefined

export function XeroStatusBadge({ status }: { status: XeroStatus }) {
  if (!status) return <span className="text-muted-foreground">-</span>

  if (status === "exported") {
    return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Exported</Badge>
  }

  if (status === "pending") {
    return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Pending</Badge>
  }

  if (status === "voided") {
    return <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100">Voided</Badge>
  }

  return <Badge variant="destructive">Failed</Badge>
}
