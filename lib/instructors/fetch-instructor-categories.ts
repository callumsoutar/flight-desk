import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/types"
import type { InstructorCategoryLite } from "@/lib/types/instructors"

export async function fetchInstructorCategories(
  supabase: SupabaseClient<Database>
): Promise<InstructorCategoryLite[]> {
  const { data, error } = await supabase
    .from("instructor_categories")
    .select("id, name")
    .order("name", { ascending: true })

  if (error) throw error

  return (data ?? []) as InstructorCategoryLite[]
}
