import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

import { createSupabaseServerClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const token_hash = searchParams.get("token_hash")
  const type = searchParams.get("type")

  if (!code && !token_hash) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent("Invalid invite link")}`
    )
  }

  const supabase = await createSupabaseServerClient()

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      return NextResponse.redirect(
        `${origin}/login?error=${encodeURIComponent("Failed to accept invite. Please try again or contact your administrator.")}`
      )
    }
  } else if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash,
      type: type as "invite" | "email",
    })
    if (error) {
      return NextResponse.redirect(
        `${origin}/login?error=${encodeURIComponent("Failed to verify invite. The link may have expired.")}`
      )
    }
  }

  return NextResponse.redirect(`${origin}/dashboard`)
}
