"use client"

import * as React from "react"
import { Building, User as UserIcon, Users } from "lucide-react"
import { toast } from "sonner"

import { updateMemberContactAction, type UpdateMemberContactInput } from "@/app/members/actions"
import { DatePicker } from "@/components/ui/date-picker"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { MemberDetailWithRelations } from "@/lib/types/members"

type ContactFormValues = Omit<UpdateMemberContactInput, "memberId">
type GenderValue = NonNullable<ContactFormValues["gender"]>

function toNullable(value: string | null | undefined) {
  if (value == null) return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function toGender(value: string | null | undefined): GenderValue | null {
  const normalized = toNullable(value)?.toLowerCase()
  if (normalized === "male" || normalized === "female") {
    return normalized
  }
  return null
}

function toFormValues(member: MemberDetailWithRelations): ContactFormValues {
  return {
    first_name: member.user?.first_name ?? "",
    last_name: member.user?.last_name ?? "",
    email: member.user?.email ?? "",
    phone: toNullable(member.user?.phone),
    street_address: toNullable(member.user?.street_address),
    gender: toGender(member.user?.gender),
    date_of_birth: toNullable(member.user?.date_of_birth),
    notes: toNullable(member.user?.notes),
    next_of_kin_name: toNullable(member.user?.next_of_kin_name),
    next_of_kin_phone: toNullable(member.user?.next_of_kin_phone),
    company_name: toNullable(member.user?.company_name),
    occupation: toNullable(member.user?.occupation),
    employer: toNullable(member.user?.employer),
  }
}

function normalize(values: ContactFormValues): ContactFormValues {
  return {
    first_name: values.first_name.trim(),
    last_name: values.last_name.trim(),
    email: values.email.trim(),
    phone: toNullable(values.phone),
    street_address: toNullable(values.street_address),
    gender: toGender(values.gender),
    date_of_birth: toNullable(values.date_of_birth),
    notes: toNullable(values.notes),
    next_of_kin_name: toNullable(values.next_of_kin_name),
    next_of_kin_phone: toNullable(values.next_of_kin_phone),
    company_name: toNullable(values.company_name),
    occupation: toNullable(values.occupation),
    employer: toNullable(values.employer),
  }
}

function areEqual(a: ContactFormValues, b: ContactFormValues) {
  return JSON.stringify(normalize(a)) === JSON.stringify(normalize(b))
}

function normalizeOptional(value: string) {
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

type Props = {
  memberId: string
  member: MemberDetailWithRelations | null
  onDirtyChange?: (isDirty: boolean) => void
  onSavingChange?: (isSaving: boolean) => void
  onUndoRef?: React.MutableRefObject<(() => void) | null>
  onSaved?: (values: ContactFormValues) => void
  formId?: string
}

export function MemberContactDetails({
  memberId,
  member,
  onDirtyChange,
  onSavingChange,
  onUndoRef,
  onSaved,
  formId,
}: Props) {
  const [isSaving, setIsSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [initial, setInitial] = React.useState<ContactFormValues | null>(null)
  const [form, setForm] = React.useState<ContactFormValues>({
    first_name: "",
    last_name: "",
    email: "",
    phone: null,
    street_address: null,
    gender: null,
    date_of_birth: null,
    notes: null,
    next_of_kin_name: null,
    next_of_kin_phone: null,
    company_name: null,
    occupation: null,
    employer: null,
  })

  React.useEffect(() => {
    if (!member) return
    const values = toFormValues(member)
    setInitial(values)
    setForm(values)
  }, [member])

  const isDirty = React.useMemo(() => {
    if (!initial) return false
    return !areEqual(initial, form)
  }, [initial, form])

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

  const setField = <K extends keyof ContactFormValues>(
    key: K,
    value: ContactFormValues[K]
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    if (!form.first_name.trim() || !form.last_name.trim()) {
      setError("First name and last name are required.")
      return
    }
    if (!form.email.trim()) {
      setError("Email is required.")
      return
    }

    const payload: UpdateMemberContactInput = {
      memberId,
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      email: form.email.trim(),
      phone: normalizeOptional(form.phone ?? ""),
      street_address: normalizeOptional(form.street_address ?? ""),
      gender: toGender(form.gender),
      date_of_birth: normalizeOptional(form.date_of_birth ?? ""),
      notes: normalizeOptional(form.notes ?? ""),
      next_of_kin_name: normalizeOptional(form.next_of_kin_name ?? ""),
      next_of_kin_phone: normalizeOptional(form.next_of_kin_phone ?? ""),
      company_name: normalizeOptional(form.company_name ?? ""),
      occupation: normalizeOptional(form.occupation ?? ""),
      employer: normalizeOptional(form.employer ?? ""),
    }

    setIsSaving(true)
    try {
      const result = await updateMemberContactAction(payload)
      if (!result.ok) {
        setError(result.error)
        toast.error(result.error)
        return
      }

      const savedValues: ContactFormValues = {
        first_name: payload.first_name,
        last_name: payload.last_name,
        email: payload.email,
        phone: payload.phone,
        street_address: payload.street_address,
        gender: payload.gender,
        date_of_birth: payload.date_of_birth,
        notes: payload.notes,
        next_of_kin_name: payload.next_of_kin_name,
        next_of_kin_phone: payload.next_of_kin_phone,
        company_name: payload.company_name,
        occupation: payload.occupation,
        employer: payload.employer,
      }
      setInitial(savedValues)
      onSaved?.(savedValues)
      toast.success("Contact information saved!")
    } finally {
      setIsSaving(false)
    }
  }

  if (!member) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-muted-foreground">Loading contact information...</div>
      </div>
    )
  }

  return (
    <form id={formId} onSubmit={onSubmit} className="pb-12">
      <div className="mb-6 flex flex-row items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Contact Information</h3>
      </div>

      <div className="mb-8 rounded-lg border border-gray-200 bg-gray-50 p-6 shadow-sm">
        <h4 className="mb-4 flex items-center gap-2 text-base font-semibold tracking-tight text-gray-900">
          <UserIcon className="h-5 w-5 text-indigo-500" />
          Personal Details
        </h4>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="max-w-md">
            <label className="mb-1 block text-sm font-medium text-gray-700">First Name</label>
            <Input
              value={form.first_name}
              onChange={(e) => setField("first_name", e.target.value)}
              className="bg-white"
            />
          </div>
          <div className="max-w-md">
            <label className="mb-1 block text-sm font-medium text-gray-700">Last Name</label>
            <Input
              value={form.last_name}
              onChange={(e) => setField("last_name", e.target.value)}
              className="bg-white"
            />
          </div>
          <div className="max-w-md">
            <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
            <Input
              value={form.email}
              onChange={(e) => setField("email", e.target.value)}
              type="email"
              className="bg-white"
            />
          </div>
          <div className="max-w-md">
            <label className="mb-1 block text-sm font-medium text-gray-700">Phone</label>
            <Input
              value={form.phone ?? ""}
              onChange={(e) => setField("phone", e.target.value)}
              type="tel"
              className="bg-white"
            />
          </div>
          <div className="max-w-md">
            <label className="mb-1 block text-sm font-medium text-gray-700">Street Address</label>
            <Input
              value={form.street_address ?? ""}
              onChange={(e) => setField("street_address", e.target.value)}
              className="bg-white"
            />
          </div>
          <div className="max-w-md">
            <div className="flex gap-4">
              <div className="w-1/2 min-w-0">
                <label className="mb-1 block text-sm font-medium text-gray-700">Gender</label>
                <Select
                  key={`member-contact-gender-${memberId}-${form.gender ?? "unset"}`}
                  value={toGender(form.gender) ?? "unset"}
                  onValueChange={(value) =>
                    setField("gender", value === "unset" ? null : toGender(value))
                  }
                >
                  <SelectTrigger className="w-full bg-white">
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unset">Not set</SelectItem>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="w-1/2 min-w-0">
                <label className="mb-1 block text-sm font-medium text-gray-700">Date of Birth</label>
                <DatePicker
                  date={form.date_of_birth}
                  onChange={(date) => setField("date_of_birth", date)}
                  placeholder="Select date of birth"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-8 rounded-lg border border-gray-200 bg-gray-50 p-6 shadow-sm">
        <h4 className="mb-4 flex items-center gap-2 text-base font-semibold tracking-tight text-gray-900">
          <Building className="h-5 w-5 text-indigo-500" />
          Company Details
        </h4>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="max-w-md">
            <label className="mb-1 block text-sm font-medium text-gray-700">Company</label>
            <Input
              value={form.company_name ?? ""}
              onChange={(e) => setField("company_name", e.target.value)}
              className="bg-white"
            />
          </div>
          <div className="max-w-md">
            <label className="mb-1 block text-sm font-medium text-gray-700">Occupation</label>
            <Input
              value={form.occupation ?? ""}
              onChange={(e) => setField("occupation", e.target.value)}
              className="bg-white"
            />
          </div>
          <div className="max-w-md">
            <label className="mb-1 block text-sm font-medium text-gray-700">Employer</label>
            <Input
              value={form.employer ?? ""}
              onChange={(e) => setField("employer", e.target.value)}
              className="bg-white"
            />
          </div>
        </div>
      </div>

      <div className="mb-8 rounded-lg border border-gray-200 bg-gray-50 p-6 shadow-sm">
        <h4 className="mb-4 flex items-center gap-2 text-base font-semibold tracking-tight text-gray-900">
          <Users className="h-5 w-5 text-indigo-500" />
          Next of Kin
        </h4>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="max-w-md">
            <label className="mb-1 block text-sm font-medium text-gray-700">Next of Kin Name</label>
            <Input
              value={form.next_of_kin_name ?? ""}
              onChange={(e) => setField("next_of_kin_name", e.target.value)}
              className="bg-white"
            />
          </div>
          <div className="max-w-md">
            <label className="mb-1 block text-sm font-medium text-gray-700">Next of Kin Phone</label>
            <Input
              value={form.next_of_kin_phone ?? ""}
              onChange={(e) => setField("next_of_kin_phone", e.target.value)}
              type="tel"
              className="bg-white"
            />
          </div>
        </div>
      </div>

      <div className="mb-2 rounded-lg border border-gray-200 bg-gray-50 p-6 shadow-sm">
        <h4 className="mb-4 text-base font-semibold tracking-tight text-gray-900">Notes</h4>
        <div className="max-w-md">
          <Input
            value={form.notes ?? ""}
            onChange={(e) => setField("notes", e.target.value)}
            className="bg-white"
            placeholder="Additional notes..."
          />
        </div>
      </div>

      {error ? <p className="mt-2 text-xs text-red-500">{error}</p> : null}
    </form>
  )
}
