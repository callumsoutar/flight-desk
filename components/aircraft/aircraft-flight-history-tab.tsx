import { Card, CardContent } from "@/components/ui/card"
import type { FlightEntry } from "@/lib/types/aircraft-detail"
import {
  flightInstructorName,
  formatDateTime,
  formatTotalHours,
  personName,
} from "@/components/aircraft/aircraft-detail-utils"

type Props = {
  flights: FlightEntry[]
}

export function AircraftFlightHistoryTab({ flights }: Props) {
  if (!flights.length) {
    return <p className="text-muted-foreground text-sm">No flights found for this aircraft.</p>
  }

  return (
    <div className="space-y-3">
      {flights.map((flight) => (
        <Card key={flight.id} className="py-4">
          <CardContent className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium capitalize">{flight.status}</p>
              <p className="text-muted-foreground text-sm">
                {formatDateTime(flight.start_time)} - {formatDateTime(flight.end_time)}
              </p>
            </div>
            <p className="text-sm">{flight.purpose}</p>
            <p className="text-muted-foreground text-xs">
              Student: {personName(flight.student)} • Instructor: {flightInstructorName(flight)}
            </p>
            <p className="text-muted-foreground text-xs">
              Flight Time: {formatTotalHours(flight.flight_time)}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
