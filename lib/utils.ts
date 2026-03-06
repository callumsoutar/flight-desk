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

export function formatOrdinal(value: number) {
  const n = Math.trunc(value)
  if (!Number.isFinite(n)) return String(value)

  const abs = Math.abs(n)
  const mod100 = abs % 100
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`

  const mod10 = abs % 10
  if (mod10 === 1) return `${n}st`
  if (mod10 === 2) return `${n}nd`
  if (mod10 === 3) return `${n}rd`
  return `${n}th`
}
