"use client"

import { useQuery } from "@tanstack/react-query"

import type { EquipmentIssuance, EquipmentRow, EquipmentUpdate } from "@/lib/types"

type EquipmentDetailQueryData = {
  equipment: EquipmentRow
  issuances: EquipmentIssuance[]
  issuanceUserMap: Record<string, string>
  updates: EquipmentUpdate[]
  updatesUserMap: Record<string, string>
}

type EquipmentResponse = {
  equipment?: EquipmentRow
  error?: string
}

type EquipmentIssuanceResponse = {
  issuances?: EquipmentIssuance[]
  userMap?: Record<string, string>
  error?: string
}

type EquipmentUpdatesResponse = {
  updates?: EquipmentUpdate[]
  userMap?: Record<string, string>
  error?: string
}

export function equipmentDetailQueryKey(equipmentId: string) {
  return ["equipment", "detail", equipmentId] as const
}

function getEquipmentDetailErrorMessage(payload: unknown, fallback: string) {
  return payload && typeof payload === "object" && typeof (payload as { error?: unknown }).error === "string"
    ? (payload as { error: string }).error
    : fallback
}

async function fetchEquipmentDetail(equipmentId: string): Promise<EquipmentDetailQueryData> {
  const [equipmentResponse, issuanceResponse, updatesResponse] = await Promise.all([
    fetch(`/api/equipment/${equipmentId}`, {
      method: "GET",
      cache: "no-store",
      headers: { "cache-control": "no-store" },
    }),
    fetch(`/api/equipment-issuance?equipmentId=${encodeURIComponent(equipmentId)}`, {
      method: "GET",
      cache: "no-store",
      headers: { "cache-control": "no-store" },
    }),
    fetch(`/api/equipment-updates?equipmentId=${encodeURIComponent(equipmentId)}`, {
      method: "GET",
      cache: "no-store",
      headers: { "cache-control": "no-store" },
    }),
  ])

  const equipmentPayload = (await equipmentResponse
    .json()
    .catch(() => null)) as EquipmentResponse | null
  const issuancePayload = (await issuanceResponse
    .json()
    .catch(() => null)) as EquipmentIssuanceResponse | null
  const updatesPayload = (await updatesResponse
    .json()
    .catch(() => null)) as EquipmentUpdatesResponse | null

  if (!equipmentResponse.ok || !equipmentPayload?.equipment) {
    throw new Error(equipmentPayload?.error || "Failed to load equipment")
  }
  if (!issuanceResponse.ok) {
    throw new Error(issuancePayload?.error || "Failed to load issuance history")
  }
  if (!updatesResponse.ok) {
    throw new Error(updatesPayload?.error || "Failed to load update history")
  }

  return {
    equipment: equipmentPayload.equipment,
    issuances: Array.isArray(issuancePayload?.issuances) ? issuancePayload.issuances : [],
    issuanceUserMap:
      issuancePayload?.userMap && typeof issuancePayload.userMap === "object"
        ? issuancePayload.userMap
        : {},
    updates: Array.isArray(updatesPayload?.updates) ? updatesPayload.updates : [],
    updatesUserMap:
      updatesPayload?.userMap && typeof updatesPayload.userMap === "object"
        ? updatesPayload.userMap
        : {},
  }
}

export async function updateEquipment(
  equipmentId: string,
  input: Partial<Pick<EquipmentRow, "name" | "label" | "serial_number" | "location" | "status" | "type" | "notes">>
): Promise<EquipmentRow> {
  const response = await fetch(`/api/equipment/${equipmentId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  const payload = (await response.json().catch(() => ({}))) as {
    error?: string
    equipment?: EquipmentRow
  }

  if (!response.ok || !payload.equipment) {
    throw new Error(getEquipmentDetailErrorMessage(payload, "Failed to update equipment"))
  }

  return payload.equipment
}

export async function deleteEquipment(equipmentId: string) {
  const response = await fetch(`/api/equipment/${equipmentId}`, {
    method: "DELETE",
  })
  const payload = (await response.json().catch(() => ({}))) as { error?: string }

  if (!response.ok) {
    throw new Error(getEquipmentDetailErrorMessage(payload, "Failed to delete equipment"))
  }
}

export async function issueEquipment(input: {
  equipment_id: string
  user_id: string
  expected_return?: string | null
  notes?: string | null
}) {
  const response = await fetch("/api/equipment-issuance", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  const payload = (await response.json().catch(() => ({}))) as { error?: string }

  if (!response.ok) {
    throw new Error(getEquipmentDetailErrorMessage(payload, "Failed to issue equipment"))
  }
}

export async function returnEquipment(input: { issuance_id: string; notes?: string | null }) {
  const response = await fetch("/api/equipment-issuance", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  const payload = (await response.json().catch(() => ({}))) as { error?: string }

  if (!response.ok) {
    throw new Error(getEquipmentDetailErrorMessage(payload, "Failed to return equipment"))
  }
}

export async function createEquipmentUpdate(input: {
  equipment_id: string
  next_due_at?: string | null
  notes?: string | null
}) {
  const response = await fetch("/api/equipment-updates", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  const payload = (await response.json().catch(() => ({}))) as { error?: string }

  if (!response.ok) {
    throw new Error(getEquipmentDetailErrorMessage(payload, "Failed to log update"))
  }
}

export function useEquipmentDetailQuery(
  equipmentId: string,
  initialData: EquipmentDetailQueryData
) {
  return useQuery({
    queryKey: equipmentDetailQueryKey(equipmentId),
    queryFn: () => fetchEquipmentDetail(equipmentId),
    initialData,
    staleTime: 30_000,
  })
}
