export function parseTimeToMinutes(value: string | null | undefined): number | null {
  if (!value) return null

  const trimmed = value.trim()
  const match = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/)
  if (!match) return null

  const hours = Number(match[1])
  const minutes = Number(match[2])
  const seconds = match[3] ? Number(match[3]) : 0

  if (Number.isNaN(hours) || Number.isNaN(minutes) || Number.isNaN(seconds)) return null
  if (hours < 0 || hours > 23) return null
  if (minutes < 0 || minutes > 59) return null
  if (seconds < 0 || seconds > 59) return null

  return hours * 60 + minutes
}

export function normalizeTimeToSql(value: string): string | null {
  const trimmed = value.trim()
  const match = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/)
  if (!match) return null

  const hours = Number(match[1])
  const minutes = Number(match[2])
  const seconds = match[3] ? Number(match[3]) : 0

  if (Number.isNaN(hours) || Number.isNaN(minutes) || Number.isNaN(seconds)) return null
  if (hours < 0 || hours > 23) return null
  if (minutes < 0 || minutes > 59) return null
  if (seconds < 0 || seconds > 59) return null

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
}
