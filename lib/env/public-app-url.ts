function normalizeUrl(value: string | undefined): string | null {
  if (!value) return null

  try {
    const url = new URL(value)
    if (url.protocol !== "http:" && url.protocol !== "https:") return null
    return url.origin
  } catch {
    return null
  }
}

export function getPublicAppUrl(): string | null {
  const configuredUrl = normalizeUrl(process.env.NEXT_PUBLIC_APP_URL)
  if (configuredUrl) return configuredUrl

  const vercelProductionUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  if (vercelProductionUrl) {
    return normalizeUrl(`https://${vercelProductionUrl}`)
  }

  const vercelPreviewUrl = process.env.VERCEL_URL
  if (vercelPreviewUrl) {
    return normalizeUrl(`https://${vercelPreviewUrl}`)
  }

  if (process.env.NODE_ENV !== "production") {
    return "http://localhost:3000"
  }

  return null
}

export function getRequiredPublicAppUrl(): string {
  const appUrl = getPublicAppUrl()
  if (appUrl) return appUrl

  throw new Error(
    "Missing public app URL. Set NEXT_PUBLIC_APP_URL (recommended) or provide Vercel runtime URL env vars."
  )
}
