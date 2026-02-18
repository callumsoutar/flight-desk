"use client"

import * as React from "react"
import {
  IconCurrencyDollar,
  IconDeviceFloppy,
  IconInfoCircle,
  IconPlus,
  IconRotateClockwise,
  IconSettings,
} from "@tabler/icons-react"
import { toast } from "sonner"

import { useIsMobile } from "@/hooks/use-mobile"
import type { AircraftType, AircraftWithType } from "@/lib/types/aircraft"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import AircraftChargeRatesTable from "@/components/aircraft/aircraft-charge-rates-table"

type Props = {
  aircraft: AircraftWithType
  aircraftId: string
}

type AircraftFormState = {
  manufacturer: string
  type: string
  model: string
  year_manufactured: string
  registration: string
  status: string
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
    status: aircraft.status ?? "active",
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

export function AircraftSettingsTab({ aircraft, aircraftId }: Props) {
  const [formState, setFormState] = React.useState<AircraftFormState>(() => toFormState(aircraft))
  const [isSaving, setIsSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [aircraftTypes, setAircraftTypes] = React.useState<AircraftType[]>([])
  const [isAddTypeDialogOpen, setIsAddTypeDialogOpen] = React.useState(false)
  const [newTypeName, setNewTypeName] = React.useState("")
  const [newTypeCategory, setNewTypeCategory] = React.useState("")
  const [newTypeDescription, setNewTypeDescription] = React.useState("")
  const [isCreatingType, setIsCreatingType] = React.useState(false)
  const isMobile = useIsMobile()

  const [sidebarLeft, setSidebarLeft] = React.useState(0)

  React.useEffect(() => {
    const initial = toFormState(aircraft)
    setFormState(initial)
  }, [aircraft])

  const initialStateRef = React.useRef<AircraftFormState>(toFormState(aircraft))
  React.useEffect(() => {
    initialStateRef.current = toFormState(aircraft)
  }, [aircraft])

  React.useEffect(() => {
    const loadAircraftTypes = async () => {
      try {
        const res = await fetch("/api/aircraft-types", { cache: "no-store" })
        if (!res.ok) throw new Error("Failed to fetch")
        const payload = (await res.json()) as { aircraft_types?: AircraftType[] }
        setAircraftTypes(payload.aircraft_types ?? [])
      } catch {
        toast.error("Failed to load aircraft types")
      }
    }
    void loadAircraftTypes()
  }, [])

  React.useEffect(() => {
    if (isMobile) {
      setSidebarLeft(0)
      return
    }

    const updateSidebarPosition = () => {
      const sidebarGap = document.querySelector('[data-slot="sidebar-gap"]')
      if (sidebarGap) {
        const computedWidth = window.getComputedStyle(sidebarGap).width
        const width = Number.parseFloat(computedWidth) || 0
        setSidebarLeft(width)
        return
      }
      setSidebarLeft(0)
    }

    updateSidebarPosition()
    window.addEventListener("resize", updateSidebarPosition)
    return () => window.removeEventListener("resize", updateSidebarPosition)
  }, [isMobile])

  const isDirty = React.useMemo(() => {
    return JSON.stringify(formState) !== JSON.stringify(initialStateRef.current)
  }, [formState])

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
      const res = await fetch("/api/aircraft-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newTypeName.trim(),
          category: newTypeCategory.trim() || null,
          description: newTypeDescription.trim() || null,
        }),
      })
      const result = (await res.json()) as { error?: string; aircraft_type?: AircraftType }
      if (!res.ok || result.error || !result.aircraft_type) {
        toast.error(result.error || "Failed to create aircraft type")
        return
      }

      setAircraftTypes((prev) => [...prev, result.aircraft_type!].sort((a, b) => a.name.localeCompare(b.name)))
      updateField("aircraft_type_id", result.aircraft_type.id)
      setIsAddTypeDialogOpen(false)
      setNewTypeName("")
      setNewTypeCategory("")
      setNewTypeDescription("")
      toast.success("Aircraft type created")
    } catch {
      toast.error("Failed to create aircraft type")
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
        status: formState.status.trim() || null,
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

      const res = await fetch(`/api/aircraft/${aircraftId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const result = (await res.json()) as { error?: string }

      if (!res.ok || result.error) {
        const message = result.error || "Failed to update aircraft"
        setError(message)
        toast.error(message)
        return
      }

      initialStateRef.current = formState
      toast.success("Aircraft details saved")
      window.location.reload()
    } catch {
      setError("Failed to update aircraft")
      toast.error("Failed to update aircraft")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <>
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Aircraft Information</h3>
      </div>

      <Card className="mb-8 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-8">
        <h4 className="mb-6 flex items-center gap-2 border-b pb-2 text-base font-semibold tracking-tight text-gray-900">
          <IconInfoCircle className="h-5 w-5 text-indigo-500" />
          General Info
        </h4>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <Label className="mb-1 block text-sm font-medium text-gray-800">Manufacturer</Label>
            <Input value={formState.manufacturer} onChange={(e) => updateField("manufacturer", e.target.value)} />
          </div>
          <div>
            <Label className="mb-1 block text-sm font-medium text-gray-800">Aircraft Type</Label>
            <Select
              value={formState.aircraft_type_id || undefined}
              onValueChange={(v) => updateField("aircraft_type_id", v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select aircraft type..." />
              </SelectTrigger>
              <SelectContent>
                {aircraftTypes.map((type) => (
                  <SelectItem key={type.id} value={type.id}>
                    {type.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-1 pl-0 text-indigo-600 hover:bg-transparent hover:text-indigo-700"
              onClick={() => setIsAddTypeDialogOpen(true)}
            >
              <IconPlus className="mr-1 h-4 w-4" />
              Add Aircraft Type
            </Button>
          </div>
          <div>
            <Label className="mb-1 block text-sm font-medium text-gray-800">Model</Label>
            <Input value={formState.model} onChange={(e) => updateField("model", e.target.value)} />
          </div>
          <div>
            <Label className="mb-1 block text-sm font-medium text-gray-800">Year Manufactured</Label>
            <Input
              type="number"
              value={formState.year_manufactured}
              onChange={(e) => updateField("year_manufactured", e.target.value)}
            />
          </div>
          <div>
            <Label className="mb-1 block text-sm font-medium text-gray-800">Registration</Label>
            <Input
              value={formState.registration}
              onChange={(e) => updateField("registration", e.target.value)}
            />
          </div>
          <div>
            <Label className="mb-1 block text-sm font-medium text-gray-800">Capacity</Label>
            <Input
              type="number"
              value={formState.capacity}
              onChange={(e) => updateField("capacity", e.target.value)}
            />
          </div>
          <div>
            <Label className="mb-1 block text-sm font-medium text-gray-800">Fuel Consumption (L/hr)</Label>
            <Input
              type="number"
              step="0.1"
              value={formState.fuel_consumption}
              onChange={(e) => updateField("fuel_consumption", e.target.value)}
            />
          </div>
          <div>
            <Label className="mb-1 block text-sm font-medium text-gray-800">Total Time Method</Label>
            <Select
              value={formState.total_time_method || undefined}
              onValueChange={(v) => updateField("total_time_method", v)}
            >
              <SelectTrigger className="w-full">
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
          </div>
        </div>

        <div className="my-8 border-t border-gray-200" />

        <div>
          <h4 className="mb-6 flex items-center gap-2 text-base font-semibold tracking-tight text-gray-900">
            <IconSettings className="h-5 w-5 text-indigo-500" />
            Operational
          </h4>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label className="mb-1 block text-sm font-medium text-gray-800">
                Total Time in Service (TTIS)
              </Label>
              <Input
                type="number"
                step="0.1"
                value={aircraft.total_time_in_service?.toFixed(1) || "0.0"}
                disabled
                className="cursor-not-allowed bg-gray-50"
              />
              <p className="mt-1 text-xs text-gray-500">Updated automatically via flight check-ins</p>
            </div>
            <div>
              <Label className="mb-1 block text-sm font-medium text-gray-800">Current Tach</Label>
              <Input
                type="number"
                step="0.1"
                value={formState.current_tach}
                onChange={(e) => updateField("current_tach", e.target.value)}
              />
            </div>
            <div>
              <Label className="mb-1 block text-sm font-medium text-gray-800">Current Hobbs</Label>
              <Input
                type="number"
                step="0.1"
                value={formState.current_hobbs}
                onChange={(e) => updateField("current_hobbs", e.target.value)}
              />
            </div>
            <div>
              <Label className="mb-1 block text-sm font-medium text-gray-800">Status</Label>
              <Input value={formState.status} onChange={(e) => updateField("status", e.target.value)} />
            </div>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="flex items-start gap-3 rounded-xl border border-gray-200 bg-gray-50/60 p-4">
            <Checkbox
              id="on_line"
              className="mt-0.5"
              checked={formState.on_line}
              onCheckedChange={(checked) => updateField("on_line", Boolean(checked))}
            />
            <div>
              <Label htmlFor="on_line" className="text-sm font-medium text-gray-900">
                Available for Bookings
              </Label>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-xl border border-gray-200 bg-gray-50/60 p-4">
            <Checkbox
              id="prioritise_scheduling"
              className="mt-0.5"
              checked={formState.prioritise_scheduling}
              onCheckedChange={(checked) =>
                updateField("prioritise_scheduling", Boolean(checked))
              }
            />
            <div>
              <Label htmlFor="prioritise_scheduling" className="text-sm font-medium text-gray-900">
                Prioritise Scheduling
              </Label>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-xl border border-gray-200 bg-gray-50/60 p-4">
            <Checkbox
              id="record_tacho"
              className="mt-0.5"
              checked={formState.record_tacho}
              onCheckedChange={(checked) => updateField("record_tacho", Boolean(checked))}
            />
            <div>
              <Label htmlFor="record_tacho" className="text-sm font-medium text-gray-900">
                Record Tacho
              </Label>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-xl border border-gray-200 bg-gray-50/60 p-4">
            <Checkbox
              id="record_hobbs"
              className="mt-0.5"
              checked={formState.record_hobbs}
              onCheckedChange={(checked) => updateField("record_hobbs", Boolean(checked))}
            />
            <div>
              <Label htmlFor="record_hobbs" className="text-sm font-medium text-gray-900">
                Record Hobbs
              </Label>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-xl border border-gray-200 bg-gray-50/60 p-4">
            <Checkbox
              id="record_airswitch"
              className="mt-0.5"
              checked={formState.record_airswitch}
              onCheckedChange={(checked) => updateField("record_airswitch", Boolean(checked))}
            />
            <div>
              <Label htmlFor="record_airswitch" className="text-sm font-medium text-gray-900">
                Record Airswitch
              </Label>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-xl border border-gray-200 bg-gray-50/60 p-4">
            <Checkbox
              id="for_ato"
              className="mt-0.5"
              checked={formState.for_ato}
              onCheckedChange={(checked) => updateField("for_ato", Boolean(checked))}
            />
            <div>
              <Label htmlFor="for_ato" className="text-sm font-medium text-gray-900">
                For ATO
              </Label>
            </div>
          </div>
        </div>
      </Card>

      <Card className="mb-8 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-8">
        <h4 className="mb-6 flex items-center gap-2 border-b pb-2 text-base font-semibold tracking-tight text-gray-900">
          <IconCurrencyDollar className="h-5 w-5 text-indigo-500" />
          Charge Rates
        </h4>
        <AircraftChargeRatesTable aircraftId={aircraftId} />
      </Card>

      {error ? <p className="mt-2 text-xs text-red-500">{error}</p> : null}
      {isDirty ? <div className="h-24" /> : null}

      {isDirty ? (
        <div
          className="fixed right-0 bottom-0 z-50 border-t border-gray-200 bg-white shadow-xl"
          style={{ left: isMobile ? 0 : `${sidebarLeft}px` }}
        >
          <div className="mx-auto flex max-w-7xl items-center justify-end gap-4 px-4 py-4 sm:px-6 lg:px-8">
            <Button
              variant="outline"
              size="lg"
              onClick={handleUndo}
              disabled={isSaving}
              className={isMobile ? "h-12 max-w-[200px] flex-1" : "h-12 min-w-[160px] px-8"}
            >
              <IconRotateClockwise className="mr-2 h-4 w-4" />
              Undo Changes
            </Button>
            <Button
              size="lg"
              onClick={handleSave}
              disabled={isSaving}
              className={isMobile ? "h-12 max-w-[200px] flex-1" : "h-12 min-w-[160px] px-8"}
            >
              <IconDeviceFloppy className="mr-2 h-4 w-4" />
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      ) : null}

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
