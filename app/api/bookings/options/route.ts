import { getTenantStaffRouteContext, noStoreJson } from "@/lib/api/tenant-route"
import { isStaffRole } from "@/lib/auth/roles"

export const dynamic = "force-dynamic"

function pickMaybeOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

export async function GET() {
  const session = await getTenantStaffRouteContext()
  if (session.response) return session.response
  const { supabase, user, role, tenantId } = session.context

  const membersPromise = isStaffRole(role)
    ? supabase
        .from("tenant_users")
        .select("user:user_directory!tenant_users_user_id_fkey(id, first_name, last_name, email)")
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
    : supabase
        .from("user_directory")
        .select("id, first_name, last_name, email")
        .eq("id", user.id)
        .maybeSingle()

  const [aircraftResult, instructorsResult, flightTypesResult, syllabiResult, lessonsResult, membersResult] =
    await Promise.all([
      supabase
        .from("aircraft")
        .select("id, registration, type, aircraft_type_id, model, manufacturer")
        .eq("tenant_id", tenantId)
        .eq("on_line", true)
        .order("order", { ascending: true })
        .order("registration", { ascending: true }),
      supabase
        .from("instructors")
        .select(
          "id, first_name, last_name, user_id, is_actively_instructing, user:user_directory!instructors_user_id_fkey(id, first_name, last_name, email)"
        )
        .eq("tenant_id", tenantId)
        .eq("is_actively_instructing", true)
        .order("first_name", { ascending: true })
        .order("last_name", { ascending: true }),
      supabase
        .from("flight_types")
        .select("id, name, instruction_type")
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .is("voided_at", null)
        .order("name", { ascending: true }),
      supabase
        .from("syllabus")
        .select("id, name")
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .is("voided_at", null)
        .order("name", { ascending: true }),
      supabase
        .from("lessons")
        .select("id, name, description, order, syllabus_id")
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .order("order", { ascending: true }),
      membersPromise,
    ])

  if (
    aircraftResult.error ||
    instructorsResult.error ||
    flightTypesResult.error ||
    syllabiResult.error ||
    lessonsResult.error ||
    membersResult.error
  ) {
    return noStoreJson({ error: "Failed to load booking options" }, { status: 500 })
  }

  let members: Array<{
    id: string
    first_name: string | null
    last_name: string | null
    email: string
  }> = []

  if (isStaffRole(role)) {
    const rows = (membersResult.data ?? []) as Array<{
      user:
        | { id: string; first_name: string | null; last_name: string | null; email: string }
        | Array<{ id: string; first_name: string | null; last_name: string | null; email: string }>
        | null
    }>
    members = rows
      .map((row) => pickMaybeOne(row.user))
      .filter(
        (
          member
        ): member is {
          id: string
          first_name: string | null
          last_name: string | null
          email: string
        } => Boolean(member && member.id && member.email)
      )
  } else {
    const me = membersResult.data as {
      id: string
      first_name: string | null
      last_name: string | null
      email: string
    } | null
    if (me?.id && me.email) {
      members = [me]
    } else if (user.email) {
      members = [{ id: user.id, first_name: null, last_name: null, email: user.email }]
    }
  }

  return noStoreJson(
    {
      options: {
        aircraft: aircraftResult.data ?? [],
        instructors: (instructorsResult.data ?? []).map((instructor) => ({
          id: instructor.id,
          first_name: instructor.first_name,
          last_name: instructor.last_name,
          user_id: instructor.user_id,
          is_actively_instructing: instructor.is_actively_instructing,
          user: pickMaybeOne(instructor.user),
        })),
        members,
        flightTypes: flightTypesResult.data ?? [],
        syllabi: syllabiResult.data ?? [],
        lessons: lessonsResult.data ?? [],
      },
    }
  )
}
