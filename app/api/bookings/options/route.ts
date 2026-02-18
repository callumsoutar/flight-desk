import { NextResponse } from "next/server"

import { getAuthSession } from "@/lib/auth/session"
import { getUserTenantId } from "@/lib/auth/tenant"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

function pickMaybeOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

function isStaff(role: string | null) {
  return role === "owner" || role === "admin" || role === "instructor"
}

export async function GET() {
  const supabase = await createSupabaseServerClient()
  const { user, role } = await getAuthSession(supabase)

  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: { "cache-control": "no-store" } }
    )
  }

  const tenantId = await getUserTenantId(supabase, user.id)
  if (!tenantId) {
    return NextResponse.json(
      { error: "Tenant not found" },
      { status: 400, headers: { "cache-control": "no-store" } }
    )
  }

  const [aircraftResult, instructorsResult, flightTypesResult, syllabiResult, lessonsResult] =
    await Promise.all([
      supabase
        .from("aircraft")
        .select("id, registration, type, model, manufacturer")
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
    ])

  if (
    aircraftResult.error ||
    instructorsResult.error ||
    flightTypesResult.error ||
    syllabiResult.error ||
    lessonsResult.error
  ) {
    return NextResponse.json(
      { error: "Failed to load booking options" },
      { status: 500, headers: { "cache-control": "no-store" } }
    )
  }

  let members:
    | Array<{
        id: string
        first_name: string | null
        last_name: string | null
        email: string
      }>
    = []

  if (isStaff(role)) {
    const membersResult = await supabase
      .from("tenant_users")
      .select("user:user_directory!tenant_users_user_id_fkey(id, first_name, last_name, email)")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)

    if (membersResult.error) {
      return NextResponse.json(
        { error: "Failed to load members" },
        { status: 500, headers: { "cache-control": "no-store" } }
      )
    }

    members = (membersResult.data ?? [])
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
    const meResult = await supabase
      .from("user_directory")
      .select("id, first_name, last_name, email")
      .eq("id", user.id)
      .maybeSingle()

    if (meResult.error) {
      return NextResponse.json(
        { error: "Failed to load member profile" },
        { status: 500, headers: { "cache-control": "no-store" } }
      )
    }

    if (meResult.data?.id && meResult.data.email) {
      members = [
        {
          id: meResult.data.id,
          first_name: meResult.data.first_name,
          last_name: meResult.data.last_name,
          email: meResult.data.email,
        },
      ]
    } else if (user.email) {
      members = [
        {
          id: user.id,
          first_name: null,
          last_name: null,
          email: user.email,
        },
      ]
    }
  }

  return NextResponse.json(
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
    },
    { headers: { "cache-control": "no-store" } }
  )
}
