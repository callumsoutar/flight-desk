"use client"

import * as React from "react"
import { toast } from "sonner"

import { XeroAccountSelect } from "@/components/settings/xero-account-select"
import { XeroTaxTypeSelect } from "@/components/settings/xero-tax-type-select"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
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

  const isDirty = React.useMemo(() => {
    return (
      form.default_revenue_account_code !== settings.default_revenue_account_code ||
      form.default_tax_type !== settings.default_tax_type
    )
  }, [form, settings])

  return (
    <div className="space-y-4 rounded-lg border bg-card p-4">
      <div className="space-y-2">
        <Label>Default revenue account</Label>
        <div className="w-full max-w-sm">
          <XeroAccountSelect
            value={form.default_revenue_account_code ?? ""}
            onChange={(code) => setForm((prev) => ({ ...prev, default_revenue_account_code: code || null }))}
            accountTypes={["REVENUE"]}
            disabled={disabled || saving}
            placeholder="Select default revenue account…"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Default tax type</Label>
        <div className="w-full max-w-sm">
          <XeroTaxTypeSelect
            value={form.default_tax_type ?? ""}
            onChange={(taxType) =>
              setForm((prev) => ({
                ...prev,
                default_tax_type: taxType.trim() ? taxType : null,
              }))
            }
            placeholder="Select default tax type…"
            disabled={disabled || saving}
            includeNoneOption={true}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Used when a taxable line item does not have a tax type set on its chargeable.
        </p>
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
        disabled={disabled || saving || !isDirty}
      >
        {saving ? "Saving..." : "Save Xero settings"}
      </Button>
    </div>
  )
}
