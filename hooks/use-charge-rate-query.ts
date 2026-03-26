"use client"

import { useQuery } from "@tanstack/react-query"

export type ChargeRate = {
  id: string
  rate_per_hour: number | string
  charge_hobbs: boolean
  charge_tacho: boolean
  charge_airswitch: boolean
}

type ChargeRateScope = "aircraft" | "instructor"

type UseChargeRateQueryParams = {
  scope: ChargeRateScope
  resourceId: string | null
  flightTypeId: string | null
}

function chargeRateQueryKey({ scope, resourceId, flightTypeId }: UseChargeRateQueryParams) {
  return ["charge-rate", scope, resourceId ?? "", flightTypeId ?? ""] as const
}

async function fetchChargeRate({
  scope,
  resourceId,
  flightTypeId,
}: {
  scope: ChargeRateScope
  resourceId: string
  flightTypeId: string
}): Promise<ChargeRate | null> {
  const query = new URLSearchParams({
    [scope === "aircraft" ? "aircraft_id" : "instructor_id"]: resourceId,
    flight_type_id: flightTypeId,
  })

  try {
    const response = await fetch(
      `/api/${scope === "aircraft" ? "aircraft-charge-rates" : "instructor-charge-rates"}?${query.toString()}`,
      { cache: "no-store" }
    )
    if (!response.ok) return null

    const data = (await response.json().catch(() => null)) as { charge_rate?: ChargeRate | null } | null
    return data?.charge_rate ?? null
  } catch {
    return null
  }
}

export function useChargeRateQuery({ scope, resourceId, flightTypeId }: UseChargeRateQueryParams) {
  return useQuery({
    queryKey: chargeRateQueryKey({ scope, resourceId, flightTypeId }),
    queryFn: () => fetchChargeRate({ scope, resourceId: resourceId!, flightTypeId: flightTypeId! }),
    enabled: Boolean(resourceId && flightTypeId),
    staleTime: 60 * 1000,
  })
}
