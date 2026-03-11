"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { toast } from "sonner"

import { GlCodeSelect } from "@/components/settings/gl-code-select"
import { XeroTaxTypeSelect } from "@/components/settings/xero-tax-type-select"
import { Button } from "@/components/ui/button"
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
  const { data: taxRates = [] } = useQuery({
    queryKey: ["xero", "tax-rates", "active"],
    queryFn: async () => {
      const response = await fetch("/api/xero/tax-rates", { cache: "no-store" })
      if (!response.ok) return [] as Array<{ xero_tax_type: string; status: string }>
      const body = (await response.json().catch(() => null)) as {
        taxRates?: Array<{ xero_tax_type: string; status: string }>
      } | null
      return (body?.taxRates ?? []).filter((taxRate) => taxRate.status === "ACTIVE")
    },
    staleTime: 60_000,
  })
  const hasTaxRates = taxRates.length > 0

  React.useEffect(() => {
    setForm(settings)
  }, [settings])

  return (
    <div className="space-y-4 rounded-lg border bg-card p-4">
      <div className="space-y-2">
        <Label>Default revenue account</Label>
        <GlCodeSelect
          value={form.default_revenue_account_code ?? ""}
          onValueChange={(value) => setForm((prev) => ({ ...prev, default_revenue_account_code: value || null }))}
          disabled={disabled || saving}
        />
      </div>

      <div className="space-y-2">
        <Label>Default tax type</Label>
        <XeroTaxTypeSelect
          value={form.default_tax_type ?? ""}
          onValueChange={(value) => setForm((prev) => ({ ...prev, default_tax_type: value || null }))}
          disabled={disabled || saving || !hasTaxRates}
        />
        {!hasTaxRates ? (
          <p className="text-xs text-muted-foreground">
            Sync Accounts & Tax Rates from Xero before selecting a default tax type.
          </p>
        ) : null}
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
