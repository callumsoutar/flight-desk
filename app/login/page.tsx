import { redirect } from "next/navigation"

import { LoginForm } from "@/components/login-form"
import { getAuthSession } from "@/lib/auth/session"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ next?: string }>
}) {
  const next = (await searchParams)?.next
  const supabase = await createSupabaseServerClient()
  const { user } = await getAuthSession(supabase)

  if (user) redirect(next || "/dashboard")

  return <LoginForm nextUrl={next} />
}
