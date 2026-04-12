import { redirect } from "next/navigation"

import { sanitizeNextPath } from "@/lib/auth/redirect"
import { LoginForm } from "@/components/login-form"
import { getRootLayoutAuthSession } from "@/lib/auth/session"

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ next?: string }>
}) {
  const [resolvedSearchParams, session] = await Promise.all([
    searchParams,
    getRootLayoutAuthSession(),
  ])
  const next = sanitizeNextPath(resolvedSearchParams?.next)
  const { user } = session

  if (user) redirect(next)

  return <LoginForm nextUrl={next} />
}
