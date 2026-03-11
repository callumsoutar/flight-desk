import type {
  XeroAccountsResponse,
  XeroConnectionsResponse,
  XeroContactsResponse,
  XeroCreateContactPayload,
  XeroCreateInvoicePayload,
  XeroInvoicesResponse,
  XeroTaxRatesResponse,
} from "@/lib/xero/types"
import { z } from "zod"
import { XeroApiError } from "@/lib/xero/types"

function toBase64(value: string) {
  return Buffer.from(value).toString("base64")
}

async function parseResponseBody(response: Response) {
  const contentType = response.headers.get("content-type") ?? ""
  if (contentType.includes("application/json")) {
    return response.json().catch(() => null)
  }
  return response.text().catch(() => null)
}

const tokenResponseSchema = z.object({
  access_token: z.string().min(1, "Missing access_token"),
  refresh_token: z.string().min(1, "Missing refresh_token"),
  expires_in: z.number().finite().positive("Missing expires_in"),
  scope: z.string().optional(),
  token_type: z.string().optional(),
})

export type ValidatedXeroTokenResponse = z.infer<typeof tokenResponseSchema>

function validateTokenResponse(body: unknown): ValidatedXeroTokenResponse {
  const parsed = tokenResponseSchema.safeParse(body)
  if (!parsed.success) {
    throw new Error(`Invalid token response from Xero: ${parsed.error.issues.map((i) => i.message).join(", ")}`)
  }
  return parsed.data
}

async function xeroFetchWithRetry(
  input: string,
  init: RequestInit,
  retries = 3
): Promise<Response> {
  let attempt = 0
  let delayMs = 1000

  while (attempt < retries) {
    try {
      const response = await fetch(input, init)
      if (response.status !== 429) return response

      attempt += 1
      if (attempt >= retries) return response
      await new Promise((resolve) => setTimeout(resolve, delayMs))
      delayMs *= 2
    } catch (error) {
      attempt += 1
      if (attempt >= retries) throw error
      await new Promise((resolve) => setTimeout(resolve, delayMs))
      delayMs *= 2
    }
  }

  throw new Error("Xero request failed after retries")
}

export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string,
  clientId: string,
  clientSecret: string
) {
  const authorization = `Basic ${toBase64(`${clientId}:${clientSecret}`)}`
  const params = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  })

  const response = await fetch("https://identity.xero.com/connect/token", {
    method: "POST",
    headers: {
      authorization,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  })

  const body = await parseResponseBody(response)
  if (!response.ok) {
    console.error("[xero] Token exchange failed", { status: response.status, body })
    throw new XeroApiError("Failed to exchange authorization code", response.status, body)
  }

  return validateTokenResponse(body)
}

export async function refreshXeroTokens(
  refreshToken: string,
  clientId: string,
  clientSecret: string
) {
  const authorization = `Basic ${toBase64(`${clientId}:${clientSecret}`)}`
  const params = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  })

  const response = await fetch("https://identity.xero.com/connect/token", {
    method: "POST",
    headers: {
      authorization,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  })

  const body = await parseResponseBody(response)
  if (!response.ok) {
    console.error("[xero] Token refresh failed", { status: response.status, body })
    throw new XeroApiError("Failed to refresh Xero token", response.status, body)
  }

  return validateTokenResponse(body)
}

export async function revokeXeroToken(refreshToken: string, clientId: string, clientSecret: string) {
  const authorization = `Basic ${toBase64(`${clientId}:${clientSecret}`)}`
  const params = new URLSearchParams({
    token: refreshToken,
  })

  const response = await fetch("https://identity.xero.com/connect/revocation", {
    method: "POST",
    headers: {
      authorization,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  })

  if (!response.ok) {
    const body = await parseResponseBody(response)
    console.error("[xero] Token revoke failed", { status: response.status, body })
    throw new XeroApiError("Failed to revoke Xero token", response.status, body)
  }
}

function createApiHeaders(accessToken: string, xeroTenantId: string, idempotencyKey?: string) {
  return {
    authorization: `Bearer ${accessToken}`,
    "xero-tenant-id": xeroTenantId,
    accept: "application/json",
    "content-type": "application/json",
    ...(idempotencyKey ? { "idempotency-key": idempotencyKey } : {}),
  }
}

export async function fetchXeroConnections(accessToken: string) {
  const response = await fetch("https://api.xero.com/connections", {
    headers: {
      authorization: `Bearer ${accessToken}`,
      accept: "application/json",
    },
  })

  const body = await parseResponseBody(response)
  if (!response.ok) {
    console.error("[xero] Fetch connections failed", { status: response.status, body })
    throw new XeroApiError("Failed to fetch Xero connections", response.status, body)
  }

  return body as XeroConnectionsResponse
}

export function createXeroApiClient(accessToken: string, xeroTenantId: string) {
  return {
    async getAccounts() {
      const response = await xeroFetchWithRetry("https://api.xero.com/api.xro/2.0/Accounts", {
        method: "GET",
        headers: createApiHeaders(accessToken, xeroTenantId),
      })
      const body = await parseResponseBody(response)
      if (!response.ok) {
        console.error("[xero] Fetch accounts failed", { status: response.status, body })
        throw new XeroApiError("Failed to fetch Xero accounts", response.status, body)
      }
      return body as XeroAccountsResponse
    },

    async getTaxRates() {
      const response = await xeroFetchWithRetry("https://api.xero.com/api.xro/2.0/TaxRates", {
        method: "GET",
        headers: createApiHeaders(accessToken, xeroTenantId),
      })
      const body = await parseResponseBody(response)
      if (!response.ok) {
        console.error("[xero] Fetch tax rates failed", { status: response.status, body })
        throw new XeroApiError("Failed to fetch Xero tax rates", response.status, body)
      }
      return body as XeroTaxRatesResponse
    },

    async searchContactsByEmail(email: string) {
      const where = encodeURIComponent(`EmailAddress=="${email}"`)
      const url = `https://api.xero.com/api.xro/2.0/Contacts?where=${where}`
      const response = await xeroFetchWithRetry(url, {
        method: "GET",
        headers: createApiHeaders(accessToken, xeroTenantId),
      })
      const body = await parseResponseBody(response)
      if (!response.ok) {
        console.error("[xero] Contact search failed", { status: response.status, email, body })
        throw new XeroApiError("Failed to query Xero contacts", response.status, body)
      }
      return body as XeroContactsResponse
    },

    async createContact(payload: XeroCreateContactPayload) {
      const response = await xeroFetchWithRetry("https://api.xero.com/api.xro/2.0/Contacts", {
        method: "POST",
        headers: createApiHeaders(accessToken, xeroTenantId),
        body: JSON.stringify({ Contacts: [payload] }),
      })
      const body = await parseResponseBody(response)
      if (!response.ok) {
        console.error("[xero] Create contact failed", { status: response.status, body })
        throw new XeroApiError("Failed to create Xero contact", response.status, body)
      }
      return body as XeroContactsResponse
    },

    async createDraftInvoice(payload: XeroCreateInvoicePayload, idempotencyKey: string) {
      const response = await xeroFetchWithRetry("https://api.xero.com/api.xro/2.0/Invoices", {
        method: "PUT",
        headers: createApiHeaders(accessToken, xeroTenantId, idempotencyKey),
        body: JSON.stringify({ Invoices: [payload] }),
      })
      const body = await parseResponseBody(response)
      if (!response.ok) {
        console.error("[xero] Create draft invoice failed", {
          status: response.status,
          idempotencyKey,
          body,
        })
        throw new XeroApiError("Failed to export Xero invoice", response.status, body)
      }
      return body as XeroInvoicesResponse
    },
  }
}
