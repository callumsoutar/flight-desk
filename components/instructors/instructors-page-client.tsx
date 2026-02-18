"use client"

import { InstructorsTable } from "@/components/instructors/instructors-table"
import type { InstructorWithRelations } from "@/lib/types/instructors"

type Props = {
  instructors: InstructorWithRelations[]
}

export function InstructorsPageClient({ instructors }: Props) {
  return <InstructorsTable instructors={instructors} />
}
