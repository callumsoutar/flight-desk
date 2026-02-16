"use client"

import * as React from "react"
import type { User } from "@supabase/supabase-js"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

import { signOut as serverSignOut } from "@/app/actions/auth"
import type { UserRole } from "@/lib/types/roles"
import type { UserProfile } from "@/lib/auth/user-profile"

type AuthMeResponse = {
  user: User | null
  role: UserRole | null
  profile: UserProfile
}

type AuthContextValue = {
  user: User | null
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
  initialUser: User | null
  initialRole: UserRole | null
  initialProfile: UserProfile
}) {
  const router = useRouter()

  const [user, setUser] = React.useState<User | null>(initialUser)
  const [role, setRole] = React.useState<UserRole | null>(initialRole)
  const [profile, setProfile] = React.useState<UserProfile>(initialProfile)
  const [loading, setLoading] = React.useState<boolean>(true)

  const refreshUser = React.useCallback(async () => {
    try {
      const response = await fetch("/api/auth/me", {
        method: "GET",
        cache: "no-store",
        headers: { "cache-control": "no-store" },
      })

      if (!response.ok) throw new Error(`Failed to load auth state`)

      const json = (await response.json()) as AuthMeResponse
      setUser(json.user)
      setRole(json.role)
      setProfile(json.profile)
    } catch {
      setUser(null)
      setRole(null)
      setProfile(null)
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    refreshUser()

    const onFocus = () => {
      refreshUser()
    }
    window.addEventListener("focus", onFocus)

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
      window.removeEventListener("focus", onFocus)
      channel?.close()
    }
  }, [refreshUser])

  const signOut = React.useCallback(async () => {
    setUser(null)
    setRole(null)
    setProfile(null)

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

    router.refresh()
    window.location.assign("/login")
  }, [router])

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
