/**
 * Trial bookings resolve guests by email (public.users). Reusing the wrong
 * person happens when a placeholder/typo email matches another profile.
 */
const DISALLOWED_EXACT = new Set([
  "guest@example.com",
  "name@example.com",
  "test@example.com",
  "user@example.com",
  "admin@example.com",
])

/**
 * @example.com is reserved; trial guests should not use it as a real address.
 * Blocks common local parts that match our UI copy-paste mistakes.
 */
export function isDisallowedTrialGuestEmail(normalizedEmail: string): boolean {
  if (DISALLOWED_EXACT.has(normalizedEmail)) return true
  const at = normalizedEmail.indexOf("@")
  if (at < 0) return true
  const local = normalizedEmail.slice(0, at).toLowerCase()
  const domain = normalizedEmail.slice(at + 1).toLowerCase()
  if (domain === "example.com" && ["guest", "name", "test", "user", "demo", "sample"].includes(local)) {
    return true
  }
  return false
}

/**
 * If an existing user already has a name on file, the trial guest's name should match.
 * Otherwise the booking is attached to the wrong person (same email collision).
 */
export function trialGuestNameConflictsWithExistingUser(
  guestFirstName: string,
  guestLastName: string,
  existingFirstName: string | null,
  existingLastName: string | null
): boolean {
  const g1 = guestFirstName.trim().toLowerCase()
  const g2 = guestLastName.trim().toLowerCase()
  const e1 = (existingFirstName ?? "").trim()
  const e2 = (existingLastName ?? "").trim()
  if (e1 && e1.toLowerCase() !== g1) return true
  if (e2 && e2.toLowerCase() !== g2) return true
  return false
}
