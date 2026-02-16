export type UserRole = "owner" | "admin" | "instructor" | "member" | "student"

export const ROLE_HIERARCHY: UserRole[] = [
  "student",
  "member",
  "instructor",
  "admin",
  "owner",
]

export function isRoleAtLeast(role: UserRole, minimumRole: UserRole): boolean {
  return ROLE_HIERARCHY.indexOf(role) >= ROLE_HIERARCHY.indexOf(minimumRole)
}

