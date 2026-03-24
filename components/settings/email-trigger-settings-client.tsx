"use client"

import { useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"

type TriggerMeta = {
  triggerKey: string
  label: string
  description: string
}

type TriggerConfig = {
  is_enabled: boolean
  from_name: string | null
  reply_to: string | null
  subject_template: string | null
  cc_emails: string[]
  notify_instructor: boolean
}

type SaveState = "idle" | "saving" | "saved" | "error"

export function EmailTriggerSettingsClient({
  triggerMeta,
  initialConfigs,
}: {
  triggerMeta: TriggerMeta[]
  initialConfigs: Record<string, TriggerConfig>
}) {
  const [configs, setConfigs] = useState<Record<string, TriggerConfig>>(
    () =>
      Object.fromEntries(
        triggerMeta.map(({ triggerKey }) => [
          triggerKey,
          initialConfigs[triggerKey] ?? {
            is_enabled: true,
            from_name: null,
            reply_to: null,
            subject_template: null,
            cc_emails: [],
            notify_instructor: false,
          },
        ])
      ) as Record<string, TriggerConfig>
  )
  const [saveState, setSaveState] = useState<Record<string, SaveState>>({})

  const bookingTriggers = useMemo(
    () => new Set(["booking_confirmed", "booking_cancelled", "booking_rescheduled", "booking_updated"]),
    []
  )

  const setTriggerConfig = (triggerKey: string, next: Partial<TriggerConfig>) => {
    setConfigs((current) => ({
      ...current,
      [triggerKey]: {
        ...current[triggerKey],
        ...next,
      },
    }))
  }

  const saveTrigger = async (triggerKey: string) => {
    setSaveState((current) => ({ ...current, [triggerKey]: "saving" }))
    const config = configs[triggerKey]

    const response = await fetch("/api/settings/email-triggers", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        trigger_key: triggerKey,
        is_enabled: config.is_enabled,
        from_name: config.from_name?.trim() || null,
        reply_to: config.reply_to?.trim() || null,
        subject_template: config.subject_template?.trim() || null,
        cc_emails: config.cc_emails.filter(Boolean),
        notify_instructor: config.notify_instructor,
      }),
    })

    if (!response.ok) {
      setSaveState((current) => ({ ...current, [triggerKey]: "error" }))
      return
    }

    setSaveState((current) => ({ ...current, [triggerKey]: "saved" }))
    window.setTimeout(() => {
      setSaveState((current) => ({ ...current, [triggerKey]: "idle" }))
    }, 1500)
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Email Triggers</h1>
        <p className="text-sm text-muted-foreground">
          Configure tenant-level automatic and manual email sends.
        </p>
      </div>
      {triggerMeta.map(({ triggerKey, label, description }) => {
        const config = configs[triggerKey]
        const state = saveState[triggerKey] ?? "idle"
        const ccValue = config.cc_emails.join(", ")

        return (
          <Card key={triggerKey}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-base">{label}</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">{description}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor={`enabled-${triggerKey}`} className="text-sm">
                    Enabled
                  </Label>
                  <Switch
                    id={`enabled-${triggerKey}`}
                    checked={config.is_enabled}
                    onCheckedChange={(value) => setTriggerConfig(triggerKey, { is_enabled: value })}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <details className="rounded-md border border-border p-3">
                <summary className="cursor-pointer text-sm font-medium">Advanced settings</summary>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor={`from-name-${triggerKey}`}>From name override</Label>
                    <Input
                      id={`from-name-${triggerKey}`}
                      value={config.from_name ?? ""}
                      onChange={(event) =>
                        setTriggerConfig(triggerKey, { from_name: event.target.value || null })
                      }
                      placeholder="Kapiti Aero Club"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`reply-to-${triggerKey}`}>Reply-to</Label>
                    <Input
                      id={`reply-to-${triggerKey}`}
                      type="email"
                      value={config.reply_to ?? ""}
                      onChange={(event) =>
                        setTriggerConfig(triggerKey, { reply_to: event.target.value || null })
                      }
                      placeholder="ops@club.co.nz"
                    />
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <Label htmlFor={`subject-${triggerKey}`}>Subject template</Label>
                    <Input
                      id={`subject-${triggerKey}`}
                      value={config.subject_template ?? ""}
                      onChange={(event) =>
                        setTriggerConfig(triggerKey, { subject_template: event.target.value || null })
                      }
                      placeholder="Booking Confirmed - {{memberFirstName}}"
                    />
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <Label htmlFor={`cc-${triggerKey}`}>CC emails (comma-separated)</Label>
                    <Input
                      id={`cc-${triggerKey}`}
                      value={ccValue}
                      onChange={(event) =>
                        setTriggerConfig(triggerKey, {
                          cc_emails: event.target.value
                            .split(",")
                            .map((value) => value.trim())
                            .filter(Boolean),
                        })
                      }
                      placeholder="ops@club.co.nz, safety@club.co.nz"
                    />
                  </div>
                  {bookingTriggers.has(triggerKey) ? (
                    <div className="flex items-center gap-2 md:col-span-2">
                      <Switch
                        id={`notify-instructor-${triggerKey}`}
                        checked={config.notify_instructor}
                        onCheckedChange={(value) =>
                          setTriggerConfig(triggerKey, { notify_instructor: value })
                        }
                      />
                      <Label htmlFor={`notify-instructor-${triggerKey}`}>
                        Also notify assigned instructor
                      </Label>
                    </div>
                  ) : null}
                </div>
              </details>

              <div className="flex items-center gap-3">
                <Button onClick={() => void saveTrigger(triggerKey)} disabled={state === "saving"}>
                  {state === "saving" ? "Saving..." : "Save trigger"}
                </Button>
                {state === "saved" ? <p className="text-sm text-green-700">Saved</p> : null}
                {state === "error" ? <p className="text-sm text-red-700">Save failed</p> : null}
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
