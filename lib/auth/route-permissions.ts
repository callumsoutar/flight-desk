import type { UserRole } from "@/lib/types/roles"

type RoutePermission = {
  prefix: string
  allowedRoles: UserRole[]
}

const ALL_ROLES: UserRole[] = ["owner", "admin", "instructor", "member", "student"]
const STAFF_ROLES: UserRole[] = ["owner", "admin", "instructor"]
const ADMIN_ROLES: UserRole[] = ["owner", "admin"]

// Most-specific prefixes first to avoid broad prefix collisions.
const ROUTE_PERMISSIONS: RoutePermission[] = [
  { prefix: "/reports/financial", allowedRoles: ADMIN_ROLES },
  { prefix: "/invoices", allowedRoles: STAFF_ROLES },
  { prefix: "/members", allowedRoles: STAFF_ROLES },
  { prefix: "/reports", allowedRoles: STAFF_ROLES },
  { prefix: "/training", allowedRoles: STAFF_ROLES },
  { prefix: "/instructors", allowedRoles: ADMIN_ROLES },
  { prefix: "/equipment", allowedRoles: STAFF_ROLES },
  { prefix: "/rosters", allowedRoles: ADMIN_ROLES },
  { prefix: "/settings", allowedRoles: ADMIN_ROLES },
  { prefix: "/aircraft", allowedRoles: STAFF_ROLES },
  { prefix: "/bookings", allowedRoles: ALL_ROLES },
  { prefix: "/scheduler", allowedRoles: ALL_ROLES },
  { prefix: "/dashboard", allowedRoles: ALL_ROLES },
]

export function getAllowedRolesForPath(pathname: string): UserRole[] | null {
  for (const rule of ROUTE_PERMISSIONS) {
    if (pathname === rule.prefix || pathname.startsWith(`${rule.prefix}/`)) {
      return rule.allowedRoles
    }
  }
  return null
}

export function isRoleAllowedForPath(pathname: string, role: UserRole | null): boolean {
  const allowedRoles = getAllowedRolesForPath(pathname)
  if (!allowedRoles) return true
  if (!role) {
    // Middleware only has JWT claims (`getClaims`). Without custom claims (e.g. `app_role`),
    // role is null on many self-hosted setups. We cannot evaluate staff vs member here—allow
    // the request through and enforce route-level access in Server Components / APIs, which
    // resolve role from Postgres (`authoritativeRole` / `getRequiredApiSession`).
    return true
  }
  return allowedRoles.includes(role)
}

