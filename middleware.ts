import { NextResponse, type NextRequest } from "next/server"

import { updateSession } from "@/lib/supabase/middleware"
import type { CookieToSet } from "@/lib/supabase/middleware"

const PUBLIC_PATH_PREFIXES = [
  "/login",
  "/signup",
  "/auth",
  "/onboarding",
  "/api/auth",
]

function isPublicPath(pathname: string) {
  return PUBLIC_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}

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

  if (!isPublicPath(pathname) && !userId) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    url.searchParams.set("next", `${pathname}${request.nextUrl.search}`)

    const response = NextResponse.redirect(url)
    applyCookies(response, cookiesToSet)
    return response
  }

  if (pathname === "/login" && userId) {
    const next = request.nextUrl.searchParams.get("next")
    const destination =
      next && next.startsWith("/") ? next : "/dashboard"
    const response = NextResponse.redirect(new URL(destination, request.url))
    applyCookies(response, cookiesToSet)
    return response
  }

  const response = NextResponse.next()
  applyCookies(response, cookiesToSet)
  return response
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
