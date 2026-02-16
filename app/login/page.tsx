import { redirect } from "next/navigation"

import { LoginForm } from "@/components/login-form"
import { getAuthSession } from "@/lib/auth/session"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: { next?: string } | Promise<{ next?: string }>
}) {
  const resolved = await Promise.resolve(searchParams)
  const next = resolved?.next
  const supabase = await createSupabaseServerClient()
  const { user } = await getAuthSession(supabase)

  if (user) redirect(next || "/dashboard")

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-12 dark:bg-black">
      <LoginForm nextUrl={next} />
    </div>
  )
}
