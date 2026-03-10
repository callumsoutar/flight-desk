export function getXeroEnv() {
  const clientId = process.env.XERO_CLIENT_ID
  const clientSecret = process.env.XERO_CLIENT_SECRET
  const redirectUri = process.env.XERO_REDIRECT_URI

  if (!clientId) throw new Error("Missing XERO_CLIENT_ID")
  if (!clientSecret) throw new Error("Missing XERO_CLIENT_SECRET")
  if (!redirectUri) throw new Error("Missing XERO_REDIRECT_URI")

  return { clientId, clientSecret, redirectUri }
}
