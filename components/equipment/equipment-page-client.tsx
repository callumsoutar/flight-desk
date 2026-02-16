"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { EquipmentTable } from "@/components/equipment/equipment-table"
import type { EquipmentWithIssuance } from "@/lib/types/equipment"

type Props = {
  equipment: EquipmentWithIssuance[]
}

export function EquipmentPageClient({ equipment }: Props) {
  const router = useRouter()

  const handleIssue = React.useCallback(
    (item: EquipmentWithIssuance) => {
      router.push(`/equipment/${item.id}?action=issue`)
    },
    [router]
  )

  const handleReturn = React.useCallback(
    (item: EquipmentWithIssuance) => {
      router.push(`/equipment/${item.id}?action=return`)
    },
    [router]
  )

  const handleLogUpdate = React.useCallback(
    (item: EquipmentWithIssuance) => {
      router.push(`/equipment/${item.id}?action=log-update`)
    },
    [router]
  )

  const handleAdd = React.useCallback(() => {
    router.push("/equipment/new")
  }, [router])

  return (
    <EquipmentTable
      equipment={equipment}
      onIssue={handleIssue}
      onReturn={handleReturn}
      onLogUpdate={handleLogUpdate}
      onAdd={handleAdd}
    />
  )
}
