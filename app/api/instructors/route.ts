import { getTenantStaffRouteContext, noStoreJson } from "@/lib/api/tenant-route"

export const dynamic = "force-dynamic"

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
    .eq("is_actively_instructing", true)
    .order("first_name", { ascending: true })

  if (error) {
    return noStoreJson({ error: "Failed to load instructors" }, { status: 500 })
  }

  return noStoreJson({ instructors: data ?? [] })
}
