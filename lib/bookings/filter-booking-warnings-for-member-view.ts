import type {
  BookingWarningsResponse,
  BookingWarningsSummary,
  BookingWarningGroup,
} from "@/lib/types/booking-warnings"

/**
 * Members/students may only see pilot/member-scoped checkout warnings, not instructor or aircraft.
 */
export function filterBookingWarningsForMemberOrStudentView(
  response: BookingWarningsResponse
): BookingWarningsResponse {
  const byCategory = new Map(response.groups.map((g) => [g.category, g]))
  const pilot = byCategory.get("pilot")
  const instructor = byCategory.get("instructor")
  const aircraft = byCategory.get("aircraft")
  if (!pilot || !instructor || !aircraft) return response

  const emptyGroup = (group: BookingWarningGroup): BookingWarningGroup => ({
    ...group,
    warnings: [],
    warning_count: 0,
    blocking_count: 0,
  })

  const newGroups: BookingWarningGroup[] = [pilot, emptyGroup(instructor), emptyGroup(aircraft)]

  const counts: BookingWarningsSummary["counts"] = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  }
  for (const w of pilot.warnings) {
    counts[w.severity] += 1
  }
  const totalCount = pilot.warnings.length
  const blockingCount = pilot.warnings.filter((w) => w.blocking).length
  const hasBlockers = blockingCount > 0

  const summary: BookingWarningsSummary = {
    status: hasBlockers ? "blocked" : totalCount > 0 ? "warning" : "clear",
    has_blockers: hasBlockers,
    requires_acknowledgement: !hasBlockers && totalCount > 0,
    total_count: totalCount,
    blocking_count: blockingCount,
    counts,
  }

  return {
    ...response,
    summary,
    groups: newGroups,
  }
}
