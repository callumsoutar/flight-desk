export type AccountStatementEntryType =
  | "invoice"
  | "payment"
  | "credit_note"
  | "opening_balance"

export type AccountStatementEntry = {
  entry_id: string
  entry_type: AccountStatementEntryType
  date: string
  reference: string
  description: string
  amount: number
  balance: number
}

export type AccountStatementResponse = {
  statement: AccountStatementEntry[]
  closing_balance: number
}
