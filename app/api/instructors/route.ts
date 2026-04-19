import { revalidatePath } from "next/cache"
import { z } from "zod"

import { getTenantStaffRouteContext, noStoreJson } from "@/lib/api/tenant-route"

export const dynamic = "force-dynamic"

const createInstructorBodySchema = z.object({
  user_id: z.string().uuid(),
  rating: z.string().uuid().nullable().optional(),
  employment_type: z.enum(["full_time", "part_time", "casual", "contractor"]).nullable().optional(),
  status: z.enum(["active", "inactive", "deactivated", "suspended"]).optional().default("active"),
  is_actively_instructing: z.boolean().optional().default(true),
  hire_date: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.null()]).optional(),
})

export async function GET() {
  const session = await getTenantStaffRouteContext()
  if (session.response) return session.response
  const { supabase, tenantId } = session.context

  const { data, error } = await supabase
    .from("instructors")
    .select(
      "id, user_id, first_name, last_name, status, is_actively_instructing, user:user_directory!instructors_user_id_fkey(id, first_name, last_name, email)"
    )
    .eq("tenant_id", tenantId)
    .is("voided_at", null)
    .eq("is_actively_instructing", true)
    .order("first_name", { ascending: true })

  if (error) {
    return noStoreJson({ error: "Failed to load instructors" }, { status: 500 })
  }

  return noStoreJson({ instructors: data ?? [] })
}

export async function POST(request: Request) {
  const session = await getTenantStaffRouteContext()
  if (session.response) return session.response
  const { supabase, tenantId } = session.context

  let json: unknown
  try {
    json = await request.json()
  } catch {
    return noStoreJson({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = createInstructorBodySchema.safeParse(json)
  if (!parsed.success) {
    return noStoreJson({ error: "Invalid instructor payload", details: parsed.error.flatten() }, { status: 400 })
  }

  const {
    user_id: userId,
    rating: ratingId,
    employment_type: employmentType,
    status,
    is_actively_instructing: isActivelyInstructing,
    hire_date: hireDate,
  } = parsed.data

  const [{ data: membership, error: membershipError }, { data: existingInstructor, error: existingError }] =
    await Promise.all([
      supabase
        .from("tenant_users")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("user_id", userId)
        .eq("is_active", true)
        .maybeSingle(),
      supabase.from("instructors").select("id").eq("tenant_id", tenantId).eq("user_id", userId).maybeSingle(),
    ])

  if (membershipError) {
    return noStoreJson({ error: "Failed to verify member" }, { status: 500 })
  }
  if (existingError) {
    return noStoreJson({ error: "Failed to verify instructor" }, { status: 500 })
  }
  if (!membership) {
    return noStoreJson({ error: "Selected user is not an active member of this organization." }, { status: 400 })
  }
  if (existingInstructor) {
    return noStoreJson({ error: "This member already has an instructor profile." }, { status: 409 })
  }

  const { data: profile, error: profileError } = await supabase
    .from("user_directory")
    .select("id, first_name, last_name, email")
    .eq("id", userId)
    .maybeSingle()

  if (profileError) {
    return noStoreJson({ error: "Failed to load member profile" }, { status: 500 })
  }
  if (!profile) {
    return noStoreJson({ error: "Member profile not found." }, { status: 400 })
  }

  if (ratingId) {
    const { data: category, error: categoryError } = await supabase
      .from("instructor_categories")
      .select("id")
      .eq("id", ratingId)
      .maybeSingle()

    if (categoryError) {
      return noStoreJson({ error: "Failed to validate instructor category" }, { status: 500 })
    }
    if (!category) {
      return noStoreJson({ error: "Invalid instructor category." }, { status: 400 })
    }
  }

  const { data: created, error: insertError } = await supabase
    .from("instructors")
    .insert({
      tenant_id: tenantId,
      user_id: userId,
      first_name: profile.first_name ?? null,
      last_name: profile.last_name ?? null,
      rating: ratingId ?? null,
      employment_type: employmentType ?? null,
      status,
      is_actively_instructing: isActivelyInstructing,
      hire_date: hireDate ?? null,
    })
    .select("id, user_id")
    .single()

  if (insertError) {
    if (insertError.code === "23505") {
      return noStoreJson(
        { error: "This person already has an instructor profile in the system." },
        { status: 409 }
      )
    }
    return noStoreJson({ error: "Failed to create instructor profile" }, { status: 500 })
  }

  revalidatePath("/instructors")

  return noStoreJson({ instructor: created })
}
