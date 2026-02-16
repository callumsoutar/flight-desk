import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getUserInitials(
  firstName?: string | null,
  lastName?: string | null,
  email?: string | null
) {
  const first = firstName?.trim() ?? ""
  const last = lastName?.trim() ?? ""

  if (first || last) {
    return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase() || "U"
  }

  if (email) {
    return email.slice(0, 2).toUpperCase()
  }

  return "U"
}
