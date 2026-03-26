const DEFAULT_AUTH_REDIRECT_PATH = "/dashboard"

export function sanitizeNextPath(
  input: string | null | undefined,
  fallback = DEFAULT_AUTH_REDIRECT_PATH
) {
  if (!input) return fallback
  if (!input.startsWith("/")) return fallback
  if (input.startsWith("//")) return fallback

  return input
}
