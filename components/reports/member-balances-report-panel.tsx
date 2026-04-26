"use client"

import { MemberBalancesTable } from "@/components/members/member-balances-table"
import { useMemberBalancesQuery } from "@/hooks/use-member-balances-query"
import type { MemberWithBalance } from "@/lib/types/member-balances"

type Props = {
  initialMembers: MemberWithBalance[]
  initialTimeZone: string
}

export function MemberBalancesReportPanel({ initialMembers, initialTimeZone }: Props) {
  const { data, isFetching } = useMemberBalancesQuery({
    members: initialMembers,
    timeZone: initialTimeZone,
  })

  const members = data?.members ?? initialMembers
  const timeZone = data?.timeZone ?? initialTimeZone

  return <MemberBalancesTable sourceRows={members} timeZone={timeZone} isFetching={isFetching} />
}
