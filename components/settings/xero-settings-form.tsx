"use client"

import * as React from "react"
import { toast } from "sonner"

import { XeroAccountSelect } from "@/components/settings/xero-account-select"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import type { XeroSettings } from "@/lib/settings/xero-settings"

export function XeroSettingsForm({
  settings,
  disabled,
  onSaved,
}: {
  settings: XeroSettings
  disabled?: boolean
  onSaved?: () => void
}) {
  const [form, setForm] = React.useState(settings)
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    setForm(settings)
  }, [settings])

  return (
    <div className="space-y-4 rounded-lg border bg-card p-4">
      <div className="space-y-2">
        <Label>Default revenue account</Label>
        <XeroAccountSelect
          value={form.default_revenue_account_code ?? ""}
          onChange={(code) => setForm((prev) => ({ ...prev, default_revenue_account_code: code || null }))}
          accountTypes={["REVENUE"]}
          disabled={disabled || saving}
          placeholder="Select default revenue account…"
        />
      </div>

      <div className="space-y-2">
        <Label>Default tax type</Label>
        <Input
          value={form.default_tax_type ?? ""}
          onChange={(event) =>
            setForm((prev) => ({
              ...prev,
              default_tax_type: event.target.value.trim() ? event.target.value.toUpperCase() : null,
            }))
          }
          placeholder="e.g. OUTPUT2 (optional)"
          disabled={disabled || saving}
        />
        <p className="text-xs text-muted-foreground">
          Optional Xero tax type code used when a taxable line does not have one set.
        </p>
      </div>

      <div className="flex items-center justify-between rounded-md border p-3">
        <div>
          <div className="text-sm font-medium">Auto-export on approve</div>
          <div className="text-xs text-muted-foreground">Future feature; keep disabled unless explicitly needed.</div>
        </div>
        <Switch
          checked={form.auto_export_on_approve}
          onCheckedChange={(checked) => setForm((prev) => ({ ...prev, auto_export_on_approve: checked }))}
          disabled={disabled || saving}
        />
      </div>

      <Button
        onClick={async () => {
          setSaving(true)
          const response = await fetch("/api/settings/xero", {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ xero: form }),
          })
          setSaving(false)
          if (!response.ok) {
            const body = (await response.json().catch(() => null)) as { error?: string } | null
            toast.error(body?.error ?? "Failed to save Xero settings")
            return
          }
          toast.success("Xero settings saved")
          onSaved?.()
        }}
        disabled={disabled || saving}
      >
        {saving ? "Saving..." : "Save Xero settings"}
      </Button>
    </div>
  )
}
