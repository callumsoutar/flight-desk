"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  IconAutomation,
  IconCreditCard,
  IconFileInvoice,
  IconMessage,
} from "@tabler/icons-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { StickyFormActions } from "@/components/ui/sticky-form-actions"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import type { InvoicingSettings } from "@/lib/settings/invoicing-settings"

type InvoicingSettingsResponse = { settings: InvoicingSettings }

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message
  return "Something went wrong."
}

async function patchInvoicingSettings(payload: unknown): Promise<InvoicingSettingsResponse> {
  const response = await fetch("/api/settings/invoicing", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const data = await response.json().catch(() => null)
    const message =
      data && typeof data === "object" && typeof data.error === "string"
        ? data.error
        : "Failed to update settings"
    throw new Error(message)
  }

  return (await response.json()) as InvoicingSettingsResponse
}

function createFormState(settings: InvoicingSettings | null) {
  return {
    invoice_prefix: settings?.invoice_prefix ?? "INV",
    default_invoice_due_days: settings?.default_invoice_due_days ?? 7,
    payment_terms_days: settings?.payment_terms_days ?? 30,
    payment_terms_message: settings?.payment_terms_message ?? "Payment terms: Net 30 days.",
    invoice_footer_message: settings?.invoice_footer_message ?? "Thank you for your business.",
    auto_generate_invoices: settings?.auto_generate_invoices ?? false,
    include_logo_on_invoice: settings?.include_logo_on_invoice ?? true,
    invoice_due_reminder_days: settings?.invoice_due_reminder_days ?? 7,
    late_fee_percentage: settings?.late_fee_percentage ?? 0,
  }
}

export function InvoicingTab({
  initialSettings,
  loadError,
}: {
  initialSettings: InvoicingSettings | null
  loadError: string | null
}) {
  const router = useRouter()
  const [form, setForm] = React.useState(() => createFormState(initialSettings))
  const [baseSettings, setBaseSettings] = React.useState<InvoicingSettings | null>(initialSettings)
  const [isSaving, setIsSaving] = React.useState(false)

  React.useEffect(() => {
    setBaseSettings(initialSettings)
    setForm(createFormState(initialSettings))
  }, [initialSettings])

  const baseForm = React.useMemo(() => createFormState(baseSettings), [baseSettings])

  const dirty =
    form.invoice_prefix.trim() !== baseForm.invoice_prefix.trim() ||
    form.default_invoice_due_days !== baseForm.default_invoice_due_days ||
    form.payment_terms_days !== baseForm.payment_terms_days ||
    form.payment_terms_message !== baseForm.payment_terms_message ||
    form.invoice_footer_message !== baseForm.invoice_footer_message ||
    form.auto_generate_invoices !== baseForm.auto_generate_invoices ||
    form.include_logo_on_invoice !== baseForm.include_logo_on_invoice ||
    form.invoice_due_reminder_days !== baseForm.invoice_due_reminder_days ||
    form.late_fee_percentage !== baseForm.late_fee_percentage

  const canSave = dirty && form.invoice_prefix.trim().length > 0 && !isSaving
  const onUndo = () => {
    setForm(baseForm)
  }

  if (loadError) {
    return (
      <Card className="border border-border/50 bg-card shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg text-slate-900">Invoicing</CardTitle>
          <CardDescription>{loadError}</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (!initialSettings) {
    return (
      <Card className="border border-border/50 bg-card shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg text-slate-900">Invoicing</CardTitle>
          <CardDescription>Settings are not available yet for this tenant.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const onSave = async () => {
    setIsSaving(true)
    try {
      const result = await patchInvoicingSettings({
        invoicing: {
          invoice_prefix: form.invoice_prefix.trim(),
          default_invoice_due_days: form.default_invoice_due_days,
          payment_terms_days: form.payment_terms_days,
          payment_terms_message: form.payment_terms_message,
          invoice_footer_message: form.invoice_footer_message,
          auto_generate_invoices: form.auto_generate_invoices,
          include_logo_on_invoice: form.include_logo_on_invoice,
          invoice_due_reminder_days: form.invoice_due_reminder_days,
          late_fee_percentage: form.late_fee_percentage,
        },
      })
      setBaseSettings(result.settings)
      toast.success("Invoicing settings saved")
      router.refresh()
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold tracking-tight text-slate-900">Invoicing</h2>
            {dirty ? (
              <Badge className="border-amber-200 bg-amber-50 text-amber-700" variant="outline">
                Unsaved changes
              </Badge>
            ) : (
              <Badge className="border-slate-200 bg-white text-slate-600" variant="outline">
                Up to date
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Configure invoice numbering, payment terms, and automation defaults.
          </p>
        </div>
      </div>

      <Card className="border border-border/50 bg-card shadow-sm overflow-hidden rounded-2xl">
        <CardHeader className="border-b border-border/40">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <CardTitle className="text-lg text-slate-900">Invoice defaults</CardTitle>
              <CardDescription>
                These values apply to new invoices and automated notifications.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-8">
          <div className="space-y-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <IconFileInvoice className="h-4 w-4 text-slate-500" />
              Numbering & due dates
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="invoice-prefix" className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Invoice prefix
                </Label>
                <Input
                  id="invoice-prefix"
                  value={form.invoice_prefix}
                  onChange={(e) => setForm((prev) => ({ ...prev, invoice_prefix: e.target.value }))}
                  className="h-11 rounded-xl border-slate-200 bg-white"
                  placeholder="INV"
                />
                <p className="text-[11px] font-medium text-slate-500">
                  Used as the first part of invoice numbers (e.g. INV-000123).
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="invoice-due-days" className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Default due (days)
                </Label>
                <Input
                  id="invoice-due-days"
                  type="number"
                  min={0}
                  value={form.default_invoice_due_days}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      default_invoice_due_days: Number.parseInt(e.target.value || "0", 10) || 0,
                    }))
                  }
                  className="h-11 rounded-xl border-slate-200 bg-white"
                />
                <p className="text-[11px] font-medium text-slate-500">
                  The default number of days until an invoice is due.
                </p>
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <IconCreditCard className="h-4 w-4 text-slate-500" />
              Payment terms
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="payment-terms-days" className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Payment terms (days)
                </Label>
                <Input
                  id="payment-terms-days"
                  type="number"
                  min={0}
                  value={form.payment_terms_days}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      payment_terms_days: Number.parseInt(e.target.value || "0", 10) || 0,
                    }))
                  }
                  className="h-11 rounded-xl border-slate-200 bg-white"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="late-fee" className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Late fee (%)
                </Label>
                <Input
                  id="late-fee"
                  type="number"
                  min={0}
                  step={0.1}
                  value={form.late_fee_percentage}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      late_fee_percentage: Number.parseFloat(e.target.value || "0") || 0,
                    }))
                  }
                  className="h-11 rounded-xl border-slate-200 bg-white"
                />
                <p className="text-[11px] font-medium text-slate-500">
                  Applied when an invoice is overdue (if enabled).
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="payment-terms-message" className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Payment terms message
              </Label>
              <Textarea
                id="payment-terms-message"
                value={form.payment_terms_message}
                onChange={(e) => setForm((prev) => ({ ...prev, payment_terms_message: e.target.value }))}
                className="min-h-[96px] resize-none rounded-xl border-slate-200 bg-white"
                placeholder="Payment terms: Net 30 days."
              />
              <p className="text-[11px] font-medium text-slate-500">Appears on invoices under the totals.</p>
            </div>
          </div>

          <Separator />

          <div className="space-y-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <IconMessage className="h-4 w-4 text-slate-500" />
              Invoice messages
            </div>
            <div className="space-y-2">
              <Label htmlFor="invoice-footer-message" className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Footer message
              </Label>
              <Textarea
                id="invoice-footer-message"
                value={form.invoice_footer_message}
                onChange={(e) => setForm((prev) => ({ ...prev, invoice_footer_message: e.target.value }))}
                className="min-h-[96px] resize-none rounded-xl border-slate-200 bg-white"
                placeholder="Thank you for your business."
              />
              <p className="text-[11px] font-medium text-slate-500">Displays at the bottom of invoices and receipts.</p>
            </div>
          </div>

          <Separator />

          <div className="space-y-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <IconAutomation className="h-4 w-4 text-slate-500" />
              Automation & reminders
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Auto-generate invoices</p>
                  <p className="text-sm text-muted-foreground">
                    Automatically generate invoices after flights and bookings.
                  </p>
                </div>
                <Switch
                  checked={form.auto_generate_invoices}
                  onCheckedChange={(checked) => setForm((prev) => ({ ...prev, auto_generate_invoices: checked }))}
                />
              </div>

              <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Include logo on invoices</p>
                  <p className="text-sm text-muted-foreground">
                    Use your company logo on printed invoices and PDFs.
                  </p>
                </div>
                <Switch
                  checked={form.include_logo_on_invoice}
                  onCheckedChange={(checked) => setForm((prev) => ({ ...prev, include_logo_on_invoice: checked }))}
                />
              </div>
            </div>

            <div className="space-y-2 max-w-xs">
              <Label htmlFor="invoice-reminder-days" className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Reminder before due (days)
              </Label>
              <Input
                id="invoice-reminder-days"
                type="number"
                min={0}
                value={form.invoice_due_reminder_days}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    invoice_due_reminder_days: Number.parseInt(e.target.value || "0", 10) || 0,
                  }))
                }
                className="h-11 rounded-xl border-slate-200 bg-white"
              />
              <p className="text-[11px] font-medium text-slate-500">
                Controls when payment reminders are sent before the due date.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <StickyFormActions
        isDirty={dirty}
        isSaving={isSaving}
        isSaveDisabled={!canSave}
        onUndo={onUndo}
        onSave={onSave}
        message="You have unsaved changes in Invoicing settings."
        saveLabel="Save changes"
      />
    </div>
  )
}
