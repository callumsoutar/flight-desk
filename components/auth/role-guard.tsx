import { redirect } from "next/navigation"

import { getAuthSession } from "@/lib/auth/session"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import type { UserRole } from "@/lib/types/roles"

export async function RoleGuard({
  allowedRoles,
  redirectTo = "/dashboard",
  children,
}: {
  allowedRoles: UserRole[]
  redirectTo?: string
  children: React.ReactNode
}) {
  const supabase = await createSupabaseServerClient()
  const { user, role } = await getAuthSession(supabase, { includeRole: true })
  if (!user) redirect("/login")

  if (!role || !allowedRoles.includes(role)) redirect(redirectTo)

  return children
}
