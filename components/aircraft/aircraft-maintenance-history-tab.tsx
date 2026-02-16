import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import type { MaintenanceVisitWithUser } from "@/lib/types/aircraft-detail"
import { formatDate, formatTotalHours, personName } from "@/components/aircraft/aircraft-detail-utils"

type Props = {
  maintenanceVisits: MaintenanceVisitWithUser[]
}

export function AircraftMaintenanceHistoryTab({ maintenanceVisits }: Props) {
  if (!maintenanceVisits.length) {
    return <p className="text-muted-foreground text-sm">No maintenance visits found.</p>
  }

  return (
    <div className="space-y-3">
      {maintenanceVisits.map((visit) => (
        <Card key={visit.id} className="py-4">
          <CardContent className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium">{visit.description}</p>
              <Badge variant="outline" className="capitalize">
                {visit.visit_type}
              </Badge>
            </div>
            <p className="text-muted-foreground text-sm">
              {formatDate(visit.visit_date)} • Performed by {personName(visit.performed_by_user)}
            </p>
            <p className="text-muted-foreground text-xs">
              Hours at Visit: {formatTotalHours(visit.hours_at_visit)} • Next Due: {formatDate(visit.next_due_date)} / {visit.next_due_hours ?? "—"}h
            </p>
            {visit.notes ? <p className="text-sm">{visit.notes}</p> : null}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
