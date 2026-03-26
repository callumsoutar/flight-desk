"use client"

import { useQuery } from "@tanstack/react-query"

import type { EquipmentWithIssuance } from "@/lib/types/equipment"

type EquipmentQueryResponse = {
  equipment?: EquipmentWithIssuance[]
  error?: string
}

export function equipmentQueryKey() {
  return ["equipment", "list"] as const
}

function getEquipmentErrorMessage(payload: unknown, fallback: string) {
  return payload && typeof payload === "object" && typeof (payload as { error?: unknown }).error === "string"
    ? (payload as { error: string }).error
    : fallback
}

export async function fetchEquipmentQuery(): Promise<EquipmentWithIssuance[]> {
  const response = await fetch("/api/equipment", {
    method: "GET",
    cache: "no-store",
    headers: { "cache-control": "no-store" },
  })
  const payload = (await response.json().catch(() => null)) as EquipmentQueryResponse | null

  if (!response.ok) {
    throw new Error(payload?.error || "Failed to fetch equipment")
  }

  return Array.isArray(payload?.equipment) ? payload.equipment : []
}

export async function createEquipment(input: {
  name: string
  label?: string | null
  type: EquipmentWithIssuance["type"]
  status: EquipmentWithIssuance["status"]
  serial_number?: string | null
  location?: string | null
  notes?: string | null
  year_purchased?: number
}) {
  const response = await fetch("/api/equipment", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  const payload = (await response.json().catch(() => ({}))) as {
    error?: string
    equipment?: EquipmentWithIssuance
  }

  if (!response.ok || !payload.equipment) {
    throw new Error(getEquipmentErrorMessage(payload, "Failed to add equipment"))
  }

  return payload.equipment
}

export function useEquipmentQuery(initialData: EquipmentWithIssuance[]) {
  return useQuery({
    queryKey: equipmentQueryKey(),
    queryFn: fetchEquipmentQuery,
    initialData,
    staleTime: 30_000,
  })
}
