import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/types"

/**
 * RPCs not yet in generated `Database["public"]["Functions"]` need a loose call.
 * Never do `const rpc = supabase.rpc; rpc(...)` — that breaks `this` and returns empty/errors.
 */
export async function callSupabaseRpc(
  supabase: SupabaseClient<Database>,
  fn: string,
  args: Record<string, unknown>
): Promise<{ data: unknown; error: { message?: string; code?: string } | null }> {
  // Property access keeps `this` bound to the client (required by @supabase/supabase-js).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase as any).rpc(fn, args)
}
