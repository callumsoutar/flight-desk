import "server-only"

import { createSupabaseAdminClient } from "@/lib/supabase/admin"

// Force each service-role call site to state its purpose so privileged access
// is easier to identify during architecture and security review.
export function createPrivilegedSupabaseClient(purpose: string) {
  if (!purpose.trim()) {
    throw new Error("A non-empty privileged client purpose is required")
  }

  return createSupabaseAdminClient()
}
