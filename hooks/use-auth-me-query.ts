"use client"

import { useQuery } from "@tanstack/react-query"

import type { AuthUser } from "@/lib/auth/session"
import type { UserProfile } from "@/lib/auth/user-profile"
import type { UserRole } from "@/lib/types/roles"

export type AuthMeQueryData = {
  user: AuthUser | null
  role: UserRole | null
  profile: UserProfile
}

export function authMeQueryKey() {
  return ["auth", "me"] as const
}

export async function fetchAuthMeQuery(): Promise<AuthMeQueryData> {
  const response = await fetch("/api/auth/me", {
    method: "GET",
    cache: "no-store",
    headers: { "cache-control": "no-store" },
  })
  if (!response.ok) {
    throw new Error("Failed to load auth state")
  }

  return (await response.json()) as AuthMeQueryData
}

export function useAuthMeQuery(initialData: AuthMeQueryData) {
  return useQuery({
    queryKey: authMeQueryKey(),
    queryFn: fetchAuthMeQuery,
    initialData,
    staleTime: 30_000,
  })
}
