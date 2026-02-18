import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/types"
import type { InstructorWithRelations } from "@/lib/types/instructors"

export async function fetchInstructors(
  supabase: SupabaseClient<Database>,
  tenantId: string
): Promise<InstructorWithRelations[]> {
  const { data, error } = await supabase
    .from("instructors")
    .select(
      "id, user_id, first_name, last_name, status, is_actively_instructing, employment_type, hire_date, expires_at, rating, user:user_directory!instructors_user_id_fkey(id, first_name, last_name, email), instructor_category:instructor_categories!instructors_rating_fkey(id, name)"
    )
    .eq("tenant_id", tenantId)
    .order("is_actively_instructing", { ascending: false })
    .order("last_name", { ascending: true })
    .order("first_name", { ascending: true })

  if (error) throw error

  return (data ?? []) as InstructorWithRelations[]
}
