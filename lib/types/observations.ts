import type { Database } from "@/lib/types/database"
import type { ObservationRow, UserDirectoryRow } from "@/lib/types"

type DirectoryUserLite = Pick<UserDirectoryRow, "id" | "first_name" | "last_name" | "email">

export type ObservationStage = Database["public"]["Enums"]["observation_stage"]
export type ObservationPriority = "low" | "medium" | "high"

export type ObservationWithUser = ObservationRow & {
  reported_by_user: DirectoryUserLite | null
}

export type ObservationWithUsers = ObservationRow & {
  reported_by_user: DirectoryUserLite | null
  assigned_to_user: DirectoryUserLite | null
}
