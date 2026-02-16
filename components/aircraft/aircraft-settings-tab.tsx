import { Card, CardContent } from "@/components/ui/card"
import type { AircraftWithType } from "@/lib/types/aircraft"
import { formatTotalHours } from "@/components/aircraft/aircraft-detail-utils"

type Props = {
  aircraft: AircraftWithType
  aircraftId: string
}

export function AircraftSettingsTab({ aircraft, aircraftId }: Props) {
  return (
    <Card className="py-4">
      <CardContent className="grid gap-3 sm:grid-cols-2">
        <div>
          <p className="text-muted-foreground text-xs uppercase">Aircraft ID</p>
          <p className="text-sm">{aircraftId}</p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs uppercase">Registration</p>
          <p className="text-sm">{aircraft.registration}</p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs uppercase">Online</p>
          <p className="text-sm">{aircraft.on_line ? "Yes" : "No"}</p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs uppercase">Status</p>
          <p className="text-sm capitalize">{aircraft.status ?? "—"}</p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs uppercase">Record Hobbs</p>
          <p className="text-sm">{aircraft.record_hobbs ? "Yes" : "No"}</p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs uppercase">Record Tacho</p>
          <p className="text-sm">{aircraft.record_tacho ? "Yes" : "No"}</p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs uppercase">Record Airswitch</p>
          <p className="text-sm">{aircraft.record_airswitch ? "Yes" : "No"}</p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs uppercase">Total Time Method</p>
          <p className="text-sm capitalize">{aircraft.total_time_method ?? "—"}</p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs uppercase">Total Time in Service</p>
          <p className="text-sm">{formatTotalHours(aircraft.total_time_in_service)}</p>
        </div>
      </CardContent>
    </Card>
  )
}
