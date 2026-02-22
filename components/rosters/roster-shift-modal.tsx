"use client"

import * as React from "react"
import { z } from "zod"
import { toast } from "sonner"
import { Calendar, Pencil, Plus, Repeat, User } from "lucide-react"

import {
  checkRosterRuleConflictsAction,
  createRosterRuleAction,
  updateRosterRuleAction,
  voidRosterRuleAction,
} from "@/app/rosters/actions"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { FieldError } from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import type { RosterRule } from "@/lib/types/roster"

const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/

const optionalEffectiveDate = z
  .string()
  .optional()
  .transform((value) => {
    if (!value || value.trim() === "") {
      return null
    }
    return value
  })
  .refine((value) => value === null || /^\d{4}-\d{2}-\d{2}$/.test(value), {
    message: "Invalid date",
  })

const rosterShiftSchema = z
  .object({
    instructor_id: z.string().uuid(),
    day_of_week: z.number().int().min(0).max(6),
    days_of_week: z.array(z.number().int().min(0).max(6)).optional(),
    start_time: z.string().regex(timePattern),
    end_time: z.string().regex(timePattern),
    is_recurring: z.boolean(),
    effective_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    effective_until: optionalEffectiveDate,
    notes: z
      .string()
      .max(1000)
      .optional()
      .nullable()
      .transform((value) => (value?.trim() ? value.trim() : null)),
  })
  .superRefine((values, ctx) => {
    if (values.is_recurring && (!values.days_of_week || values.days_of_week.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["days_of_week"],
        message: "Select at least one day",
      })
    }

    if (values.end_time <= values.start_time) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["end_time"],
        message: "End time must be after start time",
      })
    }

    if (values.effective_until && values.effective_until < values.effective_from) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["effective_until"],
        message: "End date must be on or after the start date",
      })
    }

    if (!values.is_recurring) {
      if (!values.effective_until) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["effective_until"],
          message: "One-off rosters must include the same end date",
        })
      } else if (values.effective_until !== values.effective_from) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["effective_until"],
          message: "One-off rosters must end on the same day they start",
        })
      }
    }
  })

type RosterShiftFormInput = z.input<typeof rosterShiftSchema>
type RosterShiftFormOutput = z.output<typeof rosterShiftSchema>
export type RosterShiftFormValues = RosterShiftFormInput

interface InstructorOption {
  id: string
  name: string
}

interface RosterShiftModalProps {
  open: boolean
  mode: "create" | "edit"
  instructors: InstructorOption[]
  initialValues: RosterShiftFormValues
  ruleId?: string
  onClose: () => void
  onSaved: (rule: RosterRule) => void
  onDeleted?: (ruleId: string) => void
}

type FieldErrors = Partial<Record<keyof RosterShiftFormInput, string>>

const timeOptions = Array.from({ length: 48 }, (_, i) => {
  const hour = Math.floor(i / 2)
  const minute = i % 2 === 0 ? "00" : "30"
  const value = `${hour.toString().padStart(2, "0")}:${minute}`
  return { value, label: value }
})

const overrideTypeOptions = [
  { value: "add_extra_shift", label: "Add Extra Shift" },
  { value: "leave", label: "Leave" },
  { value: "sick", label: "Sick" },
]

function toDisplayDate(value: string, withWeekday: boolean) {
  if (!value) return ""

  const parts = value.split("-").map((piece) => Number(piece))
  if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) {
    return value
  }

  const date = new Date(parts[0], (parts[1] ?? 1) - 1, parts[2] ?? 1)

  return new Intl.DateTimeFormat(
    "en-US",
    withWeekday
      ? {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
        }
      : {
          month: "short",
          day: "numeric",
          year: "numeric",
        }
  ).format(date)
}

function normalizeInitialValues(initialValues: RosterShiftFormValues): RosterShiftFormInput {
  return {
    ...initialValues,
    days_of_week:
      initialValues.days_of_week ??
      (initialValues.day_of_week !== undefined ? [initialValues.day_of_week] : []),
    effective_until: initialValues.effective_until ?? "",
    notes: initialValues.notes ?? null,
  }
}

function uniqueSortedDays(values: number[]) {
  return Array.from(new Set(values)).sort((a, b) => a - b)
}

export function RosterShiftModal({
  open,
  mode,
  instructors,
  initialValues,
  ruleId,
  onClose,
  onSaved,
  onDeleted,
}: RosterShiftModalProps) {
  const [formValues, setFormValues] = React.useState<RosterShiftFormInput>(
    normalizeInitialValues(initialValues)
  )
  const [fieldErrors, setFieldErrors] = React.useState<FieldErrors>({})
  const [error, setError] = React.useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [overrideType, setOverrideType] = React.useState(overrideTypeOptions[0].value)

  React.useEffect(() => {
    if (!open) return
    setFormValues(normalizeInitialValues(initialValues))
    setFieldErrors({})
    setError(null)
    setOverrideType(overrideTypeOptions[0].value)
  }, [open, initialValues])

  const isRecurringNow = formValues.is_recurring
  const effectiveFromValue = formValues.effective_from
  const selectedInstructorId = formValues.instructor_id
  const selectedDays = formValues.days_of_week ?? []

  const instructorLabel =
    instructors.find((inst) => inst.id === selectedInstructorId)?.name ?? "Instructor"

  const formattedDate = React.useMemo(
    () => toDisplayDate(effectiveFromValue, true),
    [effectiveFromValue]
  )

  const shortDate = React.useMemo(
    () => toDisplayDate(effectiveFromValue, false),
    [effectiveFromValue]
  )

  React.useEffect(() => {
    if (!open) return

    if (!isRecurringNow) {
      setFormValues((prev) => ({
        ...prev,
        effective_until: prev.effective_from,
      }))
      return
    }

    setFormValues((prev) => {
      const next = { ...prev }

      if (
        (next.effective_until === undefined ||
          next.effective_until === null ||
          next.effective_until === next.effective_from) &&
        next.effective_until !== ""
      ) {
        next.effective_until = ""
      }

      if (!next.days_of_week || next.days_of_week.length === 0) {
        next.days_of_week = [next.day_of_week]
      }

      return next
    })
  }, [open, isRecurringNow])

  const handleClose = React.useCallback(() => {
    if (isSubmitting) return

    setFormValues(normalizeInitialValues(initialValues))
    setFieldErrors({})
    setError(null)
    onClose()
  }, [isSubmitting, initialValues, onClose])

  const handleDelete = async () => {
    if (!ruleId) return

    setIsSubmitting(true)
    try {
      const result = await voidRosterRuleAction({ rule_id: ruleId })
      if (!result.ok) {
        throw new Error(result.error || "Failed to archive roster rule")
      }

      toast.success("Roster rule archived")
      onDeleted?.(ruleId)
      handleClose()
    } catch (deleteError) {
      const message =
        deleteError instanceof Error
          ? deleteError.message
          : "Failed to archive roster rule"
      setError(message)
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    setFieldErrors({})
    setError(null)

    const parsed = rosterShiftSchema.safeParse(formValues)
    if (!parsed.success) {
      const nextFieldErrors: FieldErrors = {}

      for (const issue of parsed.error.issues) {
        const pathKey = issue.path[0]
        if (typeof pathKey !== "string") continue
        if (!nextFieldErrors[pathKey as keyof RosterShiftFormInput]) {
          nextFieldErrors[pathKey as keyof RosterShiftFormInput] = issue.message
        }
      }

      setFieldErrors(nextFieldErrors)
      toast.error("Please fix the highlighted fields")
      return
    }

    const values = parsed.data as RosterShiftFormOutput
    const recurringDays = uniqueSortedDays(values.days_of_week ?? [values.day_of_week])
    const targetDays = values.is_recurring ? recurringDays : [values.day_of_week]

    if (!targetDays.length) {
      setFieldErrors({ days_of_week: "Select at least one day" })
      return
    }

    setIsSubmitting(true)

    try {
      const effectiveUntil = values.is_recurring ? values.effective_until : values.effective_from
      const conflictCheckResult = await checkRosterRuleConflictsAction({
        instructor_id: values.instructor_id,
        days_of_week: targetDays,
        start_time: values.start_time,
        end_time: values.end_time,
        effective_from: values.effective_from,
        effective_until: effectiveUntil,
        exclude_rule_id: mode === "edit" ? ruleId : undefined,
      })

      if (!conflictCheckResult.ok) {
        throw new Error(conflictCheckResult.error || "Failed to validate roster conflicts")
      }

      const savedRules: RosterRule[] = []

      if (mode === "create") {
        for (const dayOfWeek of targetDays) {
          const result = await createRosterRuleAction({
            instructor_id: values.instructor_id,
            day_of_week: dayOfWeek,
            start_time: values.start_time,
            end_time: values.end_time,
            effective_from: values.effective_from,
            effective_until: effectiveUntil,
            notes: values.notes ?? null,
          })

          if (!result.ok) {
            throw new Error(result.error || "Failed to save roster rule")
          }

          savedRules.push(result.rule)
        }
      } else {
        if (!ruleId) throw new Error("Missing roster rule id")

        const primaryDay = targetDays[0]
        const updateResult = await updateRosterRuleAction({
          rule_id: ruleId,
          instructor_id: values.instructor_id,
          day_of_week: primaryDay,
          start_time: values.start_time,
          end_time: values.end_time,
          effective_from: values.effective_from,
          effective_until: effectiveUntil,
          notes: values.notes ?? null,
        })

        if (!updateResult.ok) {
          throw new Error(updateResult.error || "Failed to save roster rule")
        }

        savedRules.push(updateResult.rule)

        if (values.is_recurring && targetDays.length > 1) {
          for (const dayOfWeek of targetDays.slice(1)) {
            const createResult = await createRosterRuleAction({
              instructor_id: values.instructor_id,
              day_of_week: dayOfWeek,
              start_time: values.start_time,
              end_time: values.end_time,
              effective_from: values.effective_from,
              effective_until: values.effective_until,
              notes: values.notes ?? null,
            })

            if (!createResult.ok) {
              throw new Error(createResult.error || "Failed to save roster rule")
            }

            savedRules.push(createResult.rule)
          }
        }
      }

      for (const rule of savedRules) {
        onSaved(rule)
      }

      toast.success(
        `Roster ${mode === "create" ? "created" : "updated"} successfully`
      )
      handleClose()
    } catch (submitError) {
      const message =
        submitError instanceof Error
          ? submitError.message
          : "Failed to save roster rule"
      setError(message)
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const allTimeOptions = React.useMemo(() => {
    const options = [...timeOptions]

    if (formValues.start_time && !options.some((o) => o.value === formValues.start_time)) {
      options.push({ value: formValues.start_time, label: formValues.start_time })
    }

    if (formValues.end_time && !options.some((o) => o.value === formValues.end_time)) {
      options.push({ value: formValues.end_time, label: formValues.end_time })
    }

    return options.sort((a, b) => a.value.localeCompare(b.value))
  }, [formValues.start_time, formValues.end_time])

  return (
    <Dialog open={open} onOpenChange={(value) => value || handleClose()}>
      <DialogContent
        className={cn(
          "p-0 border-none shadow-2xl rounded-[28px] overflow-hidden",
          "w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] sm:w-full sm:max-w-[600px]",
          "top-[calc(env(safe-area-inset-top)+1rem)] sm:top-[50%] translate-y-0 sm:translate-y-[-50%]",
          "h-[calc(100dvh-2rem)] sm:h-[calc(100dvh-4rem)] sm:max-h-[calc(100dvh-4rem)]"
        )}
      >
        <div className="flex h-full min-h-0 flex-col bg-white">
          <DialogHeader className="px-6 sm:px-8 pt-[calc(2rem+env(safe-area-inset-top))] sm:pt-8 pb-6 text-left flex-shrink-0">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                {mode === "create" ? (
                  <Plus className="h-6 w-6" />
                ) : (
                  <Pencil className="h-6 w-6" />
                )}
              </div>
              <div>
                <DialogTitle className="text-2xl font-bold tracking-tight text-slate-900">
                  {mode === "create"
                    ? "Create Roster Assignment"
                    : "Edit Roster Assignment"}
                </DialogTitle>
                <DialogDescription className="mt-1 text-base text-slate-500">
                  {mode === "create" ? "Creating" : "Editing"} assignment for{" "}
                  <span className="font-bold text-slate-900">{instructorLabel}</span> on{" "}
                  {formattedDate} starting at {formValues.start_time}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-6 sm:px-8 pb-[calc(2rem+env(safe-area-inset-bottom))] sm:pb-8">
            <div className="mb-6 flex items-center gap-4 rounded-[20px] bg-blue-50 p-4 text-blue-700 ring-1 ring-blue-100/50">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-blue-100">
                <Calendar className="h-6 w-6" />
              </div>
              <div>
                <p className="font-semibold">
                  {isRecurringNow ? "Recurring Schedule" : "One-off Assignment"}
                </p>
                <p className="text-sm opacity-70 font-medium">
                  {isRecurringNow ? "Repeats weekly" : shortDate}
                </p>
              </div>
            </div>

            <form onSubmit={onSubmit} className="space-y-8">
              <section>
                <div className="mb-4 flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-slate-400" />
                  <span className="text-sm font-semibold tracking-tight text-slate-900">
                    Instructor
                  </span>
                </div>

                <Select
                  value={formValues.instructor_id}
                  onValueChange={(val) =>
                    setFormValues((prev) => ({ ...prev, instructor_id: val }))
                  }
                >
                  <SelectTrigger className="h-12 w-full rounded-xl border-slate-200 bg-white px-4 text-sm font-medium shadow-none hover:bg-slate-50 focus:ring-0">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-slate-400" />
                      <SelectValue placeholder="Select instructor" />
                    </div>
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-slate-200 shadow-xl">
                    {instructors.map((inst) => (
                      <SelectItem
                        key={inst.id}
                        value={inst.id}
                        className="rounded-lg py-2.5"
                      >
                        {inst.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError
                  errors={
                    fieldErrors.instructor_id
                      ? [{ message: fieldErrors.instructor_id }]
                      : undefined
                  }
                />
              </section>

              <section>
                <div className="mb-4 flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-blue-500" />
                  <span className="text-sm font-semibold tracking-tight text-slate-900">
                    Assignment Type
                  </span>
                </div>

                <div className="flex gap-2 rounded-2xl bg-slate-50 p-1.5 ring-1 ring-slate-100">
                  <button
                    type="button"
                    onClick={() =>
                      setFormValues((prev) => ({ ...prev, is_recurring: false }))
                    }
                    className={cn(
                      "flex flex-1 items-center gap-3 rounded-xl px-4 py-3.5 transition-all",
                      !isRecurringNow
                        ? "bg-white shadow-sm ring-1 ring-slate-200"
                        : "text-slate-500 hover:bg-slate-100/50"
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-5 w-5 items-center justify-center rounded-full border transition-all",
                        !isRecurringNow
                          ? "border-blue-600 border-[5px]"
                          : "border-slate-300 bg-white"
                      )}
                    />
                    <Calendar className="h-4 w-4" />
                    <span className="text-sm font-semibold">One-off Assignment</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setFormValues((prev) => ({ ...prev, is_recurring: true }))
                    }
                    className={cn(
                      "flex flex-1 items-center gap-3 rounded-xl px-4 py-3.5 transition-all",
                      isRecurringNow
                        ? "bg-white shadow-sm ring-1 ring-slate-200"
                        : "text-slate-500 hover:bg-slate-100/50"
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-5 w-5 items-center justify-center rounded-full border transition-all",
                        isRecurringNow
                          ? "border-blue-600 border-[5px]"
                          : "border-slate-300 bg-white"
                      )}
                    />
                    <Repeat className="h-4 w-4" />
                    <span className="text-sm font-semibold">Recurring Schedule</span>
                  </button>
                </div>

                {isRecurringNow ? (
                  <div className="mt-4">
                    <label className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      REPEAT ON
                    </label>
                    <div className="flex justify-between gap-1">
                      {["S", "M", "T", "W", "T", "F", "S"].map((day, i) => {
                        const isSelected = selectedDays.includes(i)
                        return (
                          <button
                            key={`${day}-${i}`}
                            type="button"
                            onClick={() => {
                              const newDays = isSelected
                                ? selectedDays.filter((d) => d !== i)
                                : uniqueSortedDays([...selectedDays, i])

                              setFormValues((prev) => ({
                                ...prev,
                                days_of_week: newDays,
                                day_of_week: newDays[0] ?? prev.day_of_week,
                              }))
                            }}
                            className={cn(
                              "flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold transition-all",
                              isSelected
                                ? "bg-blue-600 text-white shadow-md shadow-blue-200"
                                : "bg-slate-50 text-slate-500 hover:bg-slate-100"
                            )}
                          >
                            {day}
                          </button>
                        )
                      })}
                    </div>
                    <FieldError
                      errors={
                        fieldErrors.days_of_week
                          ? [{ message: fieldErrors.days_of_week }]
                          : undefined
                      }
                    />
                  </div>
                ) : null}
              </section>

              {!isRecurringNow ? (
                <section>
                  <div className="mb-4 flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-emerald-500" />
                    <span className="text-sm font-semibold tracking-tight text-slate-900">
                      Assignment Options
                    </span>
                  </div>

                  <div className="grid gap-6">
                    <div>
                      <label className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        OVERRIDE TYPE
                      </label>
                      <Select value={overrideType} onValueChange={setOverrideType}>
                        <SelectTrigger className="h-12 w-full rounded-xl border-slate-200 bg-white px-4 text-sm font-medium shadow-none hover:bg-slate-50 focus:ring-0">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-slate-200 shadow-xl">
                          {overrideTypeOptions.map((opt) => (
                            <SelectItem
                              key={opt.value}
                              value={opt.value}
                              className="rounded-lg py-2.5"
                            >
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </section>
              ) : null}

              <section>
                <div className="mb-4 flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-blue-500" />
                  <span className="text-sm font-semibold tracking-tight text-slate-900">
                    Schedule Times
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      START TIME
                    </label>
                    <Select
                      value={formValues.start_time}
                      onValueChange={(val) =>
                        setFormValues((prev) => ({ ...prev, start_time: val }))
                      }
                    >
                      <SelectTrigger className="h-12 w-full rounded-xl border-slate-200 bg-white px-4 text-sm font-medium shadow-none hover:bg-slate-50 focus:ring-0">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-slate-200 shadow-xl">
                        {allTimeOptions.map((opt) => (
                          <SelectItem
                            key={opt.value}
                            value={opt.value}
                            className="rounded-lg py-2.5"
                          >
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      END TIME
                    </label>
                    <Select
                      value={formValues.end_time}
                      onValueChange={(val) =>
                        setFormValues((prev) => ({ ...prev, end_time: val }))
                      }
                    >
                      <SelectTrigger className="h-12 w-full rounded-xl border-slate-200 bg-white px-4 text-sm font-medium shadow-none hover:bg-slate-50 focus:ring-0">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-slate-200 shadow-xl">
                        {allTimeOptions.map((opt) => (
                          <SelectItem
                            key={opt.value}
                            value={opt.value}
                            className="rounded-lg py-2.5"
                          >
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FieldError
                      errors={
                        fieldErrors.end_time
                          ? [{ message: fieldErrors.end_time }]
                          : undefined
                      }
                    />
                  </div>
                </div>
              </section>

              {error ? (
                <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm font-medium text-destructive">
                  {error}
                </div>
              ) : null}

              <div className="flex items-center justify-between gap-4 pt-4 pb-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClose}
                  disabled={isSubmitting}
                  className="h-12 flex-1 rounded-xl border-slate-200 text-sm font-bold shadow-none hover:bg-slate-50"
                >
                  Cancel
                </Button>
                {mode === "edit" ? (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleDelete}
                    disabled={isSubmitting}
                    className="h-12 px-4 rounded-xl text-sm font-bold text-destructive hover:bg-destructive/5 hover:text-destructive"
                  >
                    Archive
                  </Button>
                ) : null}
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="h-12 flex-[1.5] rounded-xl bg-slate-900 text-sm font-bold text-white shadow-lg shadow-slate-900/10 hover:bg-slate-800"
                >
                  {mode === "create" ? <Plus className="mr-2 h-4 w-4" /> : null}
                  {mode === "create" ? "Create Assignment" : "Update Assignment"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
