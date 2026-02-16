import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import type { AircraftWithType } from "@/lib/types/aircraft"
import type { AircraftComponentsRow } from "@/lib/types/tables"
import { formatDate } from "@/components/aircraft/aircraft-detail-utils"

type Props = {
  components: AircraftComponentsRow[]
  aircraft: AircraftWithType
}

export function AircraftMaintenanceItemsTab({ components, aircraft }: Props) {
  if (!components.length) {
    return <p className="text-muted-foreground text-sm">No maintenance items found.</p>
  }

  return (
    <div className="space-y-3">
      {components.map((component) => {
        const dueByHours =
          component.current_due_hours !== null &&
          component.current_due_hours !== undefined &&
          aircraft.total_time_in_service >= component.current_due_hours

        const dueByDate =
          component.current_due_date !== null &&
          component.current_due_date !== undefined &&
          new Date(component.current_due_date) < new Date()

        const overdue = dueByHours || dueByDate

        return (
          <Card key={component.id} className="py-4">
            <CardContent className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">{component.name}</p>
                <Badge variant="outline" className="capitalize">
                  {component.status}
                </Badge>
                {overdue ? (
                  <Badge className="border-0 bg-red-100 text-red-700">Overdue</Badge>
                ) : null}
              </div>
              <p className="text-muted-foreground text-sm">
                Due Date: {formatDate(component.current_due_date)} • Due Hours: {component.current_due_hours ?? "—"}
              </p>
              <p className="text-muted-foreground text-xs capitalize">
                Interval: {component.interval_type}
                {component.interval_days ? ` • ${component.interval_days} days` : ""}
                {component.interval_hours ? ` • ${component.interval_hours} hours` : ""}
              </p>
              {component.notes ? <p className="text-sm">{component.notes}</p> : null}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
