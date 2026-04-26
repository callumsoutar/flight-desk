import type { BalanceViewTab } from "@/lib/types/member-balances"

export function getBalanceCategory(balance: number): "debt" | "credit" | "balanced" {
  const rounded = Math.round(balance * 100) / 100
  if (rounded > 0) return "debt"
  if (rounded < 0) return "credit"
  return "balanced"
}

export function balanceTabMatches(tab: BalanceViewTab, balance: number): boolean {
  if (tab === "all") return true
  const cat = getBalanceCategory(balance)
  if (tab === "debt") return cat === "debt"
  if (tab === "credit") return cat === "credit"
  return cat === "balanced"
}
