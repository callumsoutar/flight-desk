"use client"

import * as React from "react"

import { MembersTable } from "@/components/members/members-table"
import type { MemberWithRelations, PersonType } from "@/lib/types/members"

type Props = {
  members: MemberWithRelations[]
}

export function MembersPageClient({ members }: Props) {
  const [activeTab, setActiveTab] = React.useState<PersonType>("member")

  const tabCounts = React.useMemo(
    () => ({
      all: members.length,
      member: members.filter((m) => m.person_type === "member").length,
      instructor: members.filter((m) => m.person_type === "instructor").length,
      staff: members.filter((m) => m.person_type === "staff").length,
      contact: members.filter((m) => m.person_type === "contact").length,
    }),
    [members]
  )

  const filteredMembers = React.useMemo(() => {
    if (activeTab === "all") return members
    return members.filter((m) => m.person_type === activeTab)
  }, [activeTab, members])

  return (
    <MembersTable
      members={filteredMembers}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      tabCounts={tabCounts}
    />
  )
}
