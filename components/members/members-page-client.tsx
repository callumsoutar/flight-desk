"use client"

import * as React from "react"
import dynamic from "next/dynamic"
import { useQueryClient } from "@tanstack/react-query"

import { MembersTable } from "@/components/members/members-table"
import { memberBalancesQueryKey } from "@/hooks/use-member-balances-query"
import { membersQueryKey, useMembersQuery } from "@/hooks/use-members-query"

const AddMemberModal = dynamic(
  () => import("@/components/members/add-member-modal").then((mod) => mod.AddMemberModal),
  { ssr: false }
)
import type { MemberWithRelations, PersonType } from "@/lib/types/members"

type Props = {
  members: MemberWithRelations[]
}

export function MembersPageClient({ members }: Props) {
  const queryClient = useQueryClient()
  const { data: memberRows = [], isFetching } = useMembersQuery(members)
  const [addModalOpen, setAddModalOpen] = React.useState(false)
  const [activeTab, setActiveTab] = React.useState<PersonType>("member")

  const tabCounts = React.useMemo(
    () => ({
      all: memberRows.length,
      member: memberRows.filter((m) => m.person_type === "member").length,
      instructor: memberRows.filter((m) => m.person_type === "instructor").length,
      staff: memberRows.filter((m) => m.person_type === "staff").length,
      contact: memberRows.filter((m) => m.person_type === "contact").length,
    }),
    [memberRows]
  )

  const filteredMembers = React.useMemo(() => {
    if (activeTab === "all") return memberRows
    return memberRows.filter((m) => m.person_type === activeTab)
  }, [activeTab, memberRows])

  const handleAdd = React.useCallback(() => {
    setAddModalOpen(true)
  }, [])

  const handleAddSuccess = React.useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: membersQueryKey() })
    await queryClient.invalidateQueries({ queryKey: memberBalancesQueryKey() })
  }, [queryClient])

  return (
    <div aria-busy={isFetching}>
      <MembersTable
        members={filteredMembers}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onAdd={handleAdd}
        tabCounts={tabCounts}
      />
      <AddMemberModal
        open={addModalOpen}
        onOpenChange={setAddModalOpen}
        onSuccess={handleAddSuccess}
      />
    </div>
  )
}
