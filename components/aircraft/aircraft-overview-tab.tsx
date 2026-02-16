import { Card, CardContent } from "@/components/ui/card"
import type { AircraftWithType } from "@/lib/types/aircraft"
import type { AircraftComponentsRow } from "@/lib/types/tables"
import type { FlightEntry, ObservationWithUsers } from "@/lib/types/aircraft-detail"
import { formatTotalHours } from "@/components/aircraft/aircraft-detail-utils"

type Props = {
  aircraft: AircraftWithType
  flights: FlightEntry[]
  observations: ObservationWithUsers[]
  components: AircraftComponentsRow[]
  activeObservations: number
  overdueComponents: number
}

export function AircraftOverviewTab({
  aircraft,
  flights,
  observations,
  components,
  activeObservations,
  overdueComponents,
}: Props) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="py-4">
          <CardContent>
            <p className="text-muted-foreground text-xs uppercase">Flights</p>
            <p className="text-2xl font-semibold">{flights.length}</p>
          </CardContent>
        </Card>
        <Card className="py-4">
          <CardContent>
            <p className="text-muted-foreground text-xs uppercase">Open Observations</p>
            <p className="text-2xl font-semibold">{activeObservations}</p>
          </CardContent>
        </Card>
        <Card className="py-4">
          <CardContent>
            <p className="text-muted-foreground text-xs uppercase">Maintenance Items</p>
            <p className="text-2xl font-semibold">{components.length}</p>
          </CardContent>
        </Card>
        <Card className="py-4">
          <CardContent>
            <p className="text-muted-foreground text-xs uppercase">Overdue Components</p>
            <p className="text-2xl font-semibold">{overdueComponents}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="py-4">
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-muted-foreground text-xs uppercase">Manufacturer</p>
            <p className="text-sm">{aircraft.manufacturer ?? "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs uppercase">Year</p>
            <p className="text-sm">{aircraft.year_manufactured ?? "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs uppercase">Aircraft Type</p>
            <p className="text-sm">{aircraft.aircraft_type?.name ?? aircraft.type}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs uppercase">Total Hours</p>
            <p className="text-sm">{formatTotalHours(aircraft.total_time_in_service)}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs uppercase">Current Hobbs</p>
            <p className="text-sm">{formatTotalHours(aircraft.current_hobbs)}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs uppercase">Current Tach</p>
            <p className="text-sm">{formatTotalHours(aircraft.current_tach)}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs uppercase">Resolved Observations</p>
            <p className="text-sm">{Math.max(0, observations.length - activeObservations)}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
