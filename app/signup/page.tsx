import { redirect } from "next/navigation"

import { SignupForm } from "@/components/signup-form"
import { getRootLayoutAuthSession } from "@/lib/auth/session"

export default async function SignupPage() {
  const { user } = await getRootLayoutAuthSession()

  if (user) redirect("/dashboard")

  return <SignupForm />
}
