"use client"

import * as React from "react"
import { toast } from "sonner"
import { IconClipboard, IconPlus } from "@tabler/icons-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { AircraftWithType } from "@/lib/types/aircraft"
import type { AircraftComponentsRow } from "@/lib/types/tables"
import { cn } from "@/lib/utils"
import ComponentEditModal from "@/components/aircraft/component-edit-modal"
import ComponentNewModal from "@/components/aircraft/component-new-modal"
import LogMaintenanceModal from "@/components/aircraft/log-maintenance-modal"

type Props = {
  components: AircraftComponentsRow[]
  aircraft: AircraftWithType
}

type ComponentWithComputed = AircraftComponentsRow & {
  _computed: {
    extendedHours: number | null
    extendedDate: Date | null
    effectiveDueHours: number | null
    effectiveDueDate: Date | null
    dueScore: number
    dueIn: string
  }
}

function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return "—"
  const parsed = new Date(dateString)
  if (Number.isNaN(parsed.getTime())) return "—"
  return parsed.toLocaleDateString("en-NZ", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

function getExtendedDueHours(component: AircraftComponentsRow): number | null {
  if (
    component.extension_limit_hours === null ||
    component.extension_limit_hours === undefined ||
    component.current_due_hours === null ||
    component.current_due_hours === undefined ||
    component.interval_hours === null ||
    component.interval_hours === undefined
  ) {
    return null
  }

  const currentDueHours = Number(component.current_due_hours)
  const intervalHours = Number(component.interval_hours)
  const extensionPercent = Number(component.extension_limit_hours)

  return currentDueHours + intervalHours * (extensionPercent / 100)
}

function getExtendedDueDate(component: AircraftComponentsRow): Date | null {
  if (
    component.extension_limit_hours === null ||
    component.extension_limit_hours === undefined ||
    !component.current_due_date ||
    component.interval_days === null ||
    component.interval_days === undefined
  ) {
    return null
  }

  const baseDate = new Date(component.current_due_date)
  const intervalDays = Number(component.interval_days)
  const extensionPercent = Number(component.extension_limit_hours)
  const extensionDays = intervalDays * (extensionPercent / 100)

  return new Date(baseDate.getTime() + extensionDays * 24 * 60 * 60 * 1000)
}

function getDueIn(component: AircraftComponentsRow, currentHours: number | null, nowTime: number) {
  if (currentHours === null) return "N/A"

  const extendedHours = getExtendedDueHours(component)
  const extendedDate = getExtendedDueDate(component)

  if (component.current_due_hours !== null && component.current_due_hours !== undefined) {
    const effectiveHours = extendedHours ?? Number(component.current_due_hours)
    const hoursLeft = effectiveHours - currentHours
    if (hoursLeft <= 0) return "Overdue"
    return `${Number(hoursLeft.toFixed(1))}h`
  }

  if (component.current_due_date) {
    const due = (extendedDate ?? new Date(component.current_due_date)).getTime()
    const daysLeft = Math.ceil((due - nowTime) / (1000 * 60 * 60 * 24))
    if (daysLeft <= 0) return "Overdue"
    return `${daysLeft} days`
  }

  return "N/A"
}

function getComponentStatus(component: ComponentWithComputed, currentHours: number | null) {
  const { extendedHours, extendedDate, effectiveDueHours, effectiveDueDate } = component._computed
  const now = new Date()

  const baseDueDate = component.current_due_date ? new Date(component.current_due_date) : null
  const baseDueHours =
    component.current_due_hours !== null && component.current_due_hours !== undefined
      ? Number(component.current_due_hours)
      : null

  const isOverdueHours =
    typeof effectiveDueHours === "number" && currentHours !== null && effectiveDueHours - currentHours <= 0
  const isOverdueDate = effectiveDueDate !== null && effectiveDueDate.getTime() <= now.getTime()

  if (isOverdueHours || isOverdueDate) return "Overdue"

  const isInExtensionHours =
    baseDueHours !== null &&
    currentHours !== null &&
    currentHours > baseDueHours &&
    extendedHours !== null &&
    currentHours <= extendedHours
  const isInExtensionDate =
    baseDueDate !== null &&
    now.getTime() > baseDueDate.getTime() &&
    extendedDate !== null &&
    now.getTime() <= extendedDate.getTime()

  if (isInExtensionHours || isInExtensionDate) return "Within Extension"

  const isSoonHours =
    baseDueHours !== null && currentHours !== null && baseDueHours - currentHours <= 10
  const isSoonDate =
    baseDueDate !== null &&
    (baseDueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24) <= 30

  if (isSoonHours || isSoonDate) return "Due Soon"

  return "Upcoming"
}

export function AircraftMaintenanceItemsTab({ components, aircraft }: Props) {
  const [rows, setRows] = React.useState<AircraftComponentsRow[]>(components)
  const [selectedComponent, setSelectedComponent] = React.useState<AircraftComponentsRow | null>(null)
  const [modalOpen, setModalOpen] = React.useState(false)
  const [newModalOpen, setNewModalOpen] = React.useState(false)
  const [logModalOpen, setLogModalOpen] = React.useState(false)
  const [logComponentId, setLogComponentId] = React.useState<string | null>(null)
  const [nowTime, setNowTime] = React.useState(0)

  React.useEffect(() => {
    setNowTime(Date.now())
  }, [rows])

  const currentHours =
    aircraft.total_time_in_service === null || aircraft.total_time_in_service === undefined
      ? null
      : Number(aircraft.total_time_in_service)

  const sortedComponents = React.useMemo<ComponentWithComputed[]>(() => {
    return rows
      .map((component) => {
        const extendedHours = getExtendedDueHours(component)
        const extendedDate = getExtendedDueDate(component)
        const effectiveDueHours =
          extendedHours ?? (component.current_due_hours === null ? null : Number(component.current_due_hours))
        const effectiveDueDate = extendedDate ?? (component.current_due_date ? new Date(component.current_due_date) : null)

        let dueScore = Number.POSITIVE_INFINITY
        if (effectiveDueHours !== null && currentHours !== null) {
          dueScore = effectiveDueHours - currentHours
        } else if (effectiveDueDate) {
          dueScore = effectiveDueDate.getTime() - nowTime
        }

        return {
          ...component,
          _computed: {
            extendedHours,
            extendedDate,
            effectiveDueHours,
            effectiveDueDate,
            dueScore,
            dueIn: getDueIn(component, currentHours, nowTime),
          },
        }
      })
      .sort((a, b) => a._computed.dueScore - b._computed.dueScore)
  }, [rows, currentHours, nowTime])

  const openEditor = (component: AircraftComponentsRow) => {
    setSelectedComponent(component)
    setModalOpen(true)
  }

  const handleSave = async (updates: Partial<AircraftComponentsRow>) => {
    if (!selectedComponent) return
    const response = await fetch("/api/aircraft-components", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: selectedComponent.id, ...updates }),
    })

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}))
      const message =
        typeof payload.error === "string" ? payload.error : "Failed to update maintenance item"
      toast.error(message)
      throw new Error(message)
    }

    const updated = (await response.json()) as AircraftComponentsRow
    setRows((prev) => prev.map((row) => (row.id === updated.id ? updated : row)))
    setSelectedComponent(updated)
    toast.success("Maintenance item updated")
  }

  const handleCreate = async (newComponent: Partial<AircraftComponentsRow>) => {
    const response = await fetch("/api/aircraft-components", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...newComponent,
        aircraft_id: aircraft.id,
      }),
    })

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}))
      const message =
        typeof payload.error === "string" ? payload.error : "Failed to create maintenance item"
      toast.error(message)
      throw new Error(message)
    }

    const created = (await response.json()) as AircraftComponentsRow
    setRows((prev) => [...prev, created])
    toast.success("Maintenance item created")
  }

  const handleLogMaintenance = (componentId: string) => {
    setLogComponentId(componentId)
    setLogModalOpen(true)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Aircraft Maintenance Items</h2>
          <p className="text-sm text-slate-600">Track due hours, dates, and extension limits for each component.</p>
        </div>
        <Button className="bg-slate-900 text-white font-semibold h-10 px-5 hover:bg-slate-800" onClick={() => setNewModalOpen(true)}>
          <IconPlus className="h-4 w-4 mr-2" />
          Add Component
        </Button>
      </div>

      <div className="hidden overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm md:block">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/60">
              <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-slate-600 uppercase">
                Component
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold tracking-wide text-slate-600 uppercase">
                Status
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold tracking-wide text-slate-600 uppercase">
                Type
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold tracking-wide text-slate-600 uppercase">
                Due At (hrs)
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold tracking-wide text-slate-600 uppercase">
                Extension
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold tracking-wide text-slate-600 uppercase">
                Due Date
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold tracking-wide text-slate-600 uppercase">
                Remaining
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold tracking-wide text-slate-600 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sortedComponents.length === 0 ? (
              <tr>
                <td colSpan={8} className="h-24 text-center text-slate-500 font-medium">
                  No maintenance items tracked for this aircraft.
                </td>
              </tr>
            ) : sortedComponents.map((component) => {
              const { extendedHours, dueIn } = component._computed
              const status = getComponentStatus(component, currentHours)
              const baseDueDate = component.current_due_date ? new Date(component.current_due_date) : null
              const daysDiff = baseDueDate
                ? Math.floor((baseDueDate.getTime() - nowTime) / (1000 * 60 * 60 * 24))
                : null

              const rowClass = cn(
                "cursor-pointer transition-colors",
                status === "Due Soon" && "bg-amber-50/30 hover:bg-amber-50/50",
                status === "Within Extension" && "bg-orange-50/30 hover:bg-orange-50/50",
                status === "Overdue" && "bg-red-50/30 hover:bg-red-50/50",
                status === "Upcoming" && "hover:bg-slate-50/50"
              )

              return (
                <tr key={component.id} className={rowClass} onClick={() => openEditor(component)}>
                  <td className="px-4 py-3.5 align-middle">
                    <div className="font-semibold text-slate-900">{component.name}</div>
                    {component.description ? (
                      <div className="mt-0.5 line-clamp-1 text-xs text-slate-600">{component.description}</div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3.5 text-center align-middle">
                    {status === "Due Soon" ? (
                      <Badge variant="outline" className="border-amber-200 bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                        DUE SOON
                      </Badge>
                    ) : null}
                    {status === "Within Extension" ? (
                      <Badge variant="outline" className="border-orange-200 bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
                        EXTENSION
                      </Badge>
                    ) : null}
                    {status === "Overdue" ? (
                      <Badge className="border-none bg-red-500 px-2 py-0.5 text-xs font-medium text-white">
                        OVERDUE
                      </Badge>
                    ) : null}
                    {status === "Upcoming" ? (
                      <Badge variant="outline" className="border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-600">
                        HEALTHY
                      </Badge>
                    ) : null}
                  </td>
                  <td className="px-4 py-3.5 text-center align-middle">
                    <span className="text-xs font-semibold tracking-wide text-slate-600 uppercase">
                      {component.interval_type}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-center font-semibold text-slate-700 align-middle">
                    {component.current_due_hours !== null ? `${component.current_due_hours}h` : "—"}
                  </td>
                  <td className="px-4 py-3.5 text-center font-medium text-slate-500 align-middle">
                    {extendedHours !== null ? `${Number(extendedHours.toFixed(1))}h` : "—"}
                  </td>
                  <td className="px-4 py-3.5 text-center font-medium text-slate-600 align-middle">
                    {component.current_due_date ? (
                      <div className="flex flex-col items-center">
                        <span className="text-xs font-semibold text-slate-700">
                          {formatDate(component.current_due_date)}
                        </span>
                        {daysDiff !== null &&
                        (status === "Overdue" || status === "Due Soon" || status === "Within Extension") ? (
                          <span
                            className={cn(
                              "mt-0.5 text-[10px] font-medium tracking-tight uppercase",
                              daysDiff < 0 ? "text-red-500" : "text-amber-500"
                            )}
                          >
                            {daysDiff < 0 ? `${Math.abs(daysDiff)} days overdue` : `${daysDiff} days left`}
                          </span>
                        ) : null}
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-center align-middle">
                    <span className="font-semibold text-slate-900">{dueIn}</span>
                  </td>
                  <td className="px-4 py-3.5 text-right align-middle">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 px-3 text-xs font-medium"
                      onClick={(event) => {
                        event.stopPropagation()
                        handleLogMaintenance(component.id)
                      }}
                    >
                      <IconClipboard className="h-3.5 w-3.5 mr-1.5" />
                      Log
                    </Button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 md:hidden">
        {sortedComponents.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-dashed border-slate-200 text-slate-500 font-medium">
            No maintenance items tracked for this aircraft.
          </div>
        ) : sortedComponents.map((component) => {
          const { dueIn } = component._computed
          const status = getComponentStatus(component, currentHours)
          const baseDueDate = component.current_due_date ? new Date(component.current_due_date) : null
          const daysDiff = baseDueDate
            ? Math.floor((baseDueDate.getTime() - nowTime) / (1000 * 60 * 60 * 24))
            : null

          return (
            <div
              key={component.id}
              onClick={() => openEditor(component)}
              className={cn(
                "cursor-pointer rounded-lg border bg-white p-4 shadow-sm",
                status === "Due Soon" && "border-amber-100 bg-amber-50/10",
                status === "Within Extension" && "border-orange-100 bg-orange-50/10",
                status === "Overdue" && "border-red-100 bg-red-50/10",
                status === "Upcoming" && "border-slate-200"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-slate-900">{component.name}</h3>
                  <p className="mt-1 text-xs font-medium tracking-wide text-slate-500 uppercase">
                    {component.interval_type}
                  </p>
                </div>
                {status === "Due Soon" ? (
                  <Badge variant="outline" className="border-amber-200 bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                    DUE SOON
                  </Badge>
                ) : null}
                {status === "Within Extension" ? (
                  <Badge variant="outline" className="border-orange-200 bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
                    EXTENSION
                  </Badge>
                ) : null}
                {status === "Overdue" ? (
                  <Badge className="border-none bg-red-500 px-2 py-0.5 text-xs font-medium text-white">
                    OVERDUE
                  </Badge>
                ) : null}
                {status === "Upcoming" ? (
                  <Badge variant="outline" className="border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-600">
                    HEALTHY
                  </Badge>
                ) : null}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Due In</p>
                  <p className="mt-1 font-semibold text-slate-800">{dueIn}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Due At</p>
                  <p className="mt-1 font-semibold text-slate-800">
                    {component.current_due_hours !== null
                      ? `${component.current_due_hours}h`
                      : formatDate(component.current_due_date)}
                  </p>
                  {daysDiff !== null &&
                  component.current_due_hours === null &&
                  (status === "Overdue" || status === "Due Soon" || status === "Within Extension") ? (
                    <p
                      className={cn(
                        "mt-0.5 text-[10px] font-medium tracking-tight uppercase",
                        daysDiff < 0 ? "text-red-500" : "text-amber-500"
                      )}
                    >
                      {daysDiff < 0 ? `${Math.abs(daysDiff)}d overdue` : `${daysDiff}d left`}
                    </p>
                  ) : null}
                </div>
              </div>

              {component.description ? (
                <p className="mt-3 border-t border-slate-100 pt-3 text-xs leading-relaxed text-slate-600">
                  {component.description}
                </p>
              ) : null}

              <div className="mt-3 border-t border-slate-100 pt-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 px-3 text-xs font-medium"
                  onClick={(event) => {
                    event.stopPropagation()
                    handleLogMaintenance(component.id)
                  }}
                >
                  <IconClipboard className="h-3.5 w-3.5 mr-1.5" />
                  Log Maintenance
                </Button>
              </div>
            </div>
          )
        })}
      </div>

      <ComponentEditModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        component={selectedComponent}
        onSave={handleSave}
      />

      <ComponentNewModal
        open={newModalOpen}
        onOpenChange={setNewModalOpen}
        onSave={handleCreate}
      />

      <LogMaintenanceModal
        open={logModalOpen}
        onOpenChange={setLogModalOpen}
        aircraft_id={aircraft.id}
        component_id={logComponentId}
      />
    </div>
  )
}
