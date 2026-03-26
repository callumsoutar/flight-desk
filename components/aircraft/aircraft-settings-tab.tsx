"use client"

import * as React from "react"
import {
  IconCurrencyDollar,
  IconEngine,
  IconInfoCircle,
  IconPlus,
  IconSettings,
} from "@tabler/icons-react"
import { toast } from "sonner"

import type { AircraftType, AircraftWithType } from "@/lib/types/aircraft"
import { updateAircraft } from "@/hooks/use-aircraft-query"
import { createAircraftType, useAircraftTypesCache, useAircraftTypesQuery } from "@/hooks/use-aircraft-types-query"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { StickyFormActions } from "@/components/ui/sticky-form-actions"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import AircraftChargeRatesTable from "@/components/aircraft/aircraft-charge-rates-table"
import { cn } from "@/lib/utils"

type Props = {
  aircraft: AircraftWithType
  aircraftId: string
  onSaved?: (aircraft: AircraftWithType) => void
}

type AircraftFormState = {
  manufacturer: string
  type: string
  model: string
  year_manufactured: string
  registration: string
  capacity: string
  on_line: boolean
  for_ato: boolean
  prioritise_scheduling: boolean
  aircraft_image_url: string
  current_tach: string
  current_hobbs: string
  record_tacho: boolean
  record_hobbs: boolean
  record_airswitch: boolean
  fuel_consumption: string
  total_time_method: string
  aircraft_type_id: string
}

const totalTimeMethods = [
  "airswitch",
  "hobbs",
  "hobbs less 5%",
  "hobbs less 10%",
  "tacho",
  "tacho less 5%",
  "tacho less 10%",
] as const

function toFormState(aircraft: AircraftWithType): AircraftFormState {
  return {
    manufacturer: aircraft.manufacturer ?? "",
    type: aircraft.type ?? "",
    model: aircraft.model ?? "",
    year_manufactured: aircraft.year_manufactured?.toString() ?? "",
    registration: aircraft.registration ?? "",
    capacity: aircraft.capacity?.toString() ?? "",
    on_line: aircraft.on_line ?? true,
    for_ato: aircraft.for_ato ?? false,
    prioritise_scheduling: aircraft.prioritise_scheduling ?? false,
    aircraft_image_url: aircraft.aircraft_image_url ?? "",
    current_tach: aircraft.current_tach?.toString() ?? "",
    current_hobbs: aircraft.current_hobbs?.toString() ?? "",
    record_tacho: aircraft.record_tacho ?? false,
    record_hobbs: aircraft.record_hobbs ?? false,
    record_airswitch: aircraft.record_airswitch ?? false,
    fuel_consumption: aircraft.fuel_consumption?.toString() ?? "",
    total_time_method: aircraft.total_time_method ?? "",
    aircraft_type_id: aircraft.aircraft_type_id ?? "",
  }
}

function parseNumber(value: string): number | null {
  if (!value.trim()) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function FieldGroup({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string
  description?: string
  icon: React.ComponentType<{ className?: string }>
  children: React.ReactNode
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-100 text-slate-600">
          <Icon className="h-4 w-4" />
        </div>
        <div className="space-y-1">
          <h4 className="text-sm font-semibold tracking-tight text-slate-950">{title}</h4>
          {description ? <p className="text-sm leading-5 text-slate-500">{description}</p> : null}
        </div>
      </div>
      {children}
    </section>
  )
}

function LabeledField({
  label,
  required = false,
  children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-semibold text-slate-800">
        {label}
        {required ? <span className="ml-1 text-rose-500">*</span> : null}
      </Label>
      {children}
    </div>
  )
}

function ToggleRow({
  id,
  label,
  description,
  checked,
  onCheckedChange,
  accentClassName,
  compact = false,
}: {
  id: string
  label: string
  description?: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  accentClassName?: string
  compact?: boolean
}) {
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex cursor-pointer justify-between rounded-lg transition-colors hover:bg-slate-50",
        compact ? "items-center gap-3 px-2 py-2" : "items-start gap-4 px-3 py-3",
        checked && "bg-slate-50",
        accentClassName
      )}
    >
      <div className={cn("pr-2", description ? "space-y-1" : "space-y-0")}>
        <p className="text-sm font-semibold text-slate-900">{label}</p>
        {description ? <p className="text-sm leading-5 text-slate-500">{description}</p> : null}
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} className={compact ? "" : "mt-0.5"} />
    </label>
  )
}

export function AircraftSettingsTab({ aircraft, aircraftId, onSaved }: Props) {
  const [formState, setFormState] = React.useState<AircraftFormState>(() => toFormState(aircraft))
  const [isSaving, setIsSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [isAddTypeDialogOpen, setIsAddTypeDialogOpen] = React.useState(false)
  const [isAircraftTypeSelectOpen, setIsAircraftTypeSelectOpen] = React.useState(false)
  const [newTypeName, setNewTypeName] = React.useState("")
  const [newTypeCategory, setNewTypeCategory] = React.useState("")
  const [newTypeDescription, setNewTypeDescription] = React.useState("")
  const [isCreatingType, setIsCreatingType] = React.useState(false)
  const {
    data: aircraftTypes = [],
    isLoading: isLoadingAircraftTypes,
    error: aircraftTypesError,
  } = useAircraftTypesQuery()
  const { mergeAircraftType } = useAircraftTypesCache()

  React.useEffect(() => {
    const initial = toFormState(aircraft)
    setFormState(initial)
  }, [aircraft])

  const initialStateRef = React.useRef<AircraftFormState>(toFormState(aircraft))
  React.useEffect(() => {
    initialStateRef.current = toFormState(aircraft)
  }, [aircraft])

  React.useEffect(() => {
    if (!aircraftTypesError) return
    toast.error("Failed to load aircraft types")
  }, [aircraftTypesError])

  const isDirty = React.useMemo(() => {
    return JSON.stringify(formState) !== JSON.stringify(initialStateRef.current)
  }, [formState])

  const selectedAircraftTypeLabel = React.useMemo(() => {
    if (!formState.aircraft_type_id) return ""

    return (
      aircraftTypes.find((type) => type.id === formState.aircraft_type_id)?.name ??
      (aircraft.aircraft_type?.id === formState.aircraft_type_id ? aircraft.aircraft_type.name : "") ??
      ""
    )
  }, [aircraft.aircraft_type, aircraftTypes, formState.aircraft_type_id])

  const updateField = <K extends keyof AircraftFormState>(key: K, value: AircraftFormState[K]) => {
    setFormState((prev) => ({ ...prev, [key]: value }))
  }

  const handleCreateAircraftType = async () => {
    if (!newTypeName.trim()) {
      toast.error("Aircraft type name is required")
      return
    }

    setIsCreatingType(true)
    try {
      const aircraftType: AircraftType = await createAircraftType({
        name: newTypeName.trim(),
        category: newTypeCategory.trim() || null,
        description: newTypeDescription.trim() || null,
      })
      mergeAircraftType(aircraftType)
      updateField("aircraft_type_id", aircraftType.id)
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

  const handleUndo = () => {
    setFormState(initialStateRef.current)
    setError(null)
  }

  const handleSave = async () => {
    if (!formState.registration.trim()) {
      setError("Registration is required")
      toast.error("Registration is required")
      return
    }

    const year = parseNumber(formState.year_manufactured)
    if (year !== null && (!Number.isInteger(year) || year < 1900 || year > 2100)) {
      setError("Year manufactured must be between 1900 and 2100")
      toast.error("Year manufactured must be between 1900 and 2100")
      return
    }

    setIsSaving(true)
    setError(null)
    try {
      const payload = {
        manufacturer: formState.manufacturer.trim() || null,
        type: formState.type.trim() || null,
        model: formState.model.trim() || null,
        year_manufactured: year,
        registration: formState.registration.trim(),
        capacity: parseNumber(formState.capacity),
        on_line: formState.on_line,
        for_ato: formState.for_ato,
        prioritise_scheduling: formState.prioritise_scheduling,
        aircraft_image_url: formState.aircraft_image_url.trim() || null,
        current_tach: parseNumber(formState.current_tach),
        current_hobbs: parseNumber(formState.current_hobbs),
        record_tacho: formState.record_tacho,
        record_hobbs: formState.record_hobbs,
        record_airswitch: formState.record_airswitch,
        fuel_consumption: parseNumber(formState.fuel_consumption),
        total_time_method: formState.total_time_method || null,
        aircraft_type_id: formState.aircraft_type_id || null,
      }

      const updatedAircraft = await updateAircraft(aircraftId, payload)
      const nextState = toFormState(updatedAircraft)
      setFormState(nextState)
      initialStateRef.current = nextState
      onSaved?.(updatedAircraft)
      toast.success("Aircraft details saved")
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update aircraft"
      setError(message)
      toast.error(message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <>
      <div className="mb-6 space-y-1">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold tracking-tight text-slate-950">Aircraft settings</h3>
          <p className="max-w-2xl text-sm leading-6 text-slate-600">
            Update the core details, time tracking setup, and booking behaviour for this aircraft.
          </p>
        </div>
      </div>

      <div className="mb-8 border-t border-slate-200 pt-6">
        <div className="space-y-8">
          <FieldGroup
            title="Aircraft identity"
            description="Basic details used throughout the system, including registration, classification, and fuel profile."
            icon={IconInfoCircle}
          >
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
              <LabeledField label="Registration" required>
                <Input
                  value={formState.registration}
                  onChange={(e) => updateField("registration", e.target.value)}
                  className="border-slate-200 bg-white"
                />
              </LabeledField>

              <LabeledField label="Aircraft type">
                <Select
                  open={isAircraftTypeSelectOpen}
                  onOpenChange={setIsAircraftTypeSelectOpen}
                  value={formState.aircraft_type_id || undefined}
                  onValueChange={(v) => updateField("aircraft_type_id", v)}
                >
                  <SelectTrigger className="w-full border-slate-200 bg-white">
                    <SelectValue placeholder={isLoadingAircraftTypes ? "Loading aircraft types..." : "Select aircraft type..."}>
                      {selectedAircraftTypeLabel || undefined}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {isLoadingAircraftTypes ? (
                      <div className="px-2 py-2 text-sm text-slate-500">Loading aircraft types...</div>
                    ) : null}
                    {aircraftTypes.map((type) => (
                      <SelectItem key={type.id} value={type.id}>
                        {type.name}
                      </SelectItem>
                    ))}
                    <SelectSeparator />
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded-sm px-2 py-2 text-sm font-medium text-indigo-600 outline-none transition-colors hover:bg-slate-50"
                      onPointerDown={(event) => {
                        event.preventDefault()
                        setIsAircraftTypeSelectOpen(false)
                        setIsAddTypeDialogOpen(true)
                      }}
                    >
                      <IconPlus className="h-4 w-4" />
                      Add aircraft type
                    </button>
                  </SelectContent>
                </Select>
              </LabeledField>

              <LabeledField label="Manufacturer">
                <Input
                  value={formState.manufacturer}
                  onChange={(e) => updateField("manufacturer", e.target.value)}
                  className="border-slate-200 bg-white"
                />
              </LabeledField>

              <LabeledField label="Model">
                <Input
                  value={formState.model}
                  onChange={(e) => updateField("model", e.target.value)}
                  className="border-slate-200 bg-white"
                />
              </LabeledField>

              <LabeledField label="Year manufactured">
                <Input
                  type="number"
                  value={formState.year_manufactured}
                  onChange={(e) => updateField("year_manufactured", e.target.value)}
                  className="border-slate-200 bg-white"
                />
              </LabeledField>

              <LabeledField label="Capacity">
                <Input
                  type="number"
                  value={formState.capacity}
                  onChange={(e) => updateField("capacity", e.target.value)}
                  className="border-slate-200 bg-white"
                />
              </LabeledField>

              <LabeledField label="Fuel consumption">
                <Input
                  type="number"
                  step="0.1"
                  value={formState.fuel_consumption}
                  onChange={(e) => updateField("fuel_consumption", e.target.value)}
                  className="border-slate-200 bg-white"
                />
              </LabeledField>
            </div>
          </FieldGroup>

          <div className="border-t border-slate-200" />

          <FieldGroup
            title="Time tracking"
            icon={IconEngine}
          >
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Totals setup</p>
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                  <LabeledField label="Total Time in Service (TTIS)">
                    <Input
                      type="number"
                      step="0.1"
                      value={aircraft.total_time_in_service?.toFixed(1) || "0.0"}
                      disabled
                      className="cursor-not-allowed border-slate-200 bg-slate-100 text-slate-500"
                    />
                  </LabeledField>

                  <LabeledField label="Total time method">
                    <Select
                      value={formState.total_time_method || undefined}
                      onValueChange={(v) => updateField("total_time_method", v)}
                    >
                      <SelectTrigger className="w-full border-slate-200 bg-white">
                        <SelectValue placeholder="Select a method..." />
                      </SelectTrigger>
                      <SelectContent>
                        {totalTimeMethods.map((method) => (
                          <SelectItem key={method} value={method}>
                            {method}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </LabeledField>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Current readings</p>
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                  <LabeledField label="Current tach">
                    <Input
                      type="number"
                      step="0.1"
                      value={formState.current_tach}
                      onChange={(e) => updateField("current_tach", e.target.value)}
                      className="border-slate-200 bg-white"
                    />
                  </LabeledField>

                  <LabeledField label="Current Hobbs">
                    <Input
                      type="number"
                      step="0.1"
                      value={formState.current_hobbs}
                      onChange={(e) => updateField("current_hobbs", e.target.value)}
                      className="border-slate-200 bg-white"
                    />
                  </LabeledField>
                </div>
              </div>
            </div>
          </FieldGroup>

          <div className="border-t border-slate-200" />

          <FieldGroup
            title="Operational preferences"
            icon={IconSettings}
          >
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Booking and scheduling
                </p>
                <div className="grid grid-cols-1 gap-x-6 gap-y-1 xl:grid-cols-2">
                  <ToggleRow
                    id="on_line"
                    label="Available for bookings"
                    description="Show this aircraft in booking workflows and allow it to be assigned to new bookings."
                    checked={formState.on_line}
                    onCheckedChange={(checked) => updateField("on_line", checked)}
                  />
                  <ToggleRow
                    id="prioritise_scheduling"
                    label="Prioritise scheduling"
                    description="Prefer this aircraft when scheduling options are being compared or surfaced first."
                    checked={formState.prioritise_scheduling}
                    onCheckedChange={(checked) => updateField("prioritise_scheduling", checked)}
                  />
                </div>
              </div>

              <div className="border-t border-slate-200" />

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Operations and tracking
                </p>
                <div className="grid grid-cols-1 gap-x-6 gap-y-1 xl:grid-cols-2">
                  <ToggleRow
                    id="for_ato"
                    label="Used for ATO"
                    checked={formState.for_ato}
                    onCheckedChange={(checked) => updateField("for_ato", checked)}
                    compact
                  />
                  <ToggleRow
                    id="record_tacho"
                    label="Record tach"
                    checked={formState.record_tacho}
                    onCheckedChange={(checked) => updateField("record_tacho", checked)}
                    compact
                  />
                  <ToggleRow
                    id="record_hobbs"
                    label="Record Hobbs"
                    checked={formState.record_hobbs}
                    onCheckedChange={(checked) => updateField("record_hobbs", checked)}
                    compact
                  />
                  <ToggleRow
                    id="record_airswitch"
                    label="Record airswitch"
                    checked={formState.record_airswitch}
                    onCheckedChange={(checked) => updateField("record_airswitch", checked)}
                    compact
                  />
                </div>
              </div>
            </div>
          </FieldGroup>

          <div className="border-t border-slate-200" />

          <FieldGroup
            title="Charge rates"
            description="Maintain aircraft-specific rates without leaving the aircraft settings tab."
            icon={IconCurrencyDollar}
          >
            <AircraftChargeRatesTable aircraftId={aircraftId} />
          </FieldGroup>
        </div>
      </div>

      {error ? <p className="mt-2 text-xs text-red-500">{error}</p> : null}
      {isDirty ? <div className="h-24" /> : null}

      <StickyFormActions
        isDirty={isDirty}
        isSaving={isSaving}
        onUndo={handleUndo}
        onSave={handleSave}
        message="You have unsaved aircraft details."
        undoLabel="Undo Changes"
        saveLabel="Save Changes"
      />

      <Dialog open={isAddTypeDialogOpen} onOpenChange={setIsAddTypeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Aircraft Type</DialogTitle>
            <DialogDescription>Create a new aircraft type for this tenant.</DialogDescription>
          </DialogHeader>
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
              <Input
                value={newTypeDescription}
                onChange={(e) => setNewTypeDescription(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
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
              onClick={handleCreateAircraftType}
              disabled={isCreatingType || !newTypeName.trim()}
            >
              {isCreatingType ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
