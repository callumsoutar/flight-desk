import type { UserProfile } from "@/lib/auth/user-profile"
import type { AuthUser } from "@/lib/auth/session"

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export function getUserDisplayName(user: AuthUser | null, profile: UserProfile): string {
  const firstName =
    (typeof profile === "object" && profile
      ? asNonEmptyString(profile["first_name"])
      : null) ??
    asNonEmptyString((user?.user_metadata ?? {})["first_name"])

  const lastName =
    (typeof profile === "object" && profile
      ? asNonEmptyString(profile["last_name"])
      : null) ??
    asNonEmptyString((user?.user_metadata ?? {})["last_name"])

  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim()

  if (fullName.length > 0) return fullName

  return (
    (typeof profile === "object" && profile
      ? asNonEmptyString(profile["name"])
      : null) ??
    asNonEmptyString((user?.user_metadata ?? {})["full_name"]) ??
    asNonEmptyString((user?.user_metadata ?? {})["name"]) ??
    user?.email ??
    "User"
  )
}

export function getUserFirstName(user: AuthUser | null, profile: UserProfile): string {
  const displayName = getUserDisplayName(user, profile).trim()
  return displayName.split(/\s+/)[0] || "User"
}
