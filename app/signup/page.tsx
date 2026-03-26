import { redirect } from "next/navigation"

import { SignupForm } from "@/components/signup-form"
import { getAuthSession } from "@/lib/auth/session"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export default async function SignupPage() {
  const supabase = await createSupabaseServerClient()
  const { user } = await getAuthSession(supabase, { requireUser: true })

  if (user) redirect("/dashboard")

  return <SignupForm />
}
