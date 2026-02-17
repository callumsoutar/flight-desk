"use client"

import * as React from "react"
import {
  AlertTriangle,
  Award,
  CalendarIcon,
  CheckCircle,
  Heart,
  Plane,
  Plus,
  X,
  XCircle,
} from "lucide-react"
import { toast } from "sonner"

import {
  addMemberEndorsementAction,
  removeMemberEndorsementAction,
  updateMemberPilotAction,
  type UpdateMemberPilotInput,
} from "@/app/members/actions"
import { DatePicker } from "@/components/ui/date-picker"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type {
  EndorsementLite,
  LicenseLite,
  MemberDetailWithRelations,
  UserEndorsementWithRelation,
} from "@/lib/types/members"

type PilotDetailsFormValues = {
  pilot_license_number: string | null
  pilot_license_type: string | null
  pilot_license_id: string | null
  pilot_license_expiry: string | null
  medical_certificate_expiry: string | null
}

const UNSET_LICENSE_VALUE = "__unset__"

function toNullable(value: string | null | undefined) {
  if (value == null) return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function normalizeDate(value: string | null | undefined): string | null {
  const normalized = toNullable(value)
  if (!normalized) return null

  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return normalized

  const prefixMatch = normalized.match(/^(\d{4}-\d{2}-\d{2})/)
  if (prefixMatch) return prefixMatch[1]

  const parsed = new Date(normalized)
  if (Number.isNaN(parsed.getTime())) return null
  const yyyy = parsed.getUTCFullYear()
  const mm = String(parsed.getUTCMonth() + 1).padStart(2, "0")
  const dd = String(parsed.getUTCDate()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
}

function normalizeLicense(
  values: Pick<PilotDetailsFormValues, "pilot_license_id" | "pilot_license_type">,
  availableLicenses: LicenseLite[]
) {
  let pilot_license_id = toNullable(values.pilot_license_id)
  let pilot_license_type = toNullable(values.pilot_license_type)

  if (!pilot_license_id && pilot_license_type) {
    const byName = availableLicenses.find(
      (license) => license.name.toLowerCase() === pilot_license_type?.toLowerCase()
    )
    if (byName) {
      pilot_license_id = byName.id
      pilot_license_type = byName.name
    }
  }

  if (pilot_license_id) {
    const byId = availableLicenses.find((license) => license.id === pilot_license_id)
    if (byId) {
      pilot_license_type = byId.name
    }
  }

  return { pilot_license_id, pilot_license_type }
}

type Props = {
  memberId: string
  member: MemberDetailWithRelations | null
  availableLicenses: LicenseLite[]
  availableEndorsements: EndorsementLite[]
  initialUserEndorsements: UserEndorsementWithRelation[]
  onDirtyChange?: (isDirty: boolean) => void
  onSavingChange?: (isSaving: boolean) => void
  onUndoRef?: React.MutableRefObject<(() => void) | null>
  onPilotSaved?: (values: PilotDetailsFormValues) => void
  formId?: string
}

function toFormValues(
  member: MemberDetailWithRelations,
  availableLicenses: LicenseLite[]
): PilotDetailsFormValues {
  const license = normalizeLicense(
    {
      pilot_license_id: member.user?.pilot_license_id ?? null,
      pilot_license_type: member.user?.pilot_license_type ?? null,
    },
    availableLicenses
  )

  return {
    pilot_license_number: toNullable(member.user?.pilot_license_number),
    pilot_license_type: license.pilot_license_type,
    pilot_license_id: license.pilot_license_id,
    pilot_license_expiry: normalizeDate(member.user?.pilot_license_expiry),
    medical_certificate_expiry: normalizeDate(member.user?.medical_certificate_expiry),
  }
}

function normalize(
  values: PilotDetailsFormValues,
  availableLicenses: LicenseLite[]
): PilotDetailsFormValues {
  const license = normalizeLicense(values, availableLicenses)
  return {
    pilot_license_number: toNullable(values.pilot_license_number),
    pilot_license_type: license.pilot_license_type,
    pilot_license_id: license.pilot_license_id,
    pilot_license_expiry: normalizeDate(values.pilot_license_expiry),
    medical_certificate_expiry: normalizeDate(values.medical_certificate_expiry),
  }
}

function areEqual(
  a: PilotDetailsFormValues,
  b: PilotDetailsFormValues,
  availableLicenses: LicenseLite[]
) {
  return (
    JSON.stringify(normalize(a, availableLicenses)) ===
    JSON.stringify(normalize(b, availableLicenses))
  )
}

function formatDate(value: string | null | undefined) {
  if (!value) return ""
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ""
  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  })
}

function getExpiryStatus(expiryDate: string | null | undefined) {
  if (!expiryDate) {
    return {
      status: "unknown",
      color: "bg-gray-100 text-gray-800",
      icon: CalendarIcon,
    } as const
  }

  const expiry = new Date(expiryDate)
  const today = new Date()
  const warningDate = new Date(today)
  warningDate.setDate(today.getDate() + 30)

  if (expiry < today) {
    return { status: "expired", color: "bg-red-100 text-red-800", icon: XCircle } as const
  }
  if (expiry < warningDate) {
    return {
      status: "expiring",
      color: "bg-yellow-100 text-yellow-800",
      icon: AlertTriangle,
    } as const
  }
  return { status: "valid", color: "bg-green-100 text-green-800", icon: CheckCircle } as const
}

export function MemberPilotDetails({
  memberId,
  member,
  availableLicenses,
  availableEndorsements,
  initialUserEndorsements,
  onDirtyChange,
  onSavingChange,
  onUndoRef,
  onPilotSaved,
  formId,
}: Props) {
  const [isSaving, setIsSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [initial, setInitial] = React.useState<PilotDetailsFormValues | null>(null)
  const [form, setForm] = React.useState<PilotDetailsFormValues>({
    pilot_license_number: null,
    pilot_license_type: null,
    pilot_license_id: null,
    pilot_license_expiry: null,
    medical_certificate_expiry: null,
  })

  const [userEndorsements, setUserEndorsements] = React.useState<UserEndorsementWithRelation[]>(
    initialUserEndorsements
  )
  const [endorsementsLoading, setEndorsementsLoading] = React.useState(false)
  const [selectedEndorsement, setSelectedEndorsement] = React.useState("")
  const [endorsementNotes, setEndorsementNotes] = React.useState("")
  const [endorsementExpiryDate, setEndorsementExpiryDate] = React.useState<string | null>(null)
  const [showAddEndorsement, setShowAddEndorsement] = React.useState(false)

  React.useEffect(() => {
    if (!member) return
    const values = toFormValues(member, availableLicenses)
    setInitial(values)
    setForm(values)
  }, [member, availableLicenses])

  React.useEffect(() => {
    setUserEndorsements(initialUserEndorsements)
  }, [initialUserEndorsements])

  const isDirty = React.useMemo(() => {
    if (!initial) return false
    return !areEqual(initial, form, availableLicenses)
  }, [initial, form, availableLicenses])

  React.useEffect(() => {
    onDirtyChange?.(isDirty)
  }, [isDirty, onDirtyChange])

  React.useEffect(() => {
    onSavingChange?.(isSaving)
  }, [isSaving, onSavingChange])

  React.useEffect(() => {
    if (!onUndoRef) return
    onUndoRef.current = () => {
      if (initial) setForm(initial)
      setError(null)
    }
  }, [initial, onUndoRef])

  const setField = <K extends keyof PilotDetailsFormValues>(
    key: K,
    value: PilotDetailsFormValues[K]
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSaving(true)
    setError(null)

    const payload: UpdateMemberPilotInput = {
      memberId,
      pilot_license_number: form.pilot_license_number?.trim() || null,
      pilot_license_type: form.pilot_license_type?.trim() || null,
      pilot_license_id: form.pilot_license_id || null,
      pilot_license_expiry: form.pilot_license_expiry || null,
      medical_certificate_expiry: form.medical_certificate_expiry || null,
    }

    try {
      const result = await updateMemberPilotAction(payload)
      if (!result.ok) {
        setError(result.error)
        toast.error(result.error)
        return
      }

      const savedValues: PilotDetailsFormValues = {
        pilot_license_number: payload.pilot_license_number,
        pilot_license_type: payload.pilot_license_type,
        pilot_license_id: payload.pilot_license_id,
        pilot_license_expiry: payload.pilot_license_expiry,
        medical_certificate_expiry: payload.medical_certificate_expiry,
      }
      setInitial(savedValues)
      onPilotSaved?.(savedValues)
      toast.success("Pilot details saved!")
    } finally {
      setIsSaving(false)
    }
  }

  const resetAddEndorsementForm = () => {
    setSelectedEndorsement("")
    setEndorsementNotes("")
    setEndorsementExpiryDate(null)
    setShowAddEndorsement(false)
  }

  const addEndorsement = async () => {
    if (!selectedEndorsement) {
      toast.error("Please select an endorsement")
      return
    }

    setEndorsementsLoading(true)
    try {
      const result = await addMemberEndorsementAction({
        memberId,
        endorsementId: selectedEndorsement,
        issuedDate: new Date().toISOString(),
        expiryDate: endorsementExpiryDate ? new Date(endorsementExpiryDate).toISOString() : null,
        notes: endorsementNotes.trim() || null,
      })

      if (!result.ok) {
        toast.error(result.error)
        return
      }

      const endorsement =
        availableEndorsements.find((item) => item.id === selectedEndorsement) ?? null

      setUserEndorsements((prev) => [
        {
          id: crypto.randomUUID(),
          issued_date: new Date().toISOString(),
          expiry_date: endorsementExpiryDate
            ? new Date(endorsementExpiryDate).toISOString()
            : null,
          notes: endorsementNotes.trim() || null,
          voided_at: null,
          endorsement,
        },
        ...prev,
      ])

      toast.success("Endorsement added successfully")
      resetAddEndorsementForm()
    } finally {
      setEndorsementsLoading(false)
    }
  }

  const removeEndorsement = async (userEndorsementId: string, endorsementName: string) => {
    const confirmed = window.confirm(
      `Remove "${endorsementName}" endorsement? This can be restored later if needed.`
    )
    if (!confirmed) return

    const result = await removeMemberEndorsementAction({
      memberId,
      userEndorsementId,
    })
    if (!result.ok) {
      toast.error(result.error)
      return
    }

    setUserEndorsements((prev) => prev.filter((item) => item.id !== userEndorsementId))
    toast.success("Endorsement removed successfully")
  }

  if (!member) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-muted-foreground">Loading pilot details...</div>
      </div>
    )
  }

  const pilotLicenseStatus = getExpiryStatus(form.pilot_license_expiry)
  const medicalStatus = getExpiryStatus(form.medical_certificate_expiry)
  const PilotIcon = pilotLicenseStatus.icon
  const MedicalIcon = medicalStatus.icon
  const selectedLicenseExists = form.pilot_license_id
    ? availableLicenses.some((license) => license.id === form.pilot_license_id)
    : true

  return (
    <form id={formId} onSubmit={onSubmit} className="pb-12">
      <div className="mb-6 flex flex-row items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Pilot Details & Certifications</h3>
      </div>

      <div className="mb-8 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-col justify-between gap-3 border-b border-gray-100 bg-gray-50/50 px-5 py-4 sm:flex-row sm:items-center">
          <h4 className="flex items-center gap-2 text-base font-semibold tracking-tight text-gray-900">
            <div className="rounded-md bg-indigo-50 p-1.5">
              <Plane className="h-4 w-4 text-indigo-500" />
            </div>
            Pilot License Information
          </h4>
          {form.pilot_license_expiry ? (
            <Badge className={`${pilotLicenseStatus.color} flex items-center gap-1.5 border-none px-3 py-1 shadow-none`}>
              <PilotIcon className="h-3.5 w-3.5" />
              {pilotLicenseStatus.status === "expired"
                ? "Expired"
                : pilotLicenseStatus.status === "expiring"
                  ? "Expiring Soon"
                  : "Valid"}
            </Badge>
          ) : null}
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            <div className="space-y-5">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-600">License Type</label>
                <Select
                  value={form.pilot_license_id ?? UNSET_LICENSE_VALUE}
                  onValueChange={(value) => {
                    if (value === UNSET_LICENSE_VALUE) {
                      setField("pilot_license_id", null)
                      setField("pilot_license_type", null)
                      return
                    }
                    setField("pilot_license_id", value)
                    const selected = availableLicenses.find((license) => license.id === value)
                    if (selected) setField("pilot_license_type", selected.name)
                  }}
                >
                  <SelectTrigger className="h-11 w-full rounded-lg border-gray-200 bg-white focus:ring-indigo-500">
                    <SelectValue placeholder="Select license type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={UNSET_LICENSE_VALUE}>Not set</SelectItem>
                    {!selectedLicenseExists && form.pilot_license_id ? (
                      <SelectItem value={form.pilot_license_id}>
                        {form.pilot_license_type ?? "Current license"}
                      </SelectItem>
                    ) : null}
                    {availableLicenses.map((license) => (
                      <SelectItem key={license.id} value={license.id}>
                        {license.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-600">License Number</label>
                <Input
                  value={form.pilot_license_number ?? ""}
                  onChange={(e) => setField("pilot_license_number", e.target.value)}
                  className="h-11 rounded-lg border-gray-200 bg-white focus:border-indigo-500 focus:ring-indigo-500"
                  placeholder="e.g., PPL-123456"
                />
              </div>
            </div>

            <div className="space-y-5">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-600">License Expiry Date</label>
                <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
                  <div className="flex-1">
                    <DatePicker
                      date={normalizeDate(form.pilot_license_expiry)}
                      onChange={(date) => setField("pilot_license_expiry", normalizeDate(date))}
                      placeholder="Select expiry date"
                    />
                  </div>
                  {form.pilot_license_expiry ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setField("pilot_license_expiry", null)}
                      className="h-11 shrink-0 rounded-lg border-gray-200 px-4 text-gray-500 hover:bg-red-50 hover:text-red-600"
                    >
                      <X className="mr-2 h-4 w-4" />
                      Clear
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-8 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-col justify-between gap-3 border-b border-gray-100 bg-gray-50/50 px-5 py-4 sm:flex-row sm:items-center">
          <h4 className="flex items-center gap-2 text-base font-semibold tracking-tight text-gray-900">
            <div className="rounded-md bg-rose-50 p-1.5">
              <Heart className="h-4 w-4 text-rose-500" />
            </div>
            Medical Certificate Expiry
          </h4>
          {form.medical_certificate_expiry ? (
            <Badge className={`${medicalStatus.color} flex items-center gap-1.5 border-none px-3 py-1 shadow-none`}>
              <MedicalIcon className="h-3.5 w-3.5" />
              {medicalStatus.status === "expired"
                ? "Expired"
                : medicalStatus.status === "expiring"
                  ? "Expiring Soon"
                  : "Valid"}
            </Badge>
          ) : null}
        </div>
        <div className="p-6">
          <div className="max-w-md">
            <label className="mb-2 block text-sm font-medium text-gray-600">
              Medical Certificate Expiry Date
            </label>
            <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
              <div className="flex-1">
                <DatePicker
                  date={normalizeDate(form.medical_certificate_expiry)}
                  onChange={(date) =>
                    setField("medical_certificate_expiry", normalizeDate(date))
                  }
                  placeholder="Select expiry date"
                />
              </div>
              {form.medical_certificate_expiry ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setField("medical_certificate_expiry", null)}
                  className="h-11 shrink-0 rounded-lg border-gray-200 px-4 text-gray-500 hover:bg-red-50 hover:text-red-600"
                >
                  <X className="mr-2 h-4 w-4" />
                  Clear
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="mb-8 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/50 px-5 py-4">
          <h4 className="flex items-center gap-2 text-base font-semibold tracking-tight text-gray-900">
            <div className="rounded-md bg-indigo-50 p-1.5">
              <Award className="h-4 w-4 text-indigo-500" />
            </div>
            Endorsements & Ratings
          </h4>
          {!showAddEndorsement ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowAddEndorsement(true)}
              className="h-9 rounded-lg border-indigo-200 px-4 font-medium text-indigo-700 transition-colors hover:bg-indigo-50 hover:text-indigo-800"
            >
              <Plus className="mr-1.5 h-4 w-4" />
              Add
            </Button>
          ) : null}
        </div>

        <div className="p-5">
          {showAddEndorsement ? (
            <div className="animate-in fade-in slide-in-from-top-2 mb-6 rounded-xl border border-indigo-100 bg-indigo-50/30 p-5 shadow-sm duration-200">
              <div className="mb-5 flex items-center justify-between">
                <span className="text-sm font-bold tracking-wider text-indigo-900 uppercase">
                  Add New Endorsement
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={resetAddEndorsementForm}
                  className="h-8 w-8 rounded-full p-0 text-indigo-400 hover:bg-indigo-100/50 hover:text-indigo-600"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="grid grid-cols-1 items-end gap-4 md:grid-cols-2 lg:grid-cols-12">
                <div className="lg:col-span-4">
                  <label className="mb-1.5 block text-xs font-bold tracking-wide text-indigo-700 uppercase">
                    Endorsement Type
                  </label>
                  <Select value={selectedEndorsement} onValueChange={setSelectedEndorsement}>
                    <SelectTrigger className="h-10 rounded-lg border-indigo-100 bg-white shadow-sm focus:ring-indigo-500">
                      <SelectValue placeholder="Select endorsement" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableEndorsements
                        .filter((endorsement) => {
                          if (!endorsement.is_active || endorsement.voided_at) return false
                          return !userEndorsements.some(
                            (item) =>
                              item.endorsement?.id === endorsement.id &&
                              !item.voided_at
                          )
                        })
                        .map((endorsement) => (
                          <SelectItem key={endorsement.id} value={endorsement.id}>
                            {endorsement.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="lg:col-span-3">
                  <label className="mb-1.5 block text-xs font-bold tracking-wide text-indigo-700 uppercase">
                    Expiry Date (Optional)
                  </label>
                  <DatePicker
                    date={endorsementExpiryDate}
                    onChange={(date) => setEndorsementExpiryDate(date)}
                    placeholder="Select expiry date"
                    className="h-10 border-indigo-100 text-sm shadow-sm focus:ring-indigo-500"
                  />
                </div>

                <div className="lg:col-span-3">
                  <label className="mb-1.5 block text-xs font-bold tracking-wide text-indigo-700 uppercase">
                    Notes (Optional)
                  </label>
                  <Input
                    value={endorsementNotes}
                    onChange={(e) => setEndorsementNotes(e.target.value)}
                    placeholder="Additional notes..."
                    className="h-10 rounded-lg border-indigo-100 bg-white text-sm shadow-sm focus:ring-indigo-500"
                  />
                </div>

                <div className="flex gap-2 lg:col-span-2">
                  <Button
                    type="button"
                    onClick={addEndorsement}
                    disabled={!selectedEndorsement || endorsementsLoading}
                    size="sm"
                    className="h-10 flex-1 rounded-lg bg-indigo-600 font-bold text-white shadow-md shadow-indigo-200 hover:bg-indigo-700"
                  >
                    {endorsementsLoading ? "Adding..." : "Add"}
                  </Button>
                </div>
              </div>
            </div>
          ) : null}

          {userEndorsements.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {userEndorsements
                .filter((item) => item.endorsement)
                .map((item) => {
                  const expiryStatus = getExpiryStatus(item.expiry_date)
                  const StatusIcon = expiryStatus.icon
                  const endorsementName = item.endorsement?.name ?? "Unknown"

                  return (
                    <div
                      key={item.id}
                      className="group flex items-start justify-between rounded-xl border border-gray-100 bg-white p-4 transition-all duration-200 hover:border-indigo-200 hover:shadow-md hover:shadow-indigo-50/50"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="mb-1.5 flex flex-wrap items-center gap-2">
                          <span className="text-sm leading-none font-semibold text-gray-900">
                            {endorsementName}
                          </span>
                          <Badge className={`${expiryStatus.color} flex items-center gap-1 border-none px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase shadow-none`}>
                            <StatusIcon className="h-3 w-3" />
                            {expiryStatus.status === "expired"
                              ? "Expired"
                              : expiryStatus.status === "expiring"
                                ? "Soon"
                                : "Valid"}
                          </Badge>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-medium text-gray-500">
                          <div className="flex items-center gap-1">
                            <CalendarIcon className="h-3 w-3 text-gray-400" />
                            <span>Issued: {formatDate(item.issued_date)}</span>
                          </div>
                          {item.expiry_date ? (
                            <div className="flex items-center gap-1 text-gray-600">
                              <span className="text-gray-300">|</span>
                              <span>Expires: {formatDate(item.expiry_date)}</span>
                            </div>
                          ) : null}
                        </div>

                        {item.notes ? (
                          <div className="mt-2 rounded border-l-2 border-gray-200 bg-gray-50 p-2 text-[11px] text-gray-600 italic">
                            {item.notes}
                          </div>
                        ) : null}
                      </div>

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeEndorsement(item.id, endorsementName)}
                        className="ml-3 h-8 w-8 shrink-0 rounded-full p-0 text-gray-300 transition-colors hover:bg-red-50 hover:text-red-600"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )
                })}
            </div>
          ) : !showAddEndorsement ? (
            <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/50 py-12 text-center">
              <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full border border-gray-100 bg-white text-gray-300 shadow-sm">
                <Award className="h-6 w-6" />
              </div>
              <p className="text-sm font-medium text-gray-500">
                No endorsements or ratings found
              </p>
              <p className="mt-1 text-xs text-gray-400">
                Add them to track pilot qualifications
              </p>
            </div>
          ) : null}
        </div>
      </div>

      {error ? <p className="mt-2 text-xs text-red-500">{error}</p> : null}
    </form>
  )
}
