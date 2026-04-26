import type { MemberWithRelations } from "@/lib/types/members"

export type MemberBalanceRow = {
  user_id: string
  current_balance: number
  last_payment_at: string | null
}

export type MemberWithBalance = MemberWithRelations & {
  current_balance: number
  last_payment_at: string | null
}

export type BalanceViewTab = "debt" | "credit" | "balanced" | "all"
