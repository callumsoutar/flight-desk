"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import * as Tabs from "@radix-ui/react-tabs"
import {
  IconBuilding,
  IconClock,
  IconMail,
  IconReceiptTax,
  IconSettings,
} from "@tabler/icons-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dropzone } from "@/components/ui/dropzone"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { StickyFormActions } from "@/components/ui/sticky-form-actions"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { TaxSettingsTab } from "@/components/settings/tax-settings-tab"
import type { GeneralSettings } from "@/lib/settings/general-settings"

const generalTabs = [
  { id: "school", label: "School", icon: IconBuilding },
  { id: "contact", label: "Contact", icon: IconMail },
  { id: "tax", label: "Tax settings", icon: IconReceiptTax },
  { id: "system", label: "System", icon: IconSettings },
]

type GeneralSettingsResponse = { settings: GeneralSettings }

function normalizeOptionalInput(value: string) {
  const trimmed = value.trim()
  return trimmed.length ? trimmed : null
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message
  return "Something went wrong."
}

async function patchGeneralSettings(payload: unknown): Promise<GeneralSettingsResponse> {
  const response = await fetch("/api/settings/general", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const data = await response.json().catch(() => null)
    const message = data && typeof data === "object" && typeof data.error === "string"
      ? data.error
      : "Failed to update settings"
    throw new Error(message)
  }

  return (await response.json()) as GeneralSettingsResponse
}

function createFormState(settings: GeneralSettings | null) {
  return {
    name: settings?.tenant.name ?? "",
    registration_number: settings?.tenant.registration_number ?? "",
    description: settings?.tenant.description ?? "",
    website_url: settings?.tenant.website_url ?? "",
    logo_url: settings?.tenant.logo_url ?? "",
    contact_email: settings?.tenant.contact_email ?? "",
    contact_phone: settings?.tenant.contact_phone ?? "",
    address: settings?.tenant.address ?? "",
    billing_address: settings?.tenant.billing_address ?? "",
    gst_number: settings?.tenant.gst_number ?? "",
    timezone: settings?.tenant.timezone ?? "Pacific/Auckland",
    currency: settings?.tenant.currency ?? "NZD",
    businessOpenTime: settings?.businessHours.openTime ?? "07:00",
    businessCloseTime: settings?.businessHours.closeTime ?? "19:00",
    businessIs24Hours: settings?.businessHours.is24Hours ?? false,
    businessIsClosed: settings?.businessHours.isClosed ?? false,
  }
}

export function GeneralTab({
  initialSettings,
  loadError,
}: {
  initialSettings: GeneralSettings | null
  loadError: string | null
}) {
  const router = useRouter()
  const [activeTab, setActiveTab] = React.useState("school")
  const [form, setForm] = React.useState(() => createFormState(initialSettings))
  const [baseSettings, setBaseSettings] = React.useState<GeneralSettings | null>(initialSettings)

  const tabRefs = React.useRef<Record<string, HTMLButtonElement | null>>({})
  const tabsListRef = React.useRef<HTMLDivElement>(null)
  const [underlineStyle, setUnderlineStyle] = React.useState({ left: 0, width: 0 })

  const [showScrollLeft, setShowScrollLeft] = React.useState(false)
  const [showScrollRight, setShowScrollRight] = React.useState(false)

  const [isSaving, setIsSaving] = React.useState(false)
  const [isUploadingLogo, setIsUploadingLogo] = React.useState(false)

  React.useEffect(() => {
    setBaseSettings(initialSettings)
    setForm(createFormState(initialSettings))
  }, [initialSettings])

  React.useEffect(() => {
    const activeElement = tabRefs.current[activeTab]
    if (activeElement && tabsListRef.current) {
      const listRect = tabsListRef.current.getBoundingClientRect()
      const activeRect = activeElement.getBoundingClientRect()
      setUnderlineStyle({
        left: activeRect.left - listRect.left,
        width: activeRect.width,
      })
    }
  }, [activeTab])

  React.useEffect(() => {
    const checkScroll = () => {
      if (!tabsListRef.current) return
      const { scrollLeft, scrollWidth, clientWidth } = tabsListRef.current
      setShowScrollLeft(scrollLeft > 0)
      setShowScrollRight(scrollLeft + clientWidth < scrollWidth)
    }

    checkScroll()
    const listElement = tabsListRef.current
    listElement?.addEventListener("scroll", checkScroll)
    window.addEventListener("resize", checkScroll)
    return () => {
      listElement?.removeEventListener("scroll", checkScroll)
      window.removeEventListener("resize", checkScroll)
    }
  }, [])

  const baseForm = React.useMemo(() => createFormState(baseSettings), [baseSettings])

  const schoolDirty =
    form.name.trim() !== baseForm.name.trim() ||
    form.registration_number !== baseForm.registration_number ||
    form.description !== baseForm.description ||
    form.website_url !== baseForm.website_url

  const contactDirty =
    form.contact_email !== baseForm.contact_email ||
    form.contact_phone !== baseForm.contact_phone ||
    form.address !== baseForm.address ||
    form.billing_address !== baseForm.billing_address ||
    form.gst_number !== baseForm.gst_number

  const systemDirty =
    form.timezone !== baseForm.timezone ||
    form.currency !== baseForm.currency ||
    form.businessOpenTime !== baseForm.businessOpenTime ||
    form.businessCloseTime !== baseForm.businessCloseTime ||
    form.businessIs24Hours !== baseForm.businessIs24Hours ||
    form.businessIsClosed !== baseForm.businessIsClosed

  const anyDirty = schoolDirty || contactDirty || systemDirty

  if (loadError) {
    return (
      <Card className="border border-border/50 bg-card shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg text-slate-900">General</CardTitle>
          <CardDescription>{loadError}</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (!initialSettings) {
    return (
      <Card className="border border-border/50 bg-card shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg text-slate-900">General</CardTitle>
          <CardDescription>Settings are not available yet for this tenant.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const onSave = async () => {
    setIsSaving(true)
    try {
      const result = await patchGeneralSettings({
        tenant: {
          name: form.name.trim(),
          registration_number: normalizeOptionalInput(form.registration_number),
          description: normalizeOptionalInput(form.description),
          website_url: normalizeOptionalInput(form.website_url),
          contact_email: normalizeOptionalInput(form.contact_email),
          contact_phone: normalizeOptionalInput(form.contact_phone),
          address: normalizeOptionalInput(form.address),
          billing_address: normalizeOptionalInput(form.billing_address),
          gst_number: normalizeOptionalInput(form.gst_number),
          timezone: normalizeOptionalInput(form.timezone),
          currency: normalizeOptionalInput(form.currency),
        },
        businessHours: {
          openTime: form.businessOpenTime,
          closeTime: form.businessCloseTime,
          is24Hours: form.businessIs24Hours,
          isClosed: form.businessIsClosed,
        },
      })
      setBaseSettings(result.settings)
      toast.success("General settings saved")
      router.refresh()
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setIsSaving(false)
    }
  }

  const handleLogoUpload = async (file: File | null) => {
    setIsUploadingLogo(true)
    try {
      if (!file) {
        const response = await fetch("/api/settings/logo", { method: "DELETE" })
        if (!response.ok) {
          const data = await response.json().catch(() => null)
          const message =
            data && typeof data === "object" && typeof data.error === "string"
              ? data.error
              : "Failed to remove logo"
          throw new Error(message)
        }

        setForm((prev) => ({ ...prev, logo_url: "" }))
        setBaseSettings((prev) =>
          prev
            ? {
                ...prev,
                tenant: {
                  ...prev.tenant,
                  logo_url: null,
                },
              }
            : prev
        )
        toast.success("Logo removed")
        router.refresh()
        return
      }

      const uploadFormData = new FormData()
      uploadFormData.append("file", file)
      const response = await fetch("/api/settings/logo", {
        method: "POST",
        body: uploadFormData,
      })

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        const message =
          data && typeof data === "object" && typeof data.error === "string"
            ? data.error
            : "Failed to upload logo"
        throw new Error(message)
      }

      const data = (await response.json().catch(() => null)) as { url?: unknown } | null
      const url = data && typeof data.url === "string" ? data.url : null
      if (!url) throw new Error("Upload completed, but logo URL was not returned.")

      setForm((prev) => ({ ...prev, logo_url: url }))
      setBaseSettings((prev) =>
        prev
          ? {
              ...prev,
              tenant: {
                ...prev.tenant,
                logo_url: url,
              },
            }
          : prev
      )
      toast.success("Logo updated")
      router.refresh()
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setIsUploadingLogo(false)
    }
  }

  const onUndo = () => {
    setForm(baseForm)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold tracking-tight text-slate-900">General</h2>
            {anyDirty ? (
              <Badge className="border-amber-200 bg-amber-50 text-amber-700" variant="outline">
                Unsaved changes
              </Badge>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground">
            Update your school profile, contact information, and system defaults.
          </p>
        </div>
      </div>

      <Tabs.Root value={activeTab} onValueChange={setActiveTab} className="flex w-full flex-col">
        <div className="relative -mx-4 border-b border-slate-200 px-4 pb-1 pt-2 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <div className="relative flex items-center">
            {showScrollLeft ? (
              <div className="pointer-events-none absolute top-0 bottom-0 left-0 z-10 w-8 bg-gradient-to-r from-muted/30 to-transparent" />
            ) : null}
            {showScrollRight ? (
              <div className="pointer-events-none absolute top-0 right-0 bottom-0 z-10 w-8 bg-gradient-to-l from-muted/30 to-transparent" />
            ) : null}

            <div className="w-full overflow-x-auto scrollbar-hide scroll-smooth">
              <Tabs.List
                ref={tabsListRef}
                className="relative flex min-h-[44px] min-w-max flex-row gap-1"
                aria-label="General settings categories"
              >
                <div
                  className="absolute bottom-0 h-0.5 bg-indigo-700 transition-all duration-300 ease-out"
                  style={{
                    left: `${underlineStyle.left}px`,
                    width: `${underlineStyle.width}px`,
                  }}
                />
                {generalTabs.map((tab) => {
                  const Icon = tab.icon
                  return (
                    <Tabs.Trigger
                      key={tab.id}
                      ref={(el) => {
                        tabRefs.current[tab.id] = el
                      }}
                      value={tab.id}
                      className="inline-flex min-h-[44px] min-w-[44px] flex-shrink-0 cursor-pointer touch-manipulation items-center gap-2 border-b-2 border-transparent px-3 py-2.5 pb-1 text-sm font-semibold whitespace-nowrap text-slate-600 transition-all duration-200 hover:text-indigo-600 data-[state=active]:text-indigo-800"
                      style={{ background: "none", boxShadow: "none", borderRadius: 0 }}
                    >
                      <Icon className="h-4 w-4 flex-shrink-0" />
                      <span>{tab.label}</span>
                    </Tabs.Trigger>
                  )
                })}
              </Tabs.List>
            </div>
          </div>
        </div>

        <div className="w-full pt-6">
          <Tabs.Content value="school" className="outline-none">
                <div className="space-y-6">
	                  <Card className="border border-border/50 bg-card shadow-sm overflow-hidden rounded-2xl">
	                    <CardHeader className="border-b border-border/40">
	                      <CardTitle className="text-lg text-slate-900">School details</CardTitle>
	                      <CardDescription>These details appear across invoices and member communications.</CardDescription>
	                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="tenant-name" className="text-xs font-bold uppercase tracking-wider text-slate-500">
                            School name <span className="text-red-500">*</span>
                          </Label>
                          <Input
                            id="tenant-name"
                            value={form.name}
                            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                            className="h-11 rounded-xl border-slate-200 bg-white"
                            placeholder="Flight School Name"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="tenant-reg" className="text-xs font-bold uppercase tracking-wider text-slate-500">
                            Registration number
                          </Label>
                          <Input
                            id="tenant-reg"
                            value={form.registration_number}
                            onChange={(e) => setForm((prev) => ({ ...prev, registration_number: e.target.value }))}
                            className="h-11 rounded-xl border-slate-200 bg-white"
                            placeholder="ABC123"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="tenant-description" className="text-xs font-bold uppercase tracking-wider text-slate-500">
                          Description
                        </Label>
                        <Textarea
                          id="tenant-description"
                          value={form.description}
                          onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                          className="min-h-[96px] resize-none rounded-xl border-slate-200 bg-white"
                          placeholder="A short overview of your organization..."
                        />
                      </div>

                      <div className="grid gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="tenant-website" className="text-xs font-bold uppercase tracking-wider text-slate-500">
                            Website
                          </Label>
                          <Input
                            id="tenant-website"
                            value={form.website_url}
                            onChange={(e) => setForm((prev) => ({ ...prev, website_url: e.target.value }))}
                            className="h-11 rounded-xl border-slate-200 bg-white"
                            placeholder="https://example.com"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                          Company logo
                        </Label>
                        <Dropzone
                          onFileSelect={handleLogoUpload}
                          onError={(message) => toast.error(message)}
                          accept="image/*"
                          maxSize={5 * 1024 * 1024}
                          currentFile={form.logo_url.trim() ? form.logo_url : null}
                          disabled={isUploadingLogo || isSaving}
                          label="Drop logo here or click to upload"
                        />
                        <p className="text-[11px] font-medium text-slate-500">
                          Upload a square PNG/JPG/WEBP (max 5MB). You can change or remove it anytime.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
          </Tabs.Content>

          <Tabs.Content value="contact" className="outline-none">
                <div className="space-y-6">
                  <Card className="border border-border/50 bg-card shadow-sm overflow-hidden rounded-2xl">
                    <CardHeader className="border-b border-border/40">
                      <CardTitle className="text-lg text-slate-900">Contact information</CardTitle>
                      <CardDescription>Used for receipts, invoices, and automated messages.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="tenant-email" className="text-xs font-bold uppercase tracking-wider text-slate-500">
                            Contact email
                          </Label>
                          <Input
                            id="tenant-email"
                            type="email"
                            value={form.contact_email}
                            onChange={(e) => setForm((prev) => ({ ...prev, contact_email: e.target.value }))}
                            className="h-11 rounded-xl border-slate-200 bg-white"
                            placeholder="ops@example.com"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="tenant-phone" className="text-xs font-bold uppercase tracking-wider text-slate-500">
                            Phone
                          </Label>
                          <Input
                            id="tenant-phone"
                            value={form.contact_phone}
                            onChange={(e) => setForm((prev) => ({ ...prev, contact_phone: e.target.value }))}
                            className="h-11 rounded-xl border-slate-200 bg-white"
                            placeholder="+1 (555) 000-0000"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="tenant-address" className="text-xs font-bold uppercase tracking-wider text-slate-500">
                          Address
                        </Label>
                        <Textarea
                          id="tenant-address"
                          value={form.address}
                          onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
                          className="min-h-[80px] resize-none rounded-xl border-slate-200 bg-white"
                          placeholder="Airport Road, City, Country"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="tenant-billing-address" className="text-xs font-bold uppercase tracking-wider text-slate-500">
                          Billing address
                        </Label>
                        <Textarea
                          id="tenant-billing-address"
                          value={form.billing_address}
                          onChange={(e) => setForm((prev) => ({ ...prev, billing_address: e.target.value }))}
                          className="min-h-[80px] resize-none rounded-xl border-slate-200 bg-white"
                          placeholder="Address used on invoices"
                        />
                      </div>

                      <Separator />

                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="tenant-gst" className="text-xs font-bold uppercase tracking-wider text-slate-500">
                            GST / Tax number
                          </Label>
                          <Input
                            id="tenant-gst"
                            value={form.gst_number}
                            onChange={(e) => setForm((prev) => ({ ...prev, gst_number: e.target.value }))}
                            className="h-11 rounded-xl border-slate-200 bg-white"
                            placeholder="12-345-678"
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
          </Tabs.Content>

          <Tabs.Content value="tax" className="outline-none">
            <TaxSettingsTab />
          </Tabs.Content>

          <Tabs.Content value="system" className="outline-none">
                <div className="space-y-6">
                  <Card className="border border-border/50 bg-card shadow-sm overflow-hidden rounded-2xl">
                    <CardHeader className="border-b border-border/40">
                      <CardTitle className="text-lg text-slate-900">Regional defaults</CardTitle>
                      <CardDescription>Controls how times and money are displayed across the app.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="tenant-timezone" className="text-xs font-bold uppercase tracking-wider text-slate-500">
                            Time zone
                          </Label>
                          <Select value={form.timezone} onValueChange={(value) => setForm((prev) => ({ ...prev, timezone: value }))}>
                            <SelectTrigger id="tenant-timezone" className="h-11 rounded-xl border-slate-200 bg-white">
                              <SelectValue placeholder="Select time zone" />
                            </SelectTrigger>
                            <SelectContent className="max-h-72 rounded-xl">
                              <SelectItem value="Pacific/Auckland">Pacific/Auckland (NZST/NZDT)</SelectItem>
                              <SelectItem value="Pacific/Chatham">Pacific/Chatham (CHAST/CHADT)</SelectItem>
                              <SelectItem value="Pacific/Fiji">Pacific/Fiji (FJT)</SelectItem>
                              <SelectItem value="Australia/Sydney">Australia/Sydney (AEST/AEDT)</SelectItem>
                              <SelectItem value="Australia/Melbourne">Australia/Melbourne (AEST/AEDT)</SelectItem>
                              <SelectItem value="Australia/Brisbane">Australia/Brisbane (AEST)</SelectItem>
                              <SelectItem value="Australia/Adelaide">Australia/Adelaide (ACST/ACDT)</SelectItem>
                              <SelectItem value="Australia/Perth">Australia/Perth (AWST)</SelectItem>
                              <SelectItem value="Australia/Darwin">Australia/Darwin (ACST)</SelectItem>
                              <SelectItem value="Asia/Tokyo">Asia/Tokyo (JST)</SelectItem>
                              <SelectItem value="Asia/Seoul">Asia/Seoul (KST)</SelectItem>
                              <SelectItem value="Asia/Shanghai">Asia/Shanghai (CST)</SelectItem>
                              <SelectItem value="Asia/Hong_Kong">Asia/Hong Kong (HKT)</SelectItem>
                              <SelectItem value="Asia/Singapore">Asia/Singapore (SGT)</SelectItem>
                              <SelectItem value="Asia/Kolkata">Asia/Kolkata (IST)</SelectItem>
                              <SelectItem value="Asia/Dubai">Asia/Dubai (GST)</SelectItem>
                              <SelectItem value="Europe/London">Europe/London (GMT/BST)</SelectItem>
                              <SelectItem value="Europe/Dublin">Europe/Dublin (GMT/IST)</SelectItem>
                              <SelectItem value="Europe/Paris">Europe/Paris (CET/CEST)</SelectItem>
                              <SelectItem value="Europe/Berlin">Europe/Berlin (CET/CEST)</SelectItem>
                              <SelectItem value="Europe/Amsterdam">Europe/Amsterdam (CET/CEST)</SelectItem>
                              <SelectItem value="Europe/Zurich">Europe/Zurich (CET/CEST)</SelectItem>
                              <SelectItem value="Europe/Rome">Europe/Rome (CET/CEST)</SelectItem>
                              <SelectItem value="Europe/Madrid">Europe/Madrid (CET/CEST)</SelectItem>
                              <SelectItem value="Europe/Stockholm">Europe/Stockholm (CET/CEST)</SelectItem>
                              <SelectItem value="Europe/Helsinki">Europe/Helsinki (EET/EEST)</SelectItem>
                              <SelectItem value="Europe/Athens">Europe/Athens (EET/EEST)</SelectItem>
                              <SelectItem value="Africa/Johannesburg">Africa/Johannesburg (SAST)</SelectItem>
                              <SelectItem value="Africa/Nairobi">Africa/Nairobi (EAT)</SelectItem>
                              <SelectItem value="America/New_York">America/New York (EST/EDT)</SelectItem>
                              <SelectItem value="America/Chicago">America/Chicago (CST/CDT)</SelectItem>
                              <SelectItem value="America/Denver">America/Denver (MST/MDT)</SelectItem>
                              <SelectItem value="America/Los_Angeles">America/Los Angeles (PST/PDT)</SelectItem>
                              <SelectItem value="America/Anchorage">America/Anchorage (AKST/AKDT)</SelectItem>
                              <SelectItem value="Pacific/Honolulu">Pacific/Honolulu (HST)</SelectItem>
                              <SelectItem value="America/Toronto">America/Toronto (EST/EDT)</SelectItem>
                              <SelectItem value="America/Vancouver">America/Vancouver (PST/PDT)</SelectItem>
                              <SelectItem value="America/Edmonton">America/Edmonton (MST/MDT)</SelectItem>
                              <SelectItem value="America/Sao_Paulo">America/São Paulo (BRT)</SelectItem>
                              <SelectItem value="America/Argentina/Buenos_Aires">America/Buenos Aires (ART)</SelectItem>
                              <SelectItem value="America/Mexico_City">America/Mexico City (CST/CDT)</SelectItem>
                              <SelectItem value="UTC">UTC</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="tenant-currency" className="text-xs font-bold uppercase tracking-wider text-slate-500">
                            Currency
                          </Label>
                          <Select value={form.currency} onValueChange={(value) => setForm((prev) => ({ ...prev, currency: value }))}>
                            <SelectTrigger id="tenant-currency" className="h-11 rounded-xl border-slate-200 bg-white">
                              <SelectValue placeholder="Select currency" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl">
                              <SelectItem value="NZD">NZD</SelectItem>
                              <SelectItem value="AUD">AUD</SelectItem>
                              <SelectItem value="USD">USD</SelectItem>
                              <SelectItem value="EUR">EUR</SelectItem>
                              <SelectItem value="GBP">GBP</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <Separator />

                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                        <IconClock className="h-4 w-4 text-slate-500" />
                        Business hours
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="business-open" className="text-xs font-bold uppercase tracking-wider text-slate-500">
                            Opens
                          </Label>
                          <Input
                            id="business-open"
                            type="time"
                            step={60}
                            value={form.businessOpenTime}
                            onChange={(e) => setForm((prev) => ({ ...prev, businessOpenTime: e.target.value }))}
                            className="h-11 rounded-xl border-slate-200 bg-white"
                            disabled={form.businessIs24Hours || form.businessIsClosed}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="business-close" className="text-xs font-bold uppercase tracking-wider text-slate-500">
                            Closes
                          </Label>
                          <Input
                            id="business-close"
                            type="time"
                            step={60}
                            value={form.businessCloseTime}
                            onChange={(e) => setForm((prev) => ({ ...prev, businessCloseTime: e.target.value }))}
                            className="h-11 rounded-xl border-slate-200 bg-white"
                            disabled={form.businessIs24Hours || form.businessIsClosed}
                          />
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">Open 24 hours</p>
                            <p className="text-sm text-muted-foreground">Ignore open/close times and allow all-day scheduling.</p>
                          </div>
                          <Switch
                            checked={form.businessIs24Hours}
                            onCheckedChange={(checked) =>
                              setForm((prev) => ({ ...prev, businessIs24Hours: checked }))
                            }
                          />
                        </div>

                        <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">Business is closed</p>
                            <p className="text-sm text-muted-foreground">Temporarily treat the operation as closed.</p>
                          </div>
                          <Switch
                            checked={form.businessIsClosed}
                            onCheckedChange={(checked) =>
                              setForm((prev) => ({ ...prev, businessIsClosed: checked }))
                            }
                          />
                        </div>
                      </div>

                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-sm font-semibold text-slate-900">Where this is used</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Scheduler and booking flows will use these values to guide availability and defaults.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
          </Tabs.Content>
        </div>
      </Tabs.Root>

      <StickyFormActions
        isDirty={anyDirty}
        isSaving={isSaving}
        isSaveDisabled={!form.name.trim().length || isUploadingLogo}
        onUndo={onUndo}
        onSave={onSave}
        message="You have unsaved changes in General settings."
        saveLabel="Save changes"
      />
    </div>
  )
}
