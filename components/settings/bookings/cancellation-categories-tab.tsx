"use client"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CancellationCategoriesConfig } from "@/components/settings/bookings/cancellation-categories-config"

export function CancellationCategoriesTab() {
  return (
    <Card className="border border-border/50 bg-card shadow-sm overflow-hidden rounded-2xl">
      <CardHeader className="border-b border-border/40">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg text-slate-900">Cancellation categories</CardTitle>
            <CardDescription>
              Manage global and custom cancellation reasons used across bookings.
            </CardDescription>
          </div>
          <Badge variant="outline" className="border-slate-200 text-slate-600">
            Categories
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <CancellationCategoriesConfig showHeader={false} />
      </CardContent>
    </Card>
  )
}
