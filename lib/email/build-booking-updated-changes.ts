export type BookingUpdatedComparable = {
  aircraftRegistration: string | null
  instructorName: string | null
  purpose: string | null
  description: string | null
  lessonName: string | null
}

export type BookingUpdatedChange = {
  label: string
  before: string
  after: string
}

function normalize(value: string | null | undefined): string {
  return (value ?? "").trim()
}

function toDisplay(value: string, fallback: string): string {
  return value || fallback
}

export function buildBookingUpdatedChanges(
  before: BookingUpdatedComparable,
  after: BookingUpdatedComparable
): BookingUpdatedChange[] {
  const changes: BookingUpdatedChange[] = []

  const beforeAircraft = normalize(before.aircraftRegistration)
  const afterAircraft = normalize(after.aircraftRegistration)
  if (beforeAircraft !== afterAircraft) {
    changes.push({
      label: "Aircraft",
      before: toDisplay(beforeAircraft, "Unassigned"),
      after: toDisplay(afterAircraft, "Unassigned"),
    })
  }

  const beforeInstructor = normalize(before.instructorName)
  const afterInstructor = normalize(after.instructorName)
  if (beforeInstructor !== afterInstructor) {
    changes.push({
      label: "Instructor",
      before: toDisplay(beforeInstructor, "Unassigned"),
      after: toDisplay(afterInstructor, "Unassigned"),
    })
  }

  const beforePurpose = normalize(before.purpose)
  const afterPurpose = normalize(after.purpose)
  if (beforePurpose !== afterPurpose) {
    changes.push({
      label: "Booking description",
      before: toDisplay(beforePurpose, "Not set"),
      after: toDisplay(afterPurpose, "Not set"),
    })
  }

  const beforeDescription = normalize(before.description)
  const afterDescription = normalize(after.description)
  if (beforeDescription !== afterDescription) {
    changes.push({
      label: "Remarks",
      before: toDisplay(beforeDescription, "No remarks"),
      after: toDisplay(afterDescription, "No remarks"),
    })
  }

  const beforeLesson = normalize(before.lessonName)
  const afterLesson = normalize(after.lessonName)
  if (beforeLesson !== afterLesson) {
    changes.push({
      label: "Lesson",
      before: toDisplay(beforeLesson, "Unassigned"),
      after: toDisplay(afterLesson, "Unassigned"),
    })
  }

  return changes
}
