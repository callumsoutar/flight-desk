export type XeroConnectionPayload = {
  id: string
  tenantName: string
  tenantType: string
  createdDateUtc: string
  updatedDateUtc: string
}

export type XeroConnectionsResponse = XeroConnectionPayload[]

export type XeroTokenResponse = {
  token_type: string
  expires_in: number
  access_token: string
  refresh_token: string
  scope: string
}

export type XeroAccount = {
  AccountID: string
  Code?: string | null
  Name: string
  Type?: string | null
  Status?: string | null
  Class?: string | null
}

export type XeroAccountsResponse = {
  Accounts?: XeroAccount[]
}

export type XeroContact = {
  ContactID: string
  Name?: string | null
  EmailAddress?: string | null
}

export type XeroContactsResponse = {
  Contacts?: XeroContact[]
}

export type XeroCreateContactPayload = {
  Name: string
  FirstName?: string
  LastName?: string
  EmailAddress: string
  Phones?: Array<{ PhoneType: "MOBILE"; PhoneNumber: string }>
}

export type XeroInvoiceLineItem = {
  Description: string
  Quantity: number
  UnitAmount: number
  AccountCode: string
  TaxType: string
  LineAmount: number
}

export type XeroCreateInvoicePayload = {
  Type: "ACCREC"
  Contact: { ContactID: string }
  Date: string
  DueDate: string | null
  InvoiceNumber: string
  Reference: string | null
  Status: "DRAFT"
  LineItems: XeroInvoiceLineItem[]
}

export type XeroInvoicesResponse = {
  Invoices?: Array<{ InvoiceID: string }>
}

export class XeroApiError extends Error {
  status: number
  body: unknown

  constructor(message: string, status: number, body: unknown) {
    super(message)
    this.name = "XeroApiError"
    this.status = status
    this.body = body
  }
}

export class XeroAuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "XeroAuthError"
  }
}
