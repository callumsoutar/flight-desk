import type { Database, InvoiceRow, UserDirectoryRow } from "@/lib/types"

export type InvoiceStatus = Database["public"]["Enums"]["invoice_status"]

export type InvoiceUserLite = Pick<
  UserDirectoryRow,
  "id" | "first_name" | "last_name" | "email"
>

export type InvoiceWithRelations = InvoiceRow & {
  user: InvoiceUserLite | null
}

export type InvoicesFilter = {
  status?: InvoiceStatus[]
  user_id?: string
  search?: string
  start_date?: string
  end_date?: string
}
