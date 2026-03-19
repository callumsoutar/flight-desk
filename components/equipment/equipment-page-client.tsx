"use client"

import * as React from "react"
import dynamic from "next/dynamic"
import { useRouter } from "next/navigation"

import { EquipmentTable } from "@/components/equipment/equipment-table"
import type { EquipmentIssuanceMember, EquipmentWithIssuance } from "@/lib/types/equipment"

const AddEquipmentModal = dynamic(
  () => import("@/components/equipment/add-equipment-modal").then((mod) => mod.AddEquipmentModal),
  { ssr: false }
)

const IssueEquipmentModal = dynamic(
  () => import("@/components/equipment/issue-equipment-modal").then((mod) => mod.IssueEquipmentModal),
  { ssr: false }
)

const ReturnEquipmentModal = dynamic(
  () => import("@/components/equipment/return-equipment-modal").then((mod) => mod.ReturnEquipmentModal),
  { ssr: false }
)

type Props = {
  equipment: EquipmentWithIssuance[]
  issueMembers: EquipmentIssuanceMember[]
  canIssueEquipment: boolean
}

export function EquipmentPageClient({ equipment, issueMembers, canIssueEquipment }: Props) {
  const router = useRouter()
  const [isNavigating, startNavigation] = React.useTransition()
  const [addModalOpen, setAddModalOpen] = React.useState(false)
  const [issueModalOpen, setIssueModalOpen] = React.useState(false)
  const [returnModalOpen, setReturnModalOpen] = React.useState(false)
  const [selectedIssueEquipment, setSelectedIssueEquipment] = React.useState<EquipmentWithIssuance | null>(null)
  const [selectedReturnEquipment, setSelectedReturnEquipment] = React.useState<EquipmentWithIssuance | null>(null)
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
      setSelectedIssueEquipment(item)
      setIssueModalOpen(true)
    },
    []
  )

  const handleReturn = React.useCallback(
    (item: EquipmentWithIssuance) => {
      setSelectedReturnEquipment(item)
      setReturnModalOpen(true)
    },
    []
  )

  const handleLogUpdate = React.useCallback(
    (item: EquipmentWithIssuance) => {
      navigate(`/equipment/${item.id}?action=log-update`)
    },
    [navigate]
  )

  const handleAdd = React.useCallback(() => {
    setAddModalOpen(true)
  }, [])

  const handleIssueSuccess = React.useCallback(() => {
    startNavigation(() => {
      router.refresh()
    })
  }, [router])

  return (
    <div aria-busy={isNavigating}>
      <EquipmentTable
        equipment={equipment}
        onIssue={canIssueEquipment ? handleIssue : undefined}
        onReturn={canIssueEquipment ? handleReturn : undefined}
        onLogUpdate={handleLogUpdate}
        onAdd={handleAdd}
      />
      <AddEquipmentModal
        open={addModalOpen}
        onOpenChange={setAddModalOpen}
        onSuccess={handleIssueSuccess}
      />
      <IssueEquipmentModal
        open={issueModalOpen}
        onOpenChange={(open) => {
          setIssueModalOpen(open)
          if (!open) {
            setSelectedIssueEquipment(null)
          }
        }}
        equipment={selectedIssueEquipment}
        members={issueMembers}
        onSuccess={handleIssueSuccess}
      />
      <ReturnEquipmentModal
        open={returnModalOpen}
        onOpenChange={(open) => {
          setReturnModalOpen(open)
          if (!open) {
            setSelectedReturnEquipment(null)
          }
        }}
        equipment={selectedReturnEquipment}
        onSuccess={handleIssueSuccess}
      />
    </div>
  )
}
