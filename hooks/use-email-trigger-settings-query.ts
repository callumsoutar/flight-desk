"use client"

function getApiError(payload: unknown, fallback: string) {
  return payload && typeof payload === "object" && typeof (payload as { error?: unknown }).error === "string"
    ? ((payload as { error: string }).error || fallback)
    : fallback
}

export async function updateEmailTriggerSettings(input: {
  trigger_key: string
  is_enabled: boolean
  from_name: string | null
  reply_to: string | null
  subject_template: string | null
  cc_emails: string[]
  notify_instructor: boolean
}) {
  const response = await fetch("/api/settings/email-triggers", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new Error(getApiError(payload, "Failed to save trigger"))
  }
}
