"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  IconAutomation,
  IconFileInvoice,
  IconInfoCircle,
  IconMessage,
} from "@tabler/icons-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { XeroAccountSelect } from "@/components/settings/xero-account-select"
import { StickyFormActions } from "@/components/ui/sticky-form-actions"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
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
    invoice_number_mode: settings?.invoice_number_mode ?? "internal",
    default_invoice_due_days: settings?.default_invoice_due_days ?? 7,
    invoice_footer_message: settings?.invoice_footer_message ?? "Thank you for your business.",
    include_logo_on_invoice: settings?.include_logo_on_invoice ?? true,
    landing_fee_gl_code: settings?.landing_fee_gl_code ?? "",
    airways_fee_gl_code: settings?.airways_fee_gl_code ?? "",
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
    form.invoice_number_mode !== baseForm.invoice_number_mode ||
    form.default_invoice_due_days !== baseForm.default_invoice_due_days ||
    form.invoice_footer_message !== baseForm.invoice_footer_message ||
    form.include_logo_on_invoice !== baseForm.include_logo_on_invoice ||
    form.landing_fee_gl_code !== baseForm.landing_fee_gl_code ||
    form.airways_fee_gl_code !== baseForm.airways_fee_gl_code

  const canSave = dirty && form.invoice_prefix.trim().length > 0 && !isSaving
  const onUndo = () => {
    setForm(baseForm)
  }

  if (loadError) {
    return (
      <div className="space-y-1 py-2">
        <h3 className="text-lg font-semibold text-slate-900">Invoicing</h3>
        <p className="text-sm text-muted-foreground">{loadError}</p>
      </div>
    )
  }

  if (!initialSettings) {
    return (
      <div className="space-y-1 py-2">
        <h3 className="text-lg font-semibold text-slate-900">Invoicing</h3>
        <p className="text-sm text-muted-foreground">Settings are not available yet for this tenant.</p>
      </div>
    )
  }

  const onSave = async () => {
    setIsSaving(true)
    try {
      const result = await patchInvoicingSettings({
        invoicing: {
          invoice_prefix: form.invoice_prefix.trim(),
          invoice_number_mode: form.invoice_number_mode,
          default_invoice_due_days: form.default_invoice_due_days,
          invoice_footer_message: form.invoice_footer_message,
          include_logo_on_invoice: form.include_logo_on_invoice,
          landing_fee_gl_code: form.landing_fee_gl_code || null,
          airways_fee_gl_code: form.airways_fee_gl_code || null,
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
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground">
            Configure invoice numbering and defaults.
          </p>
        </div>
      </div>

      <div className="space-y-8">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold text-slate-900">Invoice defaults</h3>
          <p className="text-sm text-muted-foreground">
            These values apply to new invoices and automated notifications.
          </p>
        </div>

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
              <TooltipProvider delayDuration={0}>
                <div className="flex items-center gap-1.5">
                  <Label htmlFor="invoice-number-mode" className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Invoice numbering
                  </Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button type="button" className="outline-hidden rounded-sm">
                        <IconInfoCircle className="h-3.5 w-3.5 text-slate-300 transition-colors hover:text-slate-400" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-[260px] text-[11px] font-medium leading-tight bg-slate-900 text-white border-slate-800 shadow-xl rounded-lg px-3 py-2">
                      When enabled, Xero allocates invoice numbers. When disabled, FlightDesk uses its own invoice
                      sequence and sends that invoice number to Xero.
                    </TooltipContent>
                  </Tooltip>
                </div>
              </TooltipProvider>

              <div className="flex h-11 items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-3">
                <p className="text-sm font-semibold text-slate-900 leading-none">Use Xero invoice number sequencing</p>
                <Switch
                  id="invoice-number-mode"
                  checked={form.invoice_number_mode === "xero"}
                  onCheckedChange={(checked) =>
                    setForm((prev) => ({
                      ...prev,
                      invoice_number_mode: checked ? "xero" : "internal",
                    }))
                  }
                />
              </div>
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
            <IconFileInvoice className="h-4 w-4 text-slate-500" />
            Fee GL defaults
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label
                htmlFor="landing-fee-gl-code"
                className="text-xs font-bold uppercase tracking-wider text-slate-500"
              >
                Landing Fee Account Code
              </Label>
              <XeroAccountSelect
                value={form.landing_fee_gl_code}
                onChange={(code) => setForm((prev) => ({ ...prev, landing_fee_gl_code: code }))}
                accountTypes={["REVENUE"]}
                className="h-11"
              />
              <p className="text-[11px] font-medium text-slate-500">
                Applied to invoice line items where chargeable type is landing fees.
              </p>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="airways-fee-gl-code"
                className="text-xs font-bold uppercase tracking-wider text-slate-500"
              >
                Airways Fee Account Code
              </Label>
              <XeroAccountSelect
                value={form.airways_fee_gl_code}
                onChange={(code) => setForm((prev) => ({ ...prev, airways_fee_gl_code: code }))}
                accountTypes={["REVENUE"]}
                className="h-11"
              />
              <p className="text-[11px] font-medium text-slate-500">
                Applied to invoice line items where chargeable type is airways fees.
              </p>
            </div>
          </div>
        </div>

        <Separator />

        <div className="space-y-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <IconAutomation className="h-4 w-4 text-slate-500" />
            Invoice display
          </div>

          <div className="space-y-3">
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
        </div>
      </div>

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
