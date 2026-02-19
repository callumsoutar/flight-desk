import { NextResponse } from "next/server"

import { getAuthSession } from "@/lib/auth/session"
import { fetchUserProfile } from "@/lib/auth/user-profile"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function GET() {
  const supabase = await createSupabaseServerClient()
  const { user, role } = await getAuthSession(supabase, {
    includeRole: true,
    requireUser: true,
  })

  if (!user) {
    return NextResponse.json(
      { user: null, role: null, profile: null },
      { headers: { "cache-control": "no-store" } }
    )
  }

  const profile = await fetchUserProfile(supabase, user)

  return NextResponse.json(
    { user, role, profile },
    { headers: { "cache-control": "no-store" } }
  )
}
