import type { UserRole } from "@/lib/types/roles"

const USER_ROLES = new Set<UserRole>([
  "owner",
  "admin",
  "instructor",
  "member",
  "student",
])

export function claimsRoleToUserRole(roleClaim: unknown): UserRole | null {
  if (typeof roleClaim !== "string") return null
  if (!roleClaim.startsWith("app_")) return null

  const role = roleClaim.slice("app_".length)
  if (!isUserRole(role)) return null

  return role
}

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === "string" && USER_ROLES.has(value as UserRole)
}
