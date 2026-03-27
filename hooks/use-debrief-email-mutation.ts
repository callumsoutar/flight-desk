"use client"

function getApiError(payload: unknown, fallback: string) {
  return payload && typeof payload === "object" && typeof (payload as { error?: unknown }).error === "string"
    ? ((payload as { error: string }).error || fallback)
    : fallback
}

export async function sendDebriefEmailMutation(bookingId: string) {
  const response = await fetch("/api/email/send-debrief", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ booking_id: bookingId }),
  })
  const payload = (await response.json().catch(() => null)) as { error?: string; ok?: boolean } | null
  if (!response.ok) {
    throw new Error(getApiError(payload, "Failed to send debrief email"))
  }
}
