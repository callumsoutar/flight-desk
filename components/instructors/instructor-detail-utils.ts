import type { BookingWithRelations } from "@/lib/types/bookings"
import type { InstructorDetailWithRelations } from "@/lib/types/instructors"

export function formatEnumLabel(value: string | null | undefined): string {
  if (!value) return "-"

  return value
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ")
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "-"

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"

  return date.toLocaleDateString("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "-"

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"

  return date.toLocaleString("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
}

export function formatHours(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "-"
  return `${value.toFixed(1)}h`
}

export function getInstructorDisplayName(instructor: InstructorDetailWithRelations): string {
  const firstName = instructor.user?.first_name ?? instructor.first_name ?? ""
  const lastName = instructor.user?.last_name ?? instructor.last_name ?? ""
  const fullName = `${firstName} ${lastName}`.trim()

  return fullName || instructor.user?.email || "Unknown Instructor"
}

export function getStudentDisplayName(booking: BookingWithRelations): string {
  const firstName = booking.student?.first_name ?? ""
  const lastName = booking.student?.last_name ?? ""
  const fullName = `${firstName} ${lastName}`.trim()

  return fullName || booking.student?.email || "-"
}
