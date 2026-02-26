export type InvoiceCreateMember = {
  id: string
  first_name: string | null
  last_name: string | null
  email: string
}

export type InvoiceCreateChargeable = {
  id: string
  name: string
  description: string | null
  rate: number | null
  is_taxable: boolean | null
  chargeable_type_id: string
}

export type InvoiceCreateActionItemInput = {
  chargeableId: string
  quantity: number
  unitPrice: number
}

export type InvoiceCreateActionInput = {
  userId: string
  issueDate?: string
  dueDate?: string | null
  reference?: string | null
  notes?: string | null
  items: InvoiceCreateActionItemInput[]
}
