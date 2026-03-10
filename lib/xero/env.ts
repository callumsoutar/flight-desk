// Apps created 2 March 2026+ use granular scopes. Old broad scope accounting.transactions is deprecated.
const DEFAULT_XERO_SCOPES =
  "openid profile email accounting.invoices accounting.contacts accounting.settings.read offline_access"

export function getXeroEnv() {
  const clientId = process.env.XERO_CLIENT_ID
  const clientSecret = process.env.XERO_CLIENT_SECRET
  const redirectUri = process.env.XERO_REDIRECT_URI
  const scopes = process.env.XERO_SCOPES ?? DEFAULT_XERO_SCOPES

  if (!clientId) throw new Error("Missing XERO_CLIENT_ID")
  if (!clientSecret) throw new Error("Missing XERO_CLIENT_SECRET")
  if (!redirectUri) throw new Error("Missing XERO_REDIRECT_URI")

  return { clientId, clientSecret, redirectUri, scopes }
}
