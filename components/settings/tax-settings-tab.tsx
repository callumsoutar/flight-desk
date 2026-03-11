"use client"

import { TaxRateManager } from "@/components/settings/tax-rate-manager"

export function TaxSettingsTab() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold tracking-tight text-slate-900">Tax Settings</h2>
        <p className="text-sm text-muted-foreground">
          Configure the default tax rate applied to new invoices, booking check-ins, and chargeable items.
        </p>
      </div>
      <TaxRateManager />
    </div>
  )
}
