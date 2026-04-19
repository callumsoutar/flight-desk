"use client"

import * as React from "react"
import { HelpCircle, Plane } from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { z } from "zod"

import { createAircraft } from "@/hooks/use-aircraft-query"
import {
  createAircraftType,
  useAircraftTypesCache,
  useAircraftTypesQuery,
} from "@/hooks/use-aircraft-types-query"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Dialog as AddTypeDialog,
  DialogContent as AddTypeDialogContent,
  DialogDescription as AddTypeDialogDescription,
  DialogFooter as AddTypeDialogFooter,
  DialogHeader as AddTypeDialogHeader,
  DialogTitle as AddTypeDialogTitle,
} from "@/components/ui/dialog"

const totalTimeMethods = [
  "hobbs",
  "tacho",
  "airswitch",
  "hobbs less 5%",
  "hobbs less 10%",
  "tacho less 5%",
  "tacho less 10%",
] as const

const ADD_AIRCRAFT_TYPE_SELECT_VALUE = "__add_aircraft_type__"

const formSchema = z.object({
  registration: z.string().trim().min(1, "Registration is required").max(20, "Registration too long"),
  type: z.string().trim().min(1, "Type is required").max(100, "Type too long"),
  model: z.string().trim().max(100, "Model too long").optional(),
  manufacturer: z.string().trim().max(100, "Manufacturer too long").optional(),
  year_manufactured: z.number().int().min(1900, "Invalid year").max(2100, "Invalid year").optional(),
  aircraft_type_id: z.string().uuid("Invalid aircraft type").optional(),
  total_time_method: z.enum(totalTimeMethods, { message: "Total time method is required" }),
  initial_total_time_in_service: z
    .number({ message: "Initial TTIS is required" })
    .min(0, "Must be >= 0"),
  current_hobbs: z.number({ message: "Current hobbs is required" }).min(0, "Must be >= 0"),
  current_tach: z.number({ message: "Current tacho is required" }).min(0, "Must be >= 0"),
  on_line: z.boolean().optional(),
  prioritise_scheduling: z.boolean().optional(),
  record_hobbs: z.boolean().optional(),
  record_tacho: z.boolean().optional(),
  record_airswitch: z.boolean().optional(),
})

type FormValues = z.infer<typeof formSchema>
type FormErrors = Partial<Record<keyof FormValues, string>>

const initialValues: FormValues = {
  registration: "",
  type: "",
  model: "",
  manufacturer: "",
  year_manufactured: undefined,
  aircraft_type_id: undefined,
  total_time_method: "hobbs",
  initial_total_time_in_service: 0,
  current_hobbs: 0,
  current_tach: 0,
  on_line: true,
  prioritise_scheduling: false,
  record_hobbs: true,
  record_tacho: true,
  record_airswitch: false,
}

function getNumberInputValue(value: number | undefined): string {
  return value === undefined ? "" : String(value)
}

function parseNumberInput(raw: string): number | undefined {
  if (!raw.trim()) return undefined
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : undefined
}

export function AddAircraftModal(props: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { open, onOpenChange } = props
  const router = useRouter()

  const [submitting, setSubmitting] = React.useState(false)
  const [values, setValues] = React.useState<FormValues>(initialValues)
  const [errors, setErrors] = React.useState<FormErrors>({})
  const {
    data: aircraftTypes = [],
    error: aircraftTypesError,
    isLoading: isLoadingAircraftTypes,
  } = useAircraftTypesQuery(open)
  const { mergeAircraftType } = useAircraftTypesCache()
  const [isAddTypeDialogOpen, setIsAddTypeDialogOpen] = React.useState(false)
  const [isAircraftTypeSelectOpen, setIsAircraftTypeSelectOpen] = React.useState(false)
  const [newTypeName, setNewTypeName] = React.useState("")
  const [newTypeCategory, setNewTypeCategory] = React.useState("")
  const [newTypeDescription, setNewTypeDescription] = React.useState("")
  const [isCreatingType, setIsCreatingType] = React.useState(false)

  React.useEffect(() => {
    if (!open) return
    setValues(initialValues)
    setErrors({})
    setSubmitting(false)
    setIsAddTypeDialogOpen(false)
    setIsAircraftTypeSelectOpen(false)
    setNewTypeName("")
    setNewTypeCategory("")
    setNewTypeDescription("")
  }, [open])

  React.useEffect(() => {
    if (!open || !aircraftTypesError) return
    toast.error("Failed to load aircraft types")
  }, [aircraftTypesError, open])

  React.useEffect(() => {
    if (!open || aircraftTypes.length !== 1) return
    setValues((prev) => ({ ...prev, aircraft_type_id: aircraftTypes[0].id }))
  }, [open, aircraftTypes])

  const update = <K extends keyof FormValues>(key: K, value: FormValues[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  const handleCreateAircraftType = async () => {
    if (!newTypeName.trim()) {
      toast.error("Aircraft type name is required")
      return
    }
    setIsCreatingType(true)
    try {
      const created = await createAircraftType({
        name: newTypeName.trim(),
        category: newTypeCategory.trim() || null,
        description: newTypeDescription.trim() || null,
      })
      mergeAircraftType(created)
      update("aircraft_type_id", created.id)
      setIsAddTypeDialogOpen(false)
      setNewTypeName("")
      setNewTypeCategory("")
      setNewTypeDescription("")
      toast.success("Aircraft type created")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create aircraft type")
    } finally {
      setIsCreatingType(false)
    }
  }

  async function submit() {
    const parsed = formSchema.safeParse(values)
    if (!parsed.success) {
      const nextErrors: FormErrors = {}
      for (const issue of parsed.error.issues) {
        const field = issue.path[0]
        if (typeof field === "string" && !(field in nextErrors)) {
          nextErrors[field as keyof FormValues] = issue.message
        }
      }
      setErrors(nextErrors)
      return
    }

    setSubmitting(true)
    try {
      const aircraft = await createAircraft({
        registration: values.registration,
        type: values.type,
        model: values.model?.trim() ? values.model : null,
        manufacturer: values.manufacturer?.trim() ? values.manufacturer : null,
        year_manufactured: values.year_manufactured ?? null,
        aircraft_type_id: values.aircraft_type_id ?? null,
        total_time_method: values.total_time_method,
        initial_total_time_in_service: values.initial_total_time_in_service,
        current_hobbs: values.current_hobbs,
        current_tach: values.current_tach,
        on_line: values.on_line ?? true,
        prioritise_scheduling: values.prioritise_scheduling ?? false,
        record_hobbs: values.record_hobbs ?? false,
        record_tacho: values.record_tacho ?? false,
        record_airswitch: values.record_airswitch ?? false,
      })
      toast.success("Aircraft created")
      onOpenChange(false)
      router.push(`/aircraft/${aircraft.id}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create aircraft")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <TooltipProvider delayDuration={200}>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "h-[calc(100dvh-2rem)] w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] translate-y-0 overflow-hidden rounded-[24px] border-none p-0 shadow-2xl sm:top-[50%] sm:h-[min(calc(100dvh-4rem),850px)] sm:w-full sm:max-w-[720px] sm:translate-y-[-50%]",
          "top-[calc(env(safe-area-inset-top)+1rem)]"
        )}
      >
        <div className="flex h-full min-h-0 flex-col bg-white">
          <DialogHeader className="px-6 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-4 text-left sm:pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
                <Plane className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold tracking-tight text-slate-900">
                  Add Aircraft
                </DialogTitle>
                <DialogDescription className="mt-0.5 text-sm text-slate-500">
                  Create a new aircraft. Required fields are marked with{" "}
                  <span className="text-destructive">*</span>.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              void submit()
            }}
            className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-6 pb-6"
          >
            <div className="space-y-6">
              <section>
                <div className="mb-3 flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                  <span className="text-xs font-semibold tracking-tight text-slate-900">Aircraft Details</span>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-[9px] font-bold tracking-wider text-slate-400 uppercase">
                      REGISTRATION <span className="text-destructive">*</span>
                    </label>
                    <Input
                      autoFocus
                      className="h-10 rounded-xl border-slate-200 bg-white px-3 text-base font-medium shadow-none hover:bg-slate-50 focus-visible:ring-0"
                      placeholder="e.g. ZK-ABC"
                      value={values.registration}
                      onChange={(e) => update("registration", e.target.value)}
                    />
                    {errors.registration ? (
                      <p className="mt-1 text-[10px] text-destructive">{errors.registration}</p>
                    ) : null}
                  </div>

                  <div>
                    <label className="mb-1.5 block text-[9px] font-bold tracking-wider text-slate-400 uppercase">
                      TYPE <span className="text-destructive">*</span>
                    </label>
                    <Input
                      className="h-10 rounded-xl border-slate-200 bg-white px-3 text-base font-medium shadow-none hover:bg-slate-50 focus-visible:ring-0"
                      placeholder="e.g. C172"
                      value={values.type}
                      onChange={(e) => update("type", e.target.value)}
                    />
                    {errors.type ? <p className="mt-1 text-[10px] text-destructive">{errors.type}</p> : null}
                  </div>

                  <div>
                    <label className="mb-1.5 block text-[9px] font-bold tracking-wider text-slate-400 uppercase">
                      MODEL
                    </label>
                    <Input
                      className="h-10 rounded-xl border-slate-200 bg-white px-3 text-base font-medium shadow-none hover:bg-slate-50 focus-visible:ring-0"
                      placeholder="e.g. 172S"
                      value={values.model ?? ""}
                      onChange={(e) => update("model", e.target.value)}
                    />
                    {errors.model ? <p className="mt-1 text-[10px] text-destructive">{errors.model}</p> : null}
                  </div>

                  <div>
                    <label className="mb-1.5 block text-[9px] font-bold tracking-wider text-slate-400 uppercase">
                      MANUFACTURER
                    </label>
                    <Input
                      className="h-10 rounded-xl border-slate-200 bg-white px-3 text-base font-medium shadow-none hover:bg-slate-50 focus-visible:ring-0"
                      placeholder="e.g. Cessna"
                      value={values.manufacturer ?? ""}
                      onChange={(e) => update("manufacturer", e.target.value)}
                    />
                    {errors.manufacturer ? (
                      <p className="mt-1 text-[10px] text-destructive">{errors.manufacturer}</p>
                    ) : null}
                  </div>

                  <div>
                    <label className="mb-1.5 block text-[9px] font-bold tracking-wider text-slate-400 uppercase">
                      YEAR MANUFACTURED
                    </label>
                    <Input
                      type="number"
                      className="h-10 rounded-xl border-slate-200 bg-white px-3 text-base font-medium shadow-none hover:bg-slate-50 focus-visible:ring-0"
                      placeholder="e.g. 2008"
                      value={getNumberInputValue(values.year_manufactured)}
                      onChange={(e) => update("year_manufactured", parseNumberInput(e.target.value))}
                    />
                    {errors.year_manufactured ? (
                      <p className="mt-1 text-[10px] text-destructive">{errors.year_manufactured}</p>
                    ) : null}
                  </div>

                  <div>
                    <label className="mb-1.5 block text-[9px] font-bold tracking-wider text-slate-400 uppercase">
                      AIRCRAFT CATEGORY (OPTIONAL)
                    </label>
                    <Select
                      open={isAircraftTypeSelectOpen}
                      onOpenChange={setIsAircraftTypeSelectOpen}
                      value={values.aircraft_type_id || undefined}
                      onValueChange={(v) => {
                        if (v === ADD_AIRCRAFT_TYPE_SELECT_VALUE) {
                          setIsAircraftTypeSelectOpen(false)
                          setIsAddTypeDialogOpen(true)
                          return
                        }
                        update("aircraft_type_id", v)
                      }}
                    >
                      <SelectTrigger
                        aria-label="Aircraft category"
                        className="h-10 w-full rounded-xl border-slate-200 bg-white px-3 text-base font-medium shadow-none hover:bg-slate-50 focus:ring-0 dark:border-slate-600 dark:bg-slate-900/40 dark:hover:bg-slate-800/80"
                      >
                        <SelectValue
                          placeholder={isLoadingAircraftTypes ? "Loading aircraft types..." : "Select aircraft type..."}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {isLoadingAircraftTypes ? (
                          <SelectItem value="__loading_aircraft_types" disabled>
                            Loading aircraft types...
                          </SelectItem>
                        ) : null}
                        {!isLoadingAircraftTypes && aircraftTypes.length === 0 ? (
                          <SelectItem value="__no_aircraft_types" disabled>
                            No aircraft types found.
                          </SelectItem>
                        ) : null}
                        {aircraftTypes.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name}
                          </SelectItem>
                        ))}
                        <SelectSeparator />
                        <SelectItem
                          value={ADD_AIRCRAFT_TYPE_SELECT_VALUE}
                          className="font-medium text-indigo-600 focus:text-indigo-700 dark:text-indigo-400 dark:focus:text-indigo-300"
                        >
                          Add aircraft type
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    {errors.aircraft_type_id ? (
                      <p className="mt-1 text-[10px] text-destructive">{errors.aircraft_type_id}</p>
                    ) : null}
                  </div>

                </div>
              </section>

              <section>
                <div className="mb-3 flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                  <span className="text-xs font-semibold tracking-tight text-slate-900">Operational</span>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-[9px] font-bold tracking-wider text-slate-400 uppercase">
                      TOTAL TIME METHOD <span className="text-destructive">*</span>
                    </label>
                    <Select
                      value={values.total_time_method}
                      onValueChange={(v) => update("total_time_method", v as FormValues["total_time_method"])}
                    >
                      <SelectTrigger className="h-10 w-full rounded-xl border-slate-200 bg-white px-3 text-base font-medium shadow-none hover:bg-slate-50 focus:ring-0">
                        <SelectValue placeholder="Select a method..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="airswitch">Airswitch</SelectItem>
                        <SelectItem value="hobbs">Hobbs</SelectItem>
                        <SelectItem value="hobbs less 5%">Hobbs less 5%</SelectItem>
                        <SelectItem value="hobbs less 10%">Hobbs less 10%</SelectItem>
                        <SelectItem value="tacho">Tacho</SelectItem>
                        <SelectItem value="tacho less 5%">Tacho less 5%</SelectItem>
                        <SelectItem value="tacho less 10%">Tacho less 10%</SelectItem>
                      </SelectContent>
                    </Select>
                    {errors.total_time_method ? (
                      <p className="mt-1 text-[10px] text-destructive">{errors.total_time_method}</p>
                    ) : null}
                  </div>

                  <div>
                    <div className="mb-1.5 flex items-center gap-1.5">
                      <label className="block text-[9px] font-bold tracking-wider text-slate-400 uppercase">
                        INITIAL TOTAL TIME IN SERVICE (TTIS) <span className="text-destructive">*</span>
                      </label>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            className="rounded-full text-slate-400 outline-none ring-offset-2 hover:text-slate-600 focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-slate-500 dark:hover:text-slate-300"
                            aria-label="About initial TTIS"
                          >
                            <HelpCircle className="h-3.5 w-3.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs text-xs">
                          Airframe hours at onboarding. This becomes the baseline for TTIS; it must match the
                          persisted total at creation. Default is 0 for a new airframe.
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <Input
                      type="number"
                      step="0.1"
                      min={0}
                      className="h-10 rounded-xl border-slate-200 bg-white px-3 text-base font-medium shadow-none hover:bg-slate-50 focus-visible:ring-0 dark:border-slate-600 dark:bg-slate-900/40"
                      placeholder="0"
                      value={getNumberInputValue(values.initial_total_time_in_service)}
                      onChange={(e) =>
                        update("initial_total_time_in_service", parseNumberInput(e.target.value) ?? 0)
                      }
                    />
                    {errors.initial_total_time_in_service ? (
                      <p className="mt-1 text-[10px] text-destructive">
                        {errors.initial_total_time_in_service}
                      </p>
                    ) : null}
                  </div>

                  <div>
                    <label className="mb-1.5 block text-[9px] font-bold tracking-wider text-slate-400 uppercase">
                      CURRENT HOBBS <span className="text-destructive">*</span>
                    </label>
                    <Input
                      type="number"
                      step="0.1"
                      className="h-10 rounded-xl border-slate-200 bg-white px-3 text-base font-medium shadow-none hover:bg-slate-50 focus-visible:ring-0"
                      placeholder="e.g. 1234.5"
                      value={getNumberInputValue(values.current_hobbs)}
                      onChange={(e) => update("current_hobbs", parseNumberInput(e.target.value) ?? 0)}
                    />
                    {errors.current_hobbs ? (
                      <p className="mt-1 text-[10px] text-destructive">{errors.current_hobbs}</p>
                    ) : null}
                  </div>

                  <div>
                    <label className="mb-1.5 block text-[9px] font-bold tracking-wider text-slate-400 uppercase">
                      CURRENT TACH <span className="text-destructive">*</span>
                    </label>
                    <Input
                      type="number"
                      step="0.1"
                      className="h-10 rounded-xl border-slate-200 bg-white px-3 text-base font-medium shadow-none hover:bg-slate-50 focus-visible:ring-0"
                      placeholder="e.g. 987.6"
                      value={getNumberInputValue(values.current_tach)}
                      onChange={(e) => update("current_tach", parseNumberInput(e.target.value) ?? 0)}
                    />
                    {errors.current_tach ? (
                      <p className="mt-1 text-[10px] text-destructive">{errors.current_tach}</p>
                    ) : null}
                  </div>

                  <div className="sm:col-span-2 rounded-xl border border-slate-200 bg-slate-50/40 p-3.5">
                    <p className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">
                      Time Readings To Track
                    </p>
                    <div className="mt-2.5 grid gap-2.5 sm:grid-cols-3">
                      <div
                        className={cn(
                          "flex items-center gap-2.5 rounded-lg border px-3 py-2.5 transition-colors",
                          values.record_hobbs
                            ? "border-indigo-200 bg-indigo-50/50"
                            : "border-slate-200 bg-white hover:bg-slate-50"
                        )}
                      >
                        <Checkbox
                          id="record_hobbs"
                          className="h-4.5 w-4.5 data-[state=checked]:border-indigo-600 data-[state=checked]:bg-indigo-600"
                          checked={!!values.record_hobbs}
                          onCheckedChange={(v) => update("record_hobbs", !!v)}
                        />
                        <Label htmlFor="record_hobbs" className="cursor-pointer text-sm font-semibold text-slate-900">
                          Record Hobbs
                        </Label>
                      </div>
                      <div
                        className={cn(
                          "flex items-center gap-2.5 rounded-lg border px-3 py-2.5 transition-colors",
                          values.record_tacho
                            ? "border-indigo-200 bg-indigo-50/50"
                            : "border-slate-200 bg-white hover:bg-slate-50"
                        )}
                      >
                        <Checkbox
                          id="record_tacho"
                          className="h-4.5 w-4.5 data-[state=checked]:border-indigo-600 data-[state=checked]:bg-indigo-600"
                          checked={!!values.record_tacho}
                          onCheckedChange={(v) => update("record_tacho", !!v)}
                        />
                        <Label htmlFor="record_tacho" className="cursor-pointer text-sm font-semibold text-slate-900">
                          Record Tacho
                        </Label>
                      </div>
                      <div
                        className={cn(
                          "flex items-center gap-2.5 rounded-lg border px-3 py-2.5 transition-colors",
                          values.record_airswitch
                            ? "border-indigo-200 bg-indigo-50/50"
                            : "border-slate-200 bg-white hover:bg-slate-50"
                        )}
                      >
                        <Checkbox
                          id="record_airswitch"
                          className="h-4.5 w-4.5 data-[state=checked]:border-indigo-600 data-[state=checked]:bg-indigo-600"
                          checked={!!values.record_airswitch}
                          onCheckedChange={(v) => update("record_airswitch", !!v)}
                        />
                        <Label htmlFor="record_airswitch" className="cursor-pointer text-sm font-semibold text-slate-900">
                          Record Airswitch
                        </Label>
                      </div>
                    </div>
                  </div>

                  <div className="sm:col-span-2">
                    <p className="mb-2 text-[10px] font-bold tracking-wider text-slate-500 uppercase">
                      Booking Behaviour
                    </p>
                    <div className="grid gap-2.5 sm:grid-cols-2">
                      <div
                        className={cn(
                          "flex items-start gap-3 rounded-xl border px-3.5 py-3 transition-colors",
                          values.on_line
                            ? "border-slate-300 bg-slate-50"
                            : "border-slate-200 bg-white hover:bg-slate-50"
                        )}
                      >
                        <Checkbox
                          id="on_line"
                          className="mt-0.5 h-4.5 w-4.5 data-[state=checked]:border-indigo-600 data-[state=checked]:bg-indigo-600"
                          checked={!!values.on_line}
                          onCheckedChange={(v) => update("on_line", !!v)}
                        />
                        <div className="min-w-0">
                          <Label htmlFor="on_line" className="cursor-pointer text-sm leading-none font-semibold text-slate-900">
                            Available for bookings
                          </Label>
                          <p className="mt-1 text-xs leading-snug text-slate-600">
                            Allow this aircraft to be booked.
                          </p>
                        </div>
                      </div>

                      <div
                        className={cn(
                          "flex items-start gap-3 rounded-xl border px-3.5 py-3 transition-colors",
                          values.prioritise_scheduling
                            ? "border-slate-300 bg-slate-50"
                            : "border-slate-200 bg-white hover:bg-slate-50"
                        )}
                      >
                        <Checkbox
                          id="prioritise_scheduling"
                          className="mt-0.5 h-4.5 w-4.5 data-[state=checked]:border-indigo-600 data-[state=checked]:bg-indigo-600"
                          checked={!!values.prioritise_scheduling}
                          onCheckedChange={(v) => update("prioritise_scheduling", !!v)}
                        />
                        <div className="min-w-0">
                          <Label
                            htmlFor="prioritise_scheduling"
                            className="cursor-pointer text-sm leading-none font-semibold text-slate-900"
                          >
                            Prioritise scheduling
                          </Label>
                          <p className="mt-1 text-xs leading-snug text-slate-600">
                            Prefer this aircraft during scheduling.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            </div>
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
                type="button"
                disabled={submitting}
                onClick={() => void submit()}
                className="h-10 flex-[1.4] rounded-xl bg-slate-900 text-xs font-bold text-white shadow-lg shadow-slate-900/10 hover:bg-slate-800"
              >
                {submitting ? "Saving..." : "Save Aircraft"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    <AddTypeDialog open={isAddTypeDialogOpen} onOpenChange={setIsAddTypeDialogOpen}>
      <AddTypeDialogContent>
        <AddTypeDialogHeader>
          <AddTypeDialogTitle>Add aircraft type</AddTypeDialogTitle>
          <AddTypeDialogDescription>Create a new aircraft type for this organisation.</AddTypeDialogDescription>
        </AddTypeDialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label className="mb-1 block text-sm font-medium">Name *</Label>
            <Input value={newTypeName} onChange={(e) => setNewTypeName(e.target.value)} />
          </div>
          <div>
            <Label className="mb-1 block text-sm font-medium">Category</Label>
            <Input value={newTypeCategory} onChange={(e) => setNewTypeCategory(e.target.value)} />
          </div>
          <div>
            <Label className="mb-1 block text-sm font-medium">Description</Label>
            <Input value={newTypeDescription} onChange={(e) => setNewTypeDescription(e.target.value)} />
          </div>
        </div>
        <AddTypeDialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsAddTypeDialogOpen(false)}
            disabled={isCreatingType}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void handleCreateAircraftType()}
            disabled={isCreatingType || !newTypeName.trim()}
          >
            {isCreatingType ? "Creating..." : "Create"}
          </Button>
        </AddTypeDialogFooter>
      </AddTypeDialogContent>
    </AddTypeDialog>
    </TooltipProvider>
  )
}
