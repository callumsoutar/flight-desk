export const TENANT_LOGO_BUCKET =
  process.env.SUPABASE_TENANT_LOGO_BUCKET ?? "company-logos"

export function isProbablyUrl(value: string) {
  return /^https?:\/\//i.test(value.trim())
}

