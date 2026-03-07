"use server"

import { revalidatePath } from "next/cache"

import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export async function signInWithEmail(email: string, password: string) {
  const supabase = await createSupabaseServerClient()

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) return { error: error.message }

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

  if (error) return { error: error.message }
  if (!data.user) return { error: "Failed to create account" }

  const adminClient = createSupabaseAdminClient()

  const { error: rpcError } = await adminClient.rpc(
    "create_tenant_for_new_user",
    {
      p_user_id: data.user.id,
      p_tenant_name: organization.trim(),
    }
  )

  if (rpcError) {
    return { error: `Account created but organization setup failed: ${rpcError.message}` }
  }

  revalidatePath("/", "layout")
  return { error: null as string | null }
}

export async function signOut() {
  const supabase = await createSupabaseServerClient()
  await supabase.auth.signOut()
  revalidatePath("/", "layout")
}
