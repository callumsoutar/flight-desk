"use client"

import dynamic from "next/dynamic"
import type { InstructorWithRelations } from "@/lib/types/instructors"

const InstructorsTable = dynamic(
  () => import("@/components/instructors/instructors-table").then((mod) => mod.InstructorsTable),
  { ssr: false }
)

type Props = {
  instructors: InstructorWithRelations[]
}

export function InstructorsPageClient({ instructors }: Props) {
  return <InstructorsTable instructors={instructors} />
}
