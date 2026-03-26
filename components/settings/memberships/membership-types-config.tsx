"use client"

import * as React from "react"
import { useQueryClient } from "@tanstack/react-query"
import {
  IconCreditCard,
  IconLoader2,
  IconPencil,
  IconPlus,
  IconSearch,
} from "@tabler/icons-react"
import { toast } from "sonner"

import { useChargeablesQuery } from "@/hooks/use-chargeables-query"
import { useDefaultTaxRateQuery } from "@/hooks/use-default-tax-rate-query"
import {
  createMembershipType,
  deactivateMembershipType,
  membershipTypesQueryKey,
  updateMembershipType,
  useMembershipTypesQuery,
} from "@/hooks/use-membership-types-query"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import type { InvoiceCreateChargeable } from "@/lib/types/invoice-create"
import type { MembershipTypeWithChargeable } from "@/lib/types/memberships"
import { cn } from "@/lib/utils"

type MembershipTypeFormData = {
  name: string
  code: string
  description: string
  duration_months: string
  benefits_text: string
  is_active: boolean
  chargeable_id: string
}

function normalizeBenefits(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message
  return "Something went wrong."
}

function createBlankFormData(): MembershipTypeFormData {
  return {
    name: "",
    code: "",
    description: "",
    duration_months: "12",
    benefits_text: "",
    is_active: true,
    chargeable_id: "none",
  }
}

function generateCode(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, "_")
    .substring(0, 50)
}

function normalizeName(value: string) {
  return value.trim().replaceAll(/\s+/g, " ")
}

function normalizeCode(value: string) {
  return value.trim().replaceAll(/\s+/g, "_")
}

function normalizeDescription(value: string) {
  return value.trim()
}

function parseBenefitsText(value: string) {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean)
}

function createEditFormData(type: MembershipTypeWithChargeable): MembershipTypeFormData {
  return {
    name: type.name ?? "",
    code: type.code ?? "",
    description: type.description ?? "",
    duration_months: String(type.duration_months ?? 12),
    benefits_text: normalizeBenefits(type.benefits).join("\n"),
    is_active: type.is_active ?? true,
    chargeable_id: type.chargeable_id ?? "none",
  }
}

export function MembershipTypesConfig() {
  const queryClient = useQueryClient()
  const [saving, setSaving] = React.useState(false)
  const [mutationError, setMutationError] = React.useState<string | null>(null)

  const [searchTerm, setSearchTerm] = React.useState("")
  const [addOpen, setAddOpen] = React.useState(false)
  const [editOpen, setEditOpen] = React.useState(false)
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [form, setForm] = React.useState<MembershipTypeFormData>(() => createBlankFormData())
  const {
    data: membershipTypes = [],
    isLoading: membershipTypesLoading,
    error: membershipTypesQueryError,
  } = useMembershipTypesQuery({ includeInactive: true })
  const { data: taxRate = 0.15 } = useDefaultTaxRateQuery()
  const {
    data: membershipChargeables = [],
    error: membershipChargeablesError,
  } = useChargeablesQuery({ includeInactive: true, type: "membership_fee" })

  const editingMembershipType = React.useMemo(
    () => (editingId ? membershipTypes.find((item) => item.id === editingId) ?? null : null),
    [editingId, membershipTypes]
  )

  React.useEffect(() => {
    if (!membershipChargeablesError) return
    toast.error(getErrorMessage(membershipChargeablesError))
  }, [membershipChargeablesError])

  const error = mutationError ?? (membershipTypesQueryError ? getErrorMessage(membershipTypesQueryError) : null)

  const canSave = React.useMemo(() => {
    if (saving) return false
    if (!normalizeName(form.name).length) return false
    if (!normalizeCode(form.code).length) return false
    const duration = Number.parseInt(form.duration_months, 10)
    return Number.isInteger(duration) && duration > 0
  }, [form.code, form.duration_months, form.name, saving])

  const filteredTypes = React.useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    if (!term) return membershipTypes

    return membershipTypes.filter((type) =>
      [type.name, type.code, type.description ?? "", type.chargeables?.name ?? ""].join(" ").toLowerCase().includes(term)
    )
  }, [membershipTypes, searchTerm])

  const formatCurrency = React.useCallback((amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(amount)
  }, [])

  const formatDuration = React.useCallback((months: number) => {
    if (months === 1) return "1 month"
    if (months === 12) return "1 year"
    if (months % 12 === 0) return `${months / 12} years`
    return `${months} months`
  }, [])

  const calculateTaxInclusiveRate = React.useCallback(
    (rate: number, isTaxable = true) => {
      if (!isTaxable) return rate
      return rate * (1 + taxRate)
    },
    [taxRate]
  )

  const resetForm = React.useCallback(() => {
    setForm(createBlankFormData())
  }, [])

  const handleCreate = async () => {
    if (!canSave) return

    setSaving(true)
    setMutationError(null)
    try {
      await createMembershipType({
        name: normalizeName(form.name),
        code: normalizeCode(form.code),
        description: normalizeDescription(form.description),
        duration_months: Number.parseInt(form.duration_months, 10),
        benefits: parseBenefitsText(form.benefits_text),
        is_active: form.is_active,
        chargeable_id: form.chargeable_id === "none" ? null : form.chargeable_id,
      })

      await queryClient.invalidateQueries({
        queryKey: membershipTypesQueryKey({ includeInactive: true }),
      })
      setAddOpen(false)
      resetForm()
      toast.success("Membership type created")
    } catch (err) {
      const message = getErrorMessage(err)
      setMutationError(message)
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  const handleUpdate = async () => {
    if (!editingMembershipType || !canSave) return

    setSaving(true)
    setMutationError(null)
    try {
      await updateMembershipType(editingMembershipType.id, {
        name: normalizeName(form.name),
        code: normalizeCode(form.code),
        description: normalizeDescription(form.description),
        duration_months: Number.parseInt(form.duration_months, 10),
        benefits: parseBenefitsText(form.benefits_text),
        is_active: form.is_active,
        chargeable_id: form.chargeable_id === "none" ? null : form.chargeable_id,
      })

      await queryClient.invalidateQueries({
        queryKey: membershipTypesQueryKey({ includeInactive: true }),
      })
      setEditOpen(false)
      setEditingId(null)
      resetForm()
      toast.success("Membership type updated")
    } catch (err) {
      const message = getErrorMessage(err)
      setMutationError(message)
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  const handleDeactivate = React.useCallback(
    async (type: MembershipTypeWithChargeable) => {
      if (!type.is_active) return
      const confirmed = window.confirm(`Deactivate "${type.name}"? It will no longer be available for new memberships.`)
      if (!confirmed) return

      setSaving(true)
      setMutationError(null)
      try {
        await deactivateMembershipType(type.id)

        await queryClient.invalidateQueries({
          queryKey: membershipTypesQueryKey({ includeInactive: true }),
        })
        setEditOpen(false)
        setEditingId(null)
        resetForm()
        toast.success("Membership type deactivated")
      } catch (err) {
        const message = getErrorMessage(err)
        setMutationError(message)
        toast.error(message)
      } finally {
        setSaving(false)
      }
    },
    [queryClient, resetForm]
  )

  return (
    <div className="space-y-6">
      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative w-full sm:max-w-xs">
            <IconSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search membership types..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-10 rounded-xl border-slate-200 bg-white pl-9 shadow-none focus-visible:ring-0"
              disabled={membershipTypesLoading}
            />
          </div>
        </div>

        <Dialog
          open={addOpen}
          onOpenChange={(open) => {
              setAddOpen(open)
              if (open) {
                resetForm()
                setMutationError(null)
            }
          }}
        >
          <Button
            size="sm"
            onClick={() => setAddOpen(true)}
            disabled={membershipTypesLoading || saving}
            className="h-10 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm shadow-indigo-100 transition-all active:scale-[0.98] whitespace-nowrap font-semibold border-none"
          >
            <IconPlus className="mr-1 h-4 w-4" />
            Add membership type
          </Button>

          <DialogContent
            className={cn(
              "p-0 border-none shadow-2xl rounded-[24px] overflow-hidden",
              "w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] sm:w-full sm:max-w-[540px]",
              "top-[calc(env(safe-area-inset-top)+1rem)] sm:top-[50%] translate-y-0 sm:translate-y-[-50%]",
              "h-[calc(100dvh-2rem)] sm:flex sm:flex-col sm:h-auto sm:max-h-[calc(100dvh-4rem)]"
            )}
          >
            <div className="flex flex-col flex-1 min-h-0 bg-white">
              <DialogHeader className="px-6 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-4 text-left sm:pt-6 shrink-0">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
                    <IconCreditCard className="h-5 w-5" />
                  </div>
                  <div>
                    <DialogTitle className="text-xl font-bold tracking-tight text-slate-900">
                      Add Membership Type
                    </DialogTitle>
                    <DialogDescription className="mt-0.5 text-sm text-slate-500">
                      Create a membership plan and optionally link it to a chargeable.
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-6 pb-6">
                <MembershipTypeFormFields
                  form={form}
                  setForm={setForm}
                  membershipChargeables={membershipChargeables}
                  taxRate={taxRate}
                />
              </div>

              <div className="shrink-0 border-t bg-white px-6 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-[0_-4px_12px_rgba(0,0,0,0.05)] sm:pb-4">
                <div className="flex items-center justify-between gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setAddOpen(false)}
                    className="h-10 flex-1 rounded-xl border-slate-200 text-xs font-bold shadow-none hover:bg-slate-50"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => void handleCreate()}
                    disabled={saving || !canSave}
                    className="h-10 flex-[1.4] rounded-xl bg-slate-900 text-xs font-bold text-white shadow-lg shadow-slate-900/10 hover:bg-slate-800"
                  >
                    {saving ? <IconLoader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
                    Create Membership Type
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Linked chargeable</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {membershipTypesLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  Loading membership types…
                </TableCell>
              </TableRow>
            ) : filteredTypes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  {searchTerm
                    ? "No membership types match your search."
                    : "No membership types configured. Add one to get started."}
                </TableCell>
              </TableRow>
            ) : (
              filteredTypes.map((type) => {
                const benefits = normalizeBenefits(type.benefits)
                const chargeableRate = type.chargeables
                  ? calculateTaxInclusiveRate(type.chargeables.rate ?? 0, type.chargeables.is_taxable ?? false)
                  : null

                return (
                  <TableRow key={type.id}>
                    <TableCell>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{type.name}</p>
                        {type.description ? (
                          <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{type.description}</p>
                        ) : benefits.length ? (
                          <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                            {benefits.length} benefit{benefits.length === 1 ? "" : "s"}
                          </p>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-slate-700">{type.code}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-slate-700">{formatDuration(type.duration_months)}</span>
                    </TableCell>
                    <TableCell>
                      {type.chargeables ? (
                        <div>
                          <p className="text-sm text-slate-900">{type.chargeables.name}</p>
                          <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
                            {formatCurrency(chargeableRate ?? 0)} incl.
                          </p>
                        </div>
                      ) : (
                        <span className="text-sm text-slate-500">None</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs",
                          type.is_active
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-slate-200 bg-white text-slate-600"
                        )}
                      >
                        {type.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => {
                          setEditingId(type.id)
                          setForm(createEditFormData(type))
                          setMutationError(null)
                          setEditOpen(true)
                        }}
                      >
                        <IconPencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog
        open={editOpen}
        onOpenChange={(open) => {
            setEditOpen(open)
            if (!open) {
              setEditingId(null)
              resetForm()
              setMutationError(null)
            }
          }}
      >
        <DialogContent
          className={cn(
            "p-0 border-none shadow-2xl rounded-[24px] overflow-hidden",
            "w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] sm:w-full sm:max-w-[540px]",
            "top-[calc(env(safe-area-inset-top)+1rem)] sm:top-[50%] translate-y-0 sm:translate-y-[-50%]",
            "h-[calc(100dvh-2rem)] sm:flex sm:flex-col sm:h-auto sm:max-h-[calc(100dvh-4rem)]"
          )}
        >
          <div className="flex flex-col flex-1 min-h-0 bg-white">
            <DialogHeader className="px-6 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-4 text-left sm:pt-6 shrink-0">
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
                  <IconPencil className="h-5 w-5" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-bold tracking-tight text-slate-900">
                    Edit Membership Type
                  </DialogTitle>
                  <DialogDescription className="mt-0.5 text-sm text-slate-500">
                    Update details, pricing link, and availability for this membership type.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-6 pb-6">
              <MembershipTypeFormFields
                form={form}
                setForm={setForm}
                membershipChargeables={membershipChargeables}
                taxRate={taxRate}
              />
            </div>

            <div className="shrink-0 border-t bg-white px-6 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-[0_-4px_12px_rgba(0,0,0,0.05)] sm:pb-4">
              <div className="flex items-center justify-between gap-3">
                {editingMembershipType?.is_active ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => editingMembershipType && void handleDeactivate(editingMembershipType)}
                    disabled={saving}
                    className="h-10 rounded-xl border-orange-200 text-orange-600 text-xs font-bold shadow-none hover:bg-orange-50 hover:text-orange-700"
                  >
                    Deactivate
                  </Button>
                ) : (
                  <div />
                )}
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setEditOpen(false)
                      setEditingId(null)
                      resetForm()
                      setMutationError(null)
                    }}
                    className="h-10 rounded-xl border-slate-200 text-xs font-bold shadow-none hover:bg-slate-50"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => void handleUpdate()}
                    disabled={saving || !canSave}
                    className="h-10 rounded-xl bg-slate-900 text-xs font-bold text-white shadow-lg shadow-slate-900/10 hover:bg-slate-800"
                  >
                    {saving ? <IconLoader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
                    Save Changes
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

type MembershipTypeFormFieldsProps = {
  form: MembershipTypeFormData
  setForm: React.Dispatch<React.SetStateAction<MembershipTypeFormData>>
  membershipChargeables: InvoiceCreateChargeable[]
  taxRate: number
}

function MembershipTypeFormFields({
  form,
  setForm,
  membershipChargeables,
  taxRate,
}: MembershipTypeFormFieldsProps) {
  const [descriptionOpen, setDescriptionOpen] = React.useState(Boolean(form.description))
  const [benefitsOpen, setBenefitsOpen] = React.useState(Boolean(form.benefits_text))

  React.useEffect(() => {
    setDescriptionOpen(Boolean(form.description))
  }, [form.description])

  React.useEffect(() => {
    setBenefitsOpen(Boolean(form.benefits_text))
  }, [form.benefits_text])

  const formatCurrency = React.useCallback((amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(amount)
  }, [])

  const calculateTaxInclusiveRate = React.useCallback(
    (rate: number, isTaxable = true) => {
      if (!isTaxable) return rate
      return rate * (1 + taxRate)
    },
    [taxRate]
  )

  return (
    <div className="space-y-5">
      <div>
        <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Name <span className="text-destructive">*</span>
        </label>
        <Input
          value={form.name}
          onChange={(e) => {
            const name = e.target.value
            setForm((prev) => ({
              ...prev,
              name,
              code: prev.code === "" || prev.code === generateCode(prev.name) ? generateCode(name) : prev.code,
            }))
          }}
          placeholder="e.g. Flying Member"
          className="h-11 rounded-xl border-slate-200 bg-white px-3 text-[15px] shadow-none transition-colors focus-visible:ring-0"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Code <span className="text-destructive">*</span>
        </label>
        <Input
          value={form.code}
          onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value }))}
          placeholder="e.g. flying_member"
          className="h-11 rounded-xl border-slate-200 bg-white px-3 text-[15px] shadow-none transition-colors focus-visible:ring-0"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Duration (months) <span className="text-destructive">*</span>
        </label>
        <Input
          value={form.duration_months}
          onChange={(e) => setForm((prev) => ({ ...prev, duration_months: e.target.value }))}
          type="number"
          min={1}
          step="1"
          className="h-11 rounded-xl border-slate-200 bg-white px-3 text-[15px] tabular-nums shadow-none transition-colors focus-visible:ring-0"
          placeholder="12"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Linked chargeable
        </label>
        <Select value={form.chargeable_id} onValueChange={(value) => setForm((prev) => ({ ...prev, chargeable_id: value }))}>
          <SelectTrigger className="h-11 w-full rounded-xl border-slate-200 bg-white shadow-none focus:ring-0">
            <SelectValue placeholder="Select chargeable" />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="none">No linked chargeable</SelectItem>
                {membershipChargeables.map((chargeable) => (
                  <SelectItem key={chargeable.id} value={chargeable.id}>
                    {chargeable.name} ({formatCurrency(calculateTaxInclusiveRate(chargeable.rate ?? 0, chargeable.is_taxable ?? undefined))})
                  </SelectItem>
                ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Label className="text-sm font-semibold text-slate-900 leading-none">Active</Label>
            <p className="mt-1 text-xs text-slate-600 leading-snug">
              Available for new memberships and renewals.
            </p>
          </div>
          <Switch
            checked={form.is_active}
            onCheckedChange={(checked) => setForm((prev) => ({ ...prev, is_active: checked }))}
          />
        </div>
      </div>

      <Collapsible open={descriptionOpen} onOpenChange={setDescriptionOpen}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 transition-colors hover:text-blue-700"
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-blue-600">
              <IconPlus className="h-3.5 w-3.5" />
            </span>
            {descriptionOpen ? "Hide description" : "Add description"}
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3">
          <div>
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Description
            </label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Optional notes shown to staff."
              rows={3}
              className="rounded-xl border-slate-200 bg-white px-3 py-2 text-[15px] shadow-none transition-colors focus-visible:ring-0"
            />
          </div>
        </CollapsibleContent>
      </Collapsible>

      <Collapsible open={benefitsOpen} onOpenChange={setBenefitsOpen}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 transition-colors hover:text-blue-700"
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-blue-600">
              <IconPlus className="h-3.5 w-3.5" />
            </span>
            {benefitsOpen ? "Hide benefits" : "Add benefits"}
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3">
          <div>
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Benefits
            </label>
            <Textarea
              value={form.benefits_text}
              onChange={(e) => setForm((prev) => ({ ...prev, benefits_text: e.target.value }))}
              placeholder={"Enter one benefit per line\nPriority booking\nMember discounts"}
              rows={4}
              className="rounded-xl border-slate-200 bg-white px-3 py-2 text-[15px] shadow-none transition-colors focus-visible:ring-0"
            />
            <p className="mt-1 text-[11px] text-slate-500">Optional. Add one benefit per line.</p>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}
