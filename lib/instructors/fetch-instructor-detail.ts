import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/types"
import type { InstructorDetailWithRelations } from "@/lib/types/instructors"

function pickMaybeOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

export async function fetchInstructorDetail(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  userId: string
): Promise<InstructorDetailWithRelations | null> {
  const { data, error } = await supabase
    .from("instructors")
    .select(
      "id, user_id, first_name, last_name, rating, status, is_actively_instructing, employment_type, hire_date, termination_date, approved_at, approved_by, expires_at, class_1_medical_due_date, instructor_check_due_date, instrument_check_due_date, night_removal, multi_removal, ifr_removal, aerobatics_removal, tawa_removal, notes, created_at, updated_at, user:users!instructors_user_id_fkey(id, first_name, last_name, email, phone, street_address, date_of_birth, notes), rating_category:instructor_categories!instructors_rating_fkey(id, name, country, description)"
    )
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  return {
    id: data.id,
    user_id: data.user_id,
    first_name: data.first_name,
    last_name: data.last_name,
    rating: data.rating,
    status: data.status,
    is_actively_instructing: data.is_actively_instructing,
    employment_type: data.employment_type,
    hire_date: data.hire_date,
    termination_date: data.termination_date,
    approved_at: data.approved_at,
    approved_by: data.approved_by,
    expires_at: data.expires_at,
    class_1_medical_due_date: data.class_1_medical_due_date,
    instructor_check_due_date: data.instructor_check_due_date,
    instrument_check_due_date: data.instrument_check_due_date,
    night_removal: data.night_removal,
    multi_removal: data.multi_removal,
    ifr_removal: data.ifr_removal,
    aerobatics_removal: data.aerobatics_removal,
    tawa_removal: data.tawa_removal,
    notes: data.notes,
    created_at: data.created_at,
    updated_at: data.updated_at,
    user: pickMaybeOne(data.user),
    rating_category: pickMaybeOne(data.rating_category),
  }
}
