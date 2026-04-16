"use server"

import { revalidatePath } from "next/cache"

import { logError } from "@/lib/security/logger"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { createSupabaseServerClient } from "@/lib/supabase/server"

function getSafeSignInErrorMessage(message: string) {
  const normalizedMessage = message.toLowerCase()

  if (
    normalizedMessage.includes("invalid login credentials") ||
    normalizedMessage.includes("email not confirmed")
  ) {
    return "Invalid email or password"
  }

  return "Unable to sign in right now. Please try again."
}

function getSafeSignUpErrorMessage(message: string) {
  const normalizedMessage = message.toLowerCase()

  if (normalizedMessage.includes("already registered")) {
    return "An account with this email already exists"
  }

  if (normalizedMessage.includes("password")) {
    return "Password does not meet the required security rules"
  }

  return "Unable to create your account right now. Please try again."
}

export async function signInWithEmail(email: string, password: string) {
  const supabase = await createSupabaseServerClient()

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    logError("[auth] Sign-in failed", { email, error })
    return { error: getSafeSignInErrorMessage(error.message) }
  }

  revalidatePath("/", "layout")
  return { error: null as string | null }
}

export async function signUpWithEmail(
  name: string,
  organization: string,
  email: string,
  password: string
) {
  const supabase = await createSupabaseServerClient()

  const nameParts = name.trim().split(/\s+/)
  const firstName = nameParts[0] || ""
  const lastName = nameParts.slice(1).join(" ") || ""

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        first_name: firstName,
        last_name: lastName,
      },
    },
  })

  if (error) {
    logError("[auth] Sign-up failed", { email, organization, error })
    return { error: getSafeSignUpErrorMessage(error.message) }
  }
  if (!data.user) return { error: "Failed to create account" }

  const adminClient = createSupabaseAdminClient()
  const normalizedEmail = email.trim().toLowerCase()

  // `create_tenant_for_new_user` expects a `public.users` row for this auth user.
  // Cloud Supabase often creates this via an auth trigger; self-hosted DBs may not,
  // so we ensure the profile exists before the RPC runs.
  const { error: profileError } = await adminClient.from("users").upsert(
    {
      id: data.user.id,
      email: data.user.email?.trim().toLowerCase() ?? normalizedEmail,
      first_name: firstName || null,
      last_name: lastName || null,
      is_active: true,
    },
    { onConflict: "id" }
  )

  if (profileError) {
    await adminClient.auth.admin.deleteUser(data.user.id)
    await supabase.auth.signOut()
    logError("[auth] Public user profile upsert failed after sign-up", {
      email,
      organization,
      userId: data.user.id,
      error: profileError,
    })
    return { error: "We couldn't finish setting up your account. Please try again or contact support." }
  }

  const { error: rpcError } = await adminClient.rpc(
    "create_tenant_for_new_user",
    {
      p_user_id: data.user.id,
      p_tenant_name: organization.trim(),
    }
  )

  if (rpcError) {
    await adminClient.from("users").delete().eq("id", data.user.id)
    const { error: deleteUserError } = await adminClient.auth.admin.deleteUser(data.user.id)
    await supabase.auth.signOut()

    logError("[auth] Tenant setup failed after sign-up", {
      email,
      organization,
      userId: data.user.id,
      error: rpcError,
      deleteUserError,
    })
    return { error: "We couldn't finish setting up your account. Please try again or contact support." }
  }

  revalidatePath("/", "layout")
  return { error: null as string | null }
}

export async function signOut() {
  const supabase = await createSupabaseServerClient()
  await supabase.auth.signOut()
  revalidatePath("/", "layout")
}
