import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

import { getAuthSession } from "@/lib/auth/session"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const nextParam = searchParams.get("next") ?? "/"
  const next = nextParam.startsWith("/") ? nextParam : "/"

  if (!code) {
    return NextResponse.redirect(`${origin}/login`)
  }

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    return NextResponse.redirect(`${origin}/login`)
  }

  const { user, tenantId } = await getAuthSession(supabase, {
    includeTenant: true,
    requireUser: true,
    authoritativeTenant: true,
  })

  if (!user) {
    return NextResponse.redirect(`${origin}/login`)
  }

  if (!tenantId) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent("No organization found for your account. Please contact your administrator or sign up.")}`
    )
  }

  return NextResponse.redirect(`${origin}${next}`)
}
