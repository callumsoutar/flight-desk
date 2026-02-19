import type { SupabaseClient, User } from "@supabase/supabase-js"

export type UserProfile = Record<string, unknown> | null
type UserIdentity = Pick<User, "id">

export async function fetchUserProfile(
  supabase: SupabaseClient,
  user: UserIdentity
): Promise<UserProfile> {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .maybeSingle()

  if (error) return null
  return (data ?? null) as UserProfile
}
