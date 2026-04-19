"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { UserPlus } from "lucide-react"

import MemberSelect, { type UserResult } from "@/components/invoices/member-select"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { useAddInstructorOptionsQuery } from "@/hooks/use-add-instructor-options-query"
import { cn } from "@/lib/utils"

const EMPLOYMENT_TYPES = [
  { value: "full_time", label: "Full Time" },
  { value: "part_time", label: "Part Time" },
  { value: "casual", label: "Casual" },
  { value: "contractor", label: "Contractor" },
] as const

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "deactivated", label: "Deactivated" },
  { value: "suspended", label: "Suspended" },
] as const

const SELECT_NONE = "__none__" as const

type FormState = {
  selectedMember: UserResult | null
  rating: string | null
  employment_type: (typeof EMPLOYMENT_TYPES)[number]["value"] | null
  status: (typeof STATUS_OPTIONS)[number]["value"]
  is_actively_instructing: boolean
  hire_date: string
}

const defaultFormState = (): FormState => ({
  selectedMember: null,
  rating: null,
  employment_type: null,
  status: "active",
  is_actively_instructing: true,
  hire_date: "",
})

export function AddInstructorModal(props: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}) {
  const { open, onOpenChange, onSuccess } = props
  const router = useRouter()

  const { data: options, isLoading: optionsLoading, isError: optionsError, error: optionsErrorObj } =
    useAddInstructorOptionsQuery(open)

  const [form, setForm] = React.useState<FormState>(() => defaultFormState())
  const [submitting, setSubmitting] = React.useState(false)

  React.useEffect(() => {
    if (!open) return
    setForm(defaultFormState())
    setSubmitting(false)
  }, [open])

  const members = options?.members ?? []
  const categories = options?.categories ?? []

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!form.selectedMember) {
      toast.error("Select a member to create an instructor profile.")
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch("/api/instructors", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          user_id: form.selectedMember.id,
          rating: form.rating,
          employment_type: form.employment_type,
          status: form.status,
          is_actively_instructing: form.is_actively_instructing,
          hire_date: form.hire_date.trim() ? form.hire_date.trim() : null,
        }),
      })
      const payload = (await response.json().catch(() => null)) as
        | { instructor?: { id: string; user_id: string }; error?: string }
        | null

      if (!response.ok) {
        throw new Error(payload?.error || "Failed to create instructor profile")
      }

      const userId = payload?.instructor?.user_id ?? form.selectedMember.id

      toast.success("Instructor profile created")
      onOpenChange(false)
      onSuccess?.()
      router.push(`/instructors/${userId}`)
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create instructor profile")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "p-0 border-none shadow-2xl rounded-[24px] overflow-hidden",
          "w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] sm:w-full sm:max-w-[720px]",
          "top-[calc(env(safe-area-inset-top)+1rem)] sm:top-[50%] translate-y-0 sm:translate-y-[-50%]",
          "h-[calc(100dvh-2rem)] sm:h-auto sm:max-h-[calc(100dvh-4rem)]"
        )}
      >
        <div className="flex h-full min-h-0 flex-col bg-white">
          <DialogHeader className="px-6 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-4 text-left sm:pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
                <UserPlus className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold tracking-tight text-slate-900">
                  Add Instructor
                </DialogTitle>
                <DialogDescription className="mt-0.5 text-sm text-slate-500">
                  Link an existing member to a new instructor profile. This does not change their login role by
                  itself. Required fields are marked with <span className="text-destructive">*</span>.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form
            id="add-instructor-form"
            onSubmit={submit}
            className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-6 pb-6"
          >
            {optionsLoading ? (
              <div className="space-y-4 py-8 text-center text-sm text-slate-500">Loading options…</div>
            ) : optionsError ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                {optionsErrorObj instanceof Error ? optionsErrorObj.message : "Failed to load members."}
              </div>
            ) : (
              <div className="space-y-6">
                <section>
                  <div className="mb-3 flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                    <span className="text-xs font-semibold tracking-tight text-slate-900">Member</span>
                  </div>

                  <div className="grid gap-5">
                    <div>
                      <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                        SELECT MEMBER <span className="text-destructive">*</span>
                      </label>
                      <MemberSelect
                        members={members}
                        value={form.selectedMember}
                        onSelect={(user) => setForm((prev) => ({ ...prev, selectedMember: user }))}
                        disabled={submitting}
                        buttonClassName="h-10 rounded-xl border-slate-200 bg-white px-3 text-base font-medium shadow-none hover:bg-slate-50"
                      />
                      {members.length === 0 ? (
                        <p className="mt-2 text-[11px] text-slate-500">
                          No eligible members found. Everyone may already have an instructor profile, or there are no
                          active members.
                        </p>
                      ) : null}
                    </div>

                    {form.selectedMember ? (
                      <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                        <div className="mb-2 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                          Member details
                        </div>
                        <div className="grid gap-2 text-sm text-slate-800">
                          <div className="flex flex-wrap gap-x-3 gap-y-1">
                            <span className="font-semibold">Name</span>
                            <span>
                              {[form.selectedMember.first_name, form.selectedMember.last_name]
                                .filter(Boolean)
                                .join(" ") || "—"}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-x-3 gap-y-1">
                            <span className="font-semibold">Email</span>
                            <span className="break-all">{form.selectedMember.email}</span>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </section>

                <section>
                  <div className="mb-3 flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                    <span className="text-xs font-semibold tracking-tight text-slate-900">Instructor profile</span>
                  </div>

                  <div className="grid gap-5 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                        INSTRUCTOR CATEGORY
                      </label>
                      <Select
                        value={form.rating ?? SELECT_NONE}
                        onValueChange={(value) =>
                          setForm((prev) => ({
                            ...prev,
                            rating: value === SELECT_NONE ? null : value,
                          }))
                        }
                        disabled={submitting}
                      >
                        <SelectTrigger className="h-10 rounded-xl border-slate-200 bg-white px-3 text-base font-medium shadow-none hover:bg-slate-50">
                          <SelectValue placeholder="Category" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={SELECT_NONE}>Not set</SelectItem>
                          {categories.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                        EMPLOYMENT TYPE
                      </label>
                      <Select
                        value={form.employment_type ?? SELECT_NONE}
                        onValueChange={(value) =>
                          setForm((prev) => ({
                            ...prev,
                            employment_type:
                              value === SELECT_NONE ? null : (value as FormState["employment_type"]),
                          }))
                        }
                        disabled={submitting}
                      >
                        <SelectTrigger className="h-10 rounded-xl border-slate-200 bg-white px-3 text-base font-medium shadow-none hover:bg-slate-50">
                          <SelectValue placeholder="Type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={SELECT_NONE}>Not set</SelectItem>
                          {EMPLOYMENT_TYPES.map((item) => (
                            <SelectItem key={item.value} value={item.value}>
                              {item.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                        STATUS
                      </label>
                      <Select
                        value={form.status}
                        onValueChange={(value) =>
                          setForm((prev) => ({ ...prev, status: value as FormState["status"] }))
                        }
                        disabled={submitting}
                      >
                        <SelectTrigger className="h-10 rounded-xl border-slate-200 bg-white px-3 text-base font-medium shadow-none hover:bg-slate-50">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map((item) => (
                            <SelectItem key={item.value} value={item.value}>
                              {item.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                        HIRE DATE
                      </label>
                      <Input
                        type="date"
                        className="h-10 rounded-xl border-slate-200 bg-white px-3 text-base font-medium shadow-none hover:bg-slate-50 focus-visible:ring-0"
                        value={form.hire_date}
                        onChange={(e) => setForm((prev) => ({ ...prev, hire_date: e.target.value }))}
                        disabled={submitting}
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                        <div className="flex items-center justify-between gap-4">
                          <div className="space-y-0.5">
                            <Label className="text-sm font-semibold text-slate-900">Actively instructing</Label>
                            <p className="text-xs text-slate-500">
                              When off, they remain on file but won&apos;t appear in active instructor pickers.
                            </p>
                          </div>
                          <Switch
                            checked={form.is_actively_instructing}
                            onCheckedChange={(checked) =>
                              setForm((prev) => ({ ...prev, is_actively_instructing: checked }))
                            }
                            disabled={submitting}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            )}
          </form>

          <div className="border-t bg-white px-6 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-[0_-4px_12px_rgba(0,0,0,0.05)] sm:pb-4">
            <div className="flex items-center justify-between gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={submitting}
                className="h-10 flex-1 rounded-xl border-slate-200 text-xs font-bold shadow-none hover:bg-slate-50"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                form="add-instructor-form"
                disabled={submitting || optionsLoading || optionsError || members.length === 0}
                className="h-10 flex-[1.4] rounded-xl bg-slate-900 text-xs font-bold text-white shadow-lg shadow-slate-900/10 hover:bg-slate-800"
              >
                {submitting ? "Saving..." : "Create instructor profile"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
