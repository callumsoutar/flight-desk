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
  const [isNavigating, startNavigation] = React.useTransition()
  const navigate = React.useCallback(
    (href: string) => {
      startNavigation(() => {
        router.push(href)
      })
    },
    [router]
  )

  const handleIssue = React.useCallback(
    (item: EquipmentWithIssuance) => {
      navigate(`/equipment/${item.id}?action=issue`)
    },
    [navigate]
  )

  const handleReturn = React.useCallback(
    (item: EquipmentWithIssuance) => {
      navigate(`/equipment/${item.id}?action=return`)
    },
    [navigate]
  )

  const handleLogUpdate = React.useCallback(
    (item: EquipmentWithIssuance) => {
      navigate(`/equipment/${item.id}?action=log-update`)
    },
    [navigate]
  )

  const handleAdd = React.useCallback(() => {
    navigate("/equipment/new")
  }, [navigate])

  return (
    <div aria-busy={isNavigating}>
      <EquipmentTable
        equipment={equipment}
        onIssue={handleIssue}
        onReturn={handleReturn}
        onLogUpdate={handleLogUpdate}
        onAdd={handleAdd}
      />
    </div>
  )
}
