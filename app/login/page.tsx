import { redirect } from "next/navigation"

import { sanitizeNextPath } from "@/lib/auth/redirect"
import { LoginForm } from "@/components/login-form"
import { getAuthSession } from "@/lib/auth/session"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ next?: string }>
}) {
  const supabase = await createSupabaseServerClient()
  const [resolvedSearchParams, session] = await Promise.all([
    searchParams,
    getAuthSession(supabase, { requireUser: true }),
  ])
  const next = sanitizeNextPath(resolvedSearchParams?.next)
  const { user } = session

  if (user) redirect(next)

  return <LoginForm nextUrl={next} />
}
