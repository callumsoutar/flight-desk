import type { CancellationCategoriesRow } from "@/lib/types/tables"

export type CancellationCategory = Pick<
  CancellationCategoriesRow,
  "id" | "name" | "description"
>

