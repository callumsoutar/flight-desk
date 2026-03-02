import type { ExperienceTypesRow } from "@/lib/types"

export type ExperienceType = ExperienceTypesRow

export type ExperienceTypeFormData = {
  name: string
  description: string
  is_active: boolean
}
