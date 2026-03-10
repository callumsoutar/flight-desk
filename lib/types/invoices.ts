import type { Database, InvoiceRow, UserDirectoryRow } from "@/lib/types"

export type InvoiceStatus = Database["public"]["Enums"]["invoice_status"]

export type InvoiceUserLite = Pick<
  UserDirectoryRow,
  "id" | "first_name" | "last_name" | "email"
>

export type InvoiceWithRelations = InvoiceRow & {
  user: InvoiceUserLite | null
  xero_export_status?: Database["public"]["Enums"]["xero_export_status"] | null
  xero_invoice_id?: string | null
  xero_exported_at?: string | null
  xero_error_message?: string | null
}

export type InvoicesFilter = {
  status?: InvoiceStatus[]
  user_id?: string
  search?: string
  start_date?: string
  end_date?: string
}
