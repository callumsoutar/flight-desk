import { redirect } from "next/navigation"

export default async function MemberBalancesPage() {
  redirect("/reports?tab=member-balances")
}
