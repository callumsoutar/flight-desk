import { NextResponse, type NextRequest } from "next/server"

import { updateSession } from "@/lib/supabase/middleware"
import type { CookieToSet } from "@/lib/supabase/middleware"

function applyCookies(
  response: NextResponse,
  cookiesToSet: CookieToSet[]
) {
  for (const cookie of cookiesToSet) {
    response.cookies.set(cookie.name, cookie.value, cookie.options)
  }
}

export async function middleware(request: NextRequest) {
  const { userId, cookiesToSet } = await updateSession(request)
  const pathname = request.nextUrl.pathname

  if (!userId) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    url.searchParams.set("next", `${pathname}${request.nextUrl.search}`)

    const response = NextResponse.redirect(url)
    applyCookies(response, cookiesToSet)
    return response
  }

  const response = NextResponse.next()
  applyCookies(response, cookiesToSet)
  return response
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/aircraft/:path*",
    "/members/:path*",
    "/bookings/:path*",
    "/invoices/:path*",
    "/equipment/:path*",
    "/scheduler/:path*",
    "/rosters/:path*",
    "/instructors/:path*",
  ],
}
