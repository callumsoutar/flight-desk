import type { Json } from "@/lib/types"

export type JsonObject = Record<string, Json>

export function isJsonObject(value: Json | null | undefined): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export function normalizeNullableString(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export function normalizeNonNegativeInt(value: unknown, fallback: number, max: number) {
  const raw =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : Number.NaN

  if (!Number.isFinite(raw)) return fallback
  const rounded = Math.round(raw)
  if (rounded < 0) return fallback
  return Math.min(max, rounded)
}
