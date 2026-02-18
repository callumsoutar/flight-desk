import type { ObservationWithUsers } from "@/lib/types/aircraft-detail"
import { AircraftObservationsTable } from "@/components/aircraft/aircraft-observations-table"

type Props = {
  aircraftId: string
  observations: ObservationWithUsers[]
}

export function AircraftObservationsTab({ aircraftId, observations }: Props) {
  return <AircraftObservationsTable aircraftId={aircraftId} observations={observations} />
}
