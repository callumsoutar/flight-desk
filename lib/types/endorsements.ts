import type { EndorsementsRow } from "@/lib/types"

export type Endorsement = EndorsementsRow

export type EndorsementFormData = {
  name: string
  description: string
  is_active: boolean
}

