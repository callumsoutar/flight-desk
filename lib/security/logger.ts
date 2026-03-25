type LogLevel = "error" | "warn" | "info"

const REDACTED_PLACEHOLDER = "[redacted]"
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi
const BEARER_PATTERN = /\bBearer\s+[A-Za-z0-9\-._~+/]+=*\b/gi

const SENSITIVE_KEYS = new Set([
  "access_token",
  "refresh_token",
  "token",
  "authorization",
  "api_key",
  "apikey",
  "client_secret",
  "secret",
  "password",
  "email",
  "recipient_email",
  "reply_to",
  "cc",
  "body",
  "html",
  "attachments",
  "request_payload",
  "response_payload",
])

function sanitizeString(value: string) {
  return value
    .replace(EMAIL_PATTERN, REDACTED_PLACEHOLDER)
    .replace(BEARER_PATTERN, "Bearer [redacted]")
}

function sanitizeValue(value: unknown, key?: string, seen = new WeakSet<object>()): unknown {
  if (value == null) return value

  if (key && SENSITIVE_KEYS.has(key.toLowerCase())) {
    return REDACTED_PLACEHOLDER
  }

  if (typeof value === "string") {
    return sanitizeString(value)
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: sanitizeString(value.message),
    }
  }

  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeValue(entry, undefined, seen))
  }

  if (typeof value === "object") {
    if (seen.has(value as object)) {
      return "[circular]"
    }
    seen.add(value as object)

    const sanitizedEntries = Object.entries(value as Record<string, unknown>).map(([entryKey, entryValue]) => [
      entryKey,
      sanitizeValue(entryValue, entryKey, seen),
    ])

    return Object.fromEntries(sanitizedEntries)
  }

  return String(value)
}

function writeLog(level: LogLevel, message: string, context?: unknown) {
  if (context === undefined) {
    console[level](message)
    return
  }

  console[level](message, sanitizeValue(context))
}

export function logError(message: string, context?: unknown) {
  writeLog("error", message, context)
}

export function logWarn(message: string, context?: unknown) {
  writeLog("warn", message, context)
}

export function logInfo(message: string, context?: unknown) {
  writeLog("info", message, context)
}
