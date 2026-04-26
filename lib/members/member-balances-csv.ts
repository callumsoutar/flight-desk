import { getMemberDisplayName, getMembershipStatusLabel, getMembershipTypeLabel } from "@/lib/members/member-exports"
import { getBalanceCategory } from "@/lib/members/member-balance-utils"
import type { MemberWithBalance } from "@/lib/types/member-balances"
import type { PersonType } from "@/lib/types/members"

function csvCell(value: string) {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replaceAll('"', '""')}"`
  }
  return value
}

function personTypeLabel(p: PersonType): string {
  if (p === "staff") return "Staff"
  if (p === "instructor") return "Instructor"
  if (p === "member") return "Member"
  return "Contact"
}

export function buildMemberBalancesCsv(rows: MemberWithBalance[]) {
  const header = [
    "Name",
    "Email",
    "Person type",
    "Membership",
    "Membership status",
    "Balance",
    "Balance status",
    "Last payment",
    "Portal access",
  ]

  const lines = rows.map((m) => {
    const { name, email } = getMemberDisplayName(m)
    const cat = getBalanceCategory(m.current_balance)
    const statusLabel =
      cat === "debt" ? "In debt" : cat === "credit" ? "In credit" : "Balanced"
    const balanceStr =
      cat === "credit"
        ? `${Math.abs(m.current_balance).toFixed(2)} CR`
        : m.current_balance.toFixed(2)

    return [
      csvCell(name),
      csvCell(email),
      csvCell(personTypeLabel(m.person_type)),
      csvCell(getMembershipTypeLabel(m)),
      csvCell(getMembershipStatusLabel(m.membership_status)),
      csvCell(balanceStr),
      csvCell(statusLabel),
      csvCell(m.last_payment_at ?? ""),
      csvCell(m.is_active ? "Active" : "Inactive"),
    ].join(",")
  })

  return [header.join(","), ...lines].join("\n")
}
