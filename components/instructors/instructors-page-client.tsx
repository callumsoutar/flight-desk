"use client"

import * as React from "react"
import dynamic from "next/dynamic"
import { useQueryClient } from "@tanstack/react-query"

import { useAuth } from "@/contexts/auth-context"
import { addInstructorOptionsQueryKey } from "@/hooks/use-add-instructor-options-query"
import type { InstructorWithRelations } from "@/lib/types/instructors"

const InstructorsTable = dynamic(
  () => import("@/components/instructors/instructors-table").then((mod) => mod.InstructorsTable),
  { ssr: false }
)

const AddInstructorModal = dynamic(
  () => import("@/components/instructors/add-instructor-modal").then((mod) => mod.AddInstructorModal),
  { ssr: false }
)

type Props = {
  instructors: InstructorWithRelations[]
}

export function InstructorsPageClient({ instructors }: Props) {
  const { role } = useAuth()
  const queryClient = useQueryClient()
  const canAddInstructor = role ? !["member", "student"].includes(role.toLowerCase()) : false
  const [addInstructorOpen, setAddInstructorOpen] = React.useState(false)

  const handleAddInstructorSuccess = React.useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: addInstructorOptionsQueryKey() })
  }, [queryClient])

  return (
    <>
      <InstructorsTable
        instructors={instructors}
        canAddInstructor={canAddInstructor}
        onAddInstructor={() => setAddInstructorOpen(true)}
      />
      <AddInstructorModal
        open={addInstructorOpen}
        onOpenChange={setAddInstructorOpen}
        onSuccess={handleAddInstructorSuccess}
      />
    </>
  )
}
