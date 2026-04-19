import { getTenantStaffRouteContext, noStoreJson } from "@/lib/api/tenant-route"
import { fetchAddInstructorOptions } from "@/lib/instructors/fetch-add-instructor-options"

export const dynamic = "force-dynamic"

export async function GET() {
  const session = await getTenantStaffRouteContext()
  if (session.response) return session.response
  const { supabase, tenantId } = session.context

  try {
    const options = await fetchAddInstructorOptions(supabase, tenantId)
    return noStoreJson(options)
  } catch {
    return noStoreJson({ error: "Failed to load add-instructor options" }, { status: 500 })
  }
}
