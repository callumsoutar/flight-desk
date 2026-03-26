"use client"

import * as React from "react"
import { IconCalendar, IconDeviceFloppy, IconInfoCircle, IconLoader2 } from "@tabler/icons-react"
import { toast } from "sonner"

import { updateMembershipsSettings } from "@/hooks/use-memberships-settings-query"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { MembershipsSettings } from "@/lib/settings/memberships-settings"

const months = [
  { value: "1", label: "January" },
  { value: "2", label: "February" },
  { value: "3", label: "March" },
  { value: "4", label: "April" },
  { value: "5", label: "May" },
  { value: "6", label: "June" },
  { value: "7", label: "July" },
  { value: "8", label: "August" },
  { value: "9", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
]

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message
  return "Something went wrong."
}

function getOrdinalSuffix(value: number) {
  if (!Number.isFinite(value)) return ""
  const n = Math.abs(Math.trunc(value))
  const mod100 = n % 100
  if (mod100 >= 11 && mod100 <= 13) return "th"
  switch (n % 10) {
    case 1:
      return "st"
    case 2:
      return "nd"
    case 3:
      return "rd"
    default:
      return "th"
  }
}

function daysInMonth(month: number, year = 2001) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

function clampStartDay(startMonth: number, startDay: number) {
  const maxDay = daysInMonth(startMonth)
  return Math.min(Math.max(1, startDay), maxDay)
}

function computeMembershipYearEnd(startMonth: number, startDay: number) {
  const clampedDay = clampStartDay(startMonth, startDay)
  const start = new Date(Date.UTC(2001, startMonth - 1, clampedDay))
  const end = new Date(start)
  end.setUTCDate(end.getUTCDate() - 1)
  return { end_month: end.getUTCMonth() + 1, end_day: end.getUTCDate() }
}

function formatRangeDescription(startMonth: number, startDay: number) {
  const startMonthName = months.find((m) => m.value === String(startMonth))?.label ?? "Unknown"
  const { end_month, end_day } = computeMembershipYearEnd(startMonth, startDay)
  const endMonthName = months.find((m) => m.value === String(end_month))?.label ?? "Unknown"

  return `Membership year runs from ${startMonthName} ${startDay}${getOrdinalSuffix(startDay)} to ${endMonthName} ${end_day}${getOrdinalSuffix(end_day)}.`
}

function createFormState(settings: MembershipsSettings | null) {
  const startMonth = settings?.membership_year.start_month ?? 4
  const startDay = clampStartDay(startMonth, settings?.membership_year.start_day ?? 1)
  const { end_month, end_day } = computeMembershipYearEnd(startMonth, startDay)
  const description =
    typeof settings?.membership_year.description === "string" && settings.membership_year.description.trim().length
      ? settings.membership_year.description.trim()
      : formatRangeDescription(startMonth, startDay)

  return {
    start_month: String(startMonth),
    start_day: String(startDay),
    end_month,
    end_day,
    description,
  }
}

export function MembershipYearConfig({
  initialSettings = null,
  initialLoadError = null,
}: {
  initialSettings?: MembershipsSettings | null
  initialLoadError?: string | null
}) {
  const [loadError, setLoadError] = React.useState<string | null>(initialLoadError)
  const [isSaving, setIsSaving] = React.useState(false)
  const [baseSettings, setBaseSettings] = React.useState<MembershipsSettings | null>(initialSettings)
  const [form, setForm] = React.useState(() => createFormState(initialSettings))

  React.useEffect(() => {
    setBaseSettings(initialSettings)
    setForm(createFormState(initialSettings))
    setLoadError(initialLoadError)
  }, [initialLoadError, initialSettings])

  const baseForm = React.useMemo(() => createFormState(baseSettings), [baseSettings])
  const dirty = form.start_month !== baseForm.start_month || form.start_day !== baseForm.start_day

  const handleStartMonthChange = (value: string) => {
    const monthNum = Number.parseInt(value, 10)
    if (!Number.isFinite(monthNum) || monthNum < 1 || monthNum > 12) return

    setForm((prev) => {
      const dayNum = clampStartDay(monthNum, Number.parseInt(prev.start_day, 10) || 1)
      const { end_month, end_day } = computeMembershipYearEnd(monthNum, dayNum)
      return {
        ...prev,
        start_month: value,
        start_day: String(dayNum),
        end_month,
        end_day,
        description: formatRangeDescription(monthNum, dayNum),
      }
    })
  }

  const handleStartDayChange = (value: string) => {
    setForm((prev) => {
      const startMonth = Number.parseInt(prev.start_month, 10) || 4
      const rawDay = Number.parseInt(value, 10)
      const dayNum = clampStartDay(startMonth, Number.isFinite(rawDay) ? rawDay : 1)
      const { end_month, end_day } = computeMembershipYearEnd(startMonth, dayNum)
      return {
        ...prev,
        start_day: value,
        end_month,
        end_day,
        description: formatRangeDescription(startMonth, dayNum),
      }
    })
  }

  const handleStartDayBlur = () => {
    setForm((prev) => {
      const startMonth = Number.parseInt(prev.start_month, 10) || 4
      const dayNum = clampStartDay(startMonth, Number.parseInt(prev.start_day, 10) || 1)
      const { end_month, end_day } = computeMembershipYearEnd(startMonth, dayNum)
      return {
        ...prev,
        start_day: String(dayNum),
        end_month,
        end_day,
        description: formatRangeDescription(startMonth, dayNum),
      }
    })
  }

  const onUndo = () => setForm(baseForm)

  const onSave = async () => {
    const startMonth = Number.parseInt(form.start_month, 10) || 4
    const startDay = clampStartDay(startMonth, Number.parseInt(form.start_day, 10) || 1)

    setIsSaving(true)
    try {
      const result = await updateMembershipsSettings({
        memberships: {
          membership_year: {
            start_month: startMonth,
            start_day: startDay,
            description: formatRangeDescription(startMonth, startDay),
          },
        },
      })
      setBaseSettings(result.settings)
      setForm(createFormState(result.settings))
      toast.success("Membership year settings saved")
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setIsSaving(false)
    }
  }

  if (loadError) {
    return (
      <div className="rounded-xl border border-dashed border-red-200 bg-red-50 p-6">
        <p className="text-sm font-semibold text-red-900">Unable to load membership settings</p>
        <p className="mt-1 text-sm text-red-700">{loadError}</p>
      </div>
    )
  }

  if (!baseSettings) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6">
        <p className="text-sm font-semibold text-slate-900">Membership settings unavailable</p>
        <p className="mt-1 text-sm text-slate-600">Membership settings are not available yet for this tenant.</p>
      </div>
    )
  }

  const startMonthName = months.find((m) => m.value === form.start_month)?.label ?? "Unknown"
  const endMonthName = months.find((m) => m.value === String(form.end_month))?.label ?? "Unknown"

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50/50 p-4">
        <IconInfoCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-500" />
        <div className="space-y-1">
          <p className="text-sm font-semibold text-blue-900">About membership year</p>
          <p className="text-xs leading-relaxed text-blue-700">
            This sets when annual memberships renew and when they expire. The end date is calculated automatically as the day
            before the next year&apos;s start date.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="membership-year-start-month" className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Start month
          </Label>
          <Select value={form.start_month} onValueChange={handleStartMonthChange}>
            <SelectTrigger
              id="membership-year-start-month"
              className="h-11 w-full rounded-xl border-slate-200 bg-white"
            >
              <SelectValue placeholder="Select month" />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-slate-200">
              {months.map((month) => (
                <SelectItem key={month.value} value={month.value}>
                  {month.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="membership-year-start-day" className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Start day
          </Label>
          <Input
            id="membership-year-start-day"
            type="number"
            min={1}
            max={31}
            value={form.start_day}
            onChange={(e) => handleStartDayChange(e.target.value)}
            onBlur={handleStartDayBlur}
            className="h-11 rounded-xl border-slate-200 bg-white"
          />
          <p className="text-[11px] font-medium text-slate-500">
            {`Membership year runs ${startMonthName} ${clampStartDay(Number.parseInt(form.start_month, 10) || 4, Number.parseInt(form.start_day, 10) || 1)}${getOrdinalSuffix(
              clampStartDay(Number.parseInt(form.start_month, 10) || 4, Number.parseInt(form.start_day, 10) || 1)
            )} → ${endMonthName} ${form.end_day}${getOrdinalSuffix(form.end_day)}.`}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <IconCalendar className="h-4 w-4 text-slate-500" />
          Summary
        </div>
        <Input
          value={form.description}
          readOnly
          className="h-11 rounded-xl border-slate-200 bg-slate-50 text-slate-700"
        />
        <p className="text-[11px] font-medium text-slate-500">Auto-generated from the start date.</p>
      </div>

      <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-6 sm:flex-row sm:items-center sm:justify-between">
        <Button
          type="button"
          variant="outline"
          onClick={onUndo}
          disabled={!dirty || isSaving}
          className="h-11 rounded-xl border-slate-200 text-sm font-semibold shadow-none hover:bg-slate-50"
        >
          Reset changes
        </Button>
        <Button
          type="button"
          onClick={onSave}
          disabled={!dirty || isSaving}
          className="h-11 rounded-xl bg-indigo-600 px-6 font-semibold text-white shadow-sm shadow-indigo-100 transition-all active:scale-[0.98] hover:bg-indigo-700 border-none"
        >
          {isSaving ? (
            <span className="inline-flex items-center gap-2">
              <IconLoader2 className="h-4 w-4 animate-spin" />
              Saving…
            </span>
          ) : (
            <span className="inline-flex items-center gap-2">
              <IconDeviceFloppy className="h-4 w-4" />
              Save membership year
            </span>
          )}
        </Button>
      </div>
    </div>
  )
}
