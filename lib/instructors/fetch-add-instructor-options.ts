import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { UserResult } from "@/components/invoices/member-select"
import type { Database } from "@/lib/types"
import type { InstructorCategoryLite } from "@/lib/types/instructors"

function pickMaybeOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

export type AddInstructorOptions = {
  members: UserResult[]
  categories: InstructorCategoryLite[]
}

export async function fetchAddInstructorOptions(
  supabase: SupabaseClient<Database>,
  tenantId: string
): Promise<AddInstructorOptions> {
  const [membersResult, instructorsResult, categoriesResult] = await Promise.all([
    supabase
      .from("tenant_users")
      .select("user:user_directory!tenant_users_user_id_fkey(id, first_name, last_name, email)")
      .eq("tenant_id", tenantId)
      .eq("is_active", true),
    supabase.from("instructors").select("user_id").eq("tenant_id", tenantId),
    supabase.from("instructor_categories").select("id, name").order("name", { ascending: true }),
  ])

  if (membersResult.error) throw membersResult.error
  if (instructorsResult.error) throw instructorsResult.error
  if (categoriesResult.error) throw categoriesResult.error

  const instructorUserIds = new Set((instructorsResult.data ?? []).map((r) => r.user_id))

  const members = (membersResult.data ?? [])
    .map((row) => pickMaybeOne(row.user))
    .filter((row): row is UserResult => Boolean(row?.id && row.email))
    .filter((row) => !instructorUserIds.has(row.id))
    .sort((a, b) => {
      const left = `${a.first_name ?? ""} ${a.last_name ?? ""}`.trim() || a.email
      const right = `${b.first_name ?? ""} ${b.last_name ?? ""}`.trim() || b.email
      return left.localeCompare(right)
    })

  return {
    members,
    categories: (categoriesResult.data ?? []) as InstructorCategoryLite[],
  }
}
