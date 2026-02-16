import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import type { ObservationWithUsers } from "@/lib/types/aircraft-detail"
import { formatDate, personName } from "@/components/aircraft/aircraft-detail-utils"

type Props = {
  observations: ObservationWithUsers[]
}

export function AircraftObservationsTab({ observations }: Props) {
  if (!observations.length) {
    return <p className="text-muted-foreground text-sm">No observations found.</p>
  }

  return (
    <div className="space-y-3">
      {observations.map((observation) => (
        <Card key={observation.id} className="py-4">
          <CardContent className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium">{observation.name}</p>
              <Badge variant="outline" className="capitalize">
                {observation.stage}
              </Badge>
              {observation.priority ? (
                <Badge variant="secondary" className="capitalize">
                  {observation.priority}
                </Badge>
              ) : null}
            </div>
            <p className="text-muted-foreground text-sm">
              Reported by {personName(observation.reported_by_user)} on {formatDate(observation.reported_date)}
            </p>
            {observation.assigned_to_user ? (
              <p className="text-muted-foreground text-xs">
                Assigned to {personName(observation.assigned_to_user)}
              </p>
            ) : null}
            {observation.description ? <p className="text-sm">{observation.description}</p> : null}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
