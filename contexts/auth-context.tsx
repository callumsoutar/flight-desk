"use client"

import * as React from "react"
import { toast } from "sonner"
import { useQueryClient } from "@tanstack/react-query"

import { signOut as serverSignOut } from "@/app/actions/auth"
import type { AuthUser } from "@/lib/auth/session"
import type { UserRole } from "@/lib/types/roles"
import type { UserProfile } from "@/lib/auth/user-profile"
import { authMeQueryKey, useAuthMeQuery, type AuthMeQueryData } from "@/hooks/use-auth-me-query"

type AuthContextValue = {
  user: AuthUser | null
  role: UserRole | null
  profile: UserProfile
  loading: boolean
  refreshUser: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = React.createContext<AuthContextValue | null>(null)
const AUTH_BROADCAST_CHANNEL = "aerosafety-auth"

export function AuthProvider({
  children,
  initialUser,
  initialRole,
  initialProfile,
}: {
  children: React.ReactNode
  initialUser: AuthUser | null
  initialRole: UserRole | null
  initialProfile: UserProfile
}) {
  const queryClient = useQueryClient()
  const initialAuthData = React.useMemo<AuthMeQueryData>(
    () => ({ user: initialUser, role: initialRole, profile: initialProfile }),
    [initialUser, initialRole, initialProfile]
  )
  const { data, isFetching, refetch } = useAuthMeQuery(initialAuthData)
  const user = data?.user ?? null
  const role = data?.role ?? null
  const profile = data?.profile ?? null
  const loading = isFetching

  const clearAuthCache = React.useCallback(() => {
    queryClient.setQueryData<AuthMeQueryData>(authMeQueryKey(), {
      user: null,
      role: null,
      profile: null,
    })
  }, [queryClient])

  const refreshUser = React.useCallback(async () => {
    try {
      const result = await refetch()
      if (result.error) {
        clearAuthCache()
      }
    } catch {
      clearAuthCache()
    }
  }, [clearAuthCache, refetch])

  React.useEffect(() => {
    const channel =
      "BroadcastChannel" in window
        ? new BroadcastChannel(AUTH_BROADCAST_CHANNEL)
        : null

    if (channel) {
      channel.onmessage = (event) => {
        if (event?.data === "auth-changed") refreshUser()
      }
    }

    return () => {
      channel?.close()
    }
  }, [refreshUser])

  const signOut = React.useCallback(async () => {
    clearAuthCache()

    try {
      await serverSignOut()
    } catch {
      toast.error("Failed to sign out")
    }

    try {
      if ("BroadcastChannel" in window) {
        const bc = new BroadcastChannel(AUTH_BROADCAST_CHANNEL)
        bc.postMessage("auth-changed")
        bc.close()
      }
    } catch {
      // ignore
    }

    window.location.assign("/login")
  }, [clearAuthCache])

  const value = React.useMemo<AuthContextValue>(
    () => ({ user, role, profile, loading, refreshUser, signOut }),
    [user, role, profile, loading, refreshUser, signOut]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = React.useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider")
  return ctx
}
