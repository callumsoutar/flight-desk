"use client"

import React from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Check, Edit2, Plus, Trash2, X } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  aircraftChargeRatesQueryKey,
  createAircraftChargeRate,
  deleteAircraftChargeRate,
  updateAircraftChargeRate,
  useAircraftChargeRatesQuery,
  type AircraftChargeRate,
} from "@/hooks/use-aircraft-charge-rates-query"
import { useDefaultTaxRateQuery } from "@/hooks/use-default-tax-rate-query"
import { useFlightTypesQuery, type FlightType } from "@/hooks/use-flight-types-query"

interface Props {
  aircraftId: string
}

interface EditingRate {
  id: string
  flight_type_id: string
  /** Tax-inclusive hourly rate (display / edit for hourly billing) */
  rate_per_hour: string
  /** Ex-GST package price (fixed-package billing) */
  fixed_package_price: string
  charge_method: "hobbs" | "tacho" | "airswitch" | ""
}

function isFixedPackageFlightType(flightTypes: FlightType[], flightTypeId: string): boolean {
  const ft = flightTypes.find((f) => f.id === flightTypeId)
  return ft?.billing_mode === "fixed_package"
}

function parsePackageExGst(value: string): number | null {
  const v = Number.parseFloat(value.trim())
  return Number.isFinite(v) && v > 0 ? v : null
}

/** Trial flight types are priced under Settings → Trial flights, not per-aircraft charge rates. */
const AIRCRAFT_CHARGE_RATE_INSTRUCTION_TYPES: FlightType["instruction_type"][] = ["dual", "solo"]

export default function AircraftChargeRatesTable({ aircraftId }: Props) {
  const queryClient = useQueryClient()
  const [editingRate, setEditingRate] = React.useState<EditingRate | null>(null)
  const [saving, setSaving] = React.useState(false)
  const [addingNewRate, setAddingNewRate] = React.useState(false)
  const { data: rates = [], isLoading: loading } = useAircraftChargeRatesQuery(aircraftId)
  const { data: flightTypes = [] } = useFlightTypesQuery({ includeInactive: false })
  const { data: defaultTaxRate = 0.15 } = useDefaultTaxRateQuery()

  const flightTypesForAircraftRates = React.useMemo(
    () => flightTypes.filter((ft) => AIRCRAFT_CHARGE_RATE_INSTRUCTION_TYPES.includes(ft.instruction_type)),
    [flightTypes]
  )

  const displayRates = React.useMemo(
    () =>
      rates.filter((r) => {
        const ft = flightTypes.find((f) => f.id === r.flight_type_id)
        return (
          ft != null && AIRCRAFT_CHARGE_RATE_INSTRUCTION_TYPES.includes(ft.instruction_type)
        )
      }),
    [rates, flightTypes]
  )

  const hasFixedPackageRow = React.useMemo(
    () => displayRates.some((r) => isFixedPackageFlightType(flightTypes, r.flight_type_id)),
    [displayRates, flightTypes]
  )

  const handleAddRate = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (!flightTypesForAircraftRates.length) {
      toast.error("No flight types available for aircraft rates (trial types use Trial flights settings).")
      return
    }

    const assignedFlightTypeIds = displayRates.map((rate) => rate.flight_type_id)
    const availableFlightTypes = flightTypesForAircraftRates.filter(
      (ft) => !assignedFlightTypeIds.includes(ft.id)
    )

    if (availableFlightTypes.length === 0) {
      toast.error("All flight types already have rates assigned")
      return
    }

    const first = availableFlightTypes[0]
    setAddingNewRate(true)
    setEditingRate({
      id: "new",
      flight_type_id: first.id,
      rate_per_hour: "",
      fixed_package_price: "",
      charge_method: "hobbs",
    })
  }

  const handleSaveNewRate = async () => {
    if (!editingRate || editingRate.id !== "new") return

    if (!editingRate.flight_type_id) {
      toast.error("Please select a flight type")
      return
    }

    if (!editingRate.charge_method) {
      toast.error("Please select a charge method")
      return
    }

    const fixed = isFixedPackageFlightType(flightTypes, editingRate.flight_type_id)

    if (fixed) {
      const pkg = parsePackageExGst(editingRate.fixed_package_price)
      if (pkg == null) {
        toast.error("Enter a package price greater than zero (ex GST)")
        return
      }
      setSaving(true)
      try {
        await createAircraftChargeRate({
          aircraft_id: aircraftId,
          flight_type_id: editingRate.flight_type_id,
          rate_per_hour: 0,
          fixed_package_price: pkg,
          charge_hobbs: editingRate.charge_method === "hobbs",
          charge_tacho: editingRate.charge_method === "tacho",
          charge_airswitch: editingRate.charge_method === "airswitch",
        })
        await queryClient.invalidateQueries({ queryKey: aircraftChargeRatesQueryKey(aircraftId) })

        setAddingNewRate(false)
        setEditingRate(null)
        toast.success("Rate added successfully")
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to add rate")
      } finally {
        setSaving(false)
      }
      return
    }

    const taxInclusiveRate = Number.parseFloat(editingRate.rate_per_hour)
    if (Number.isNaN(taxInclusiveRate) || taxInclusiveRate < 0) {
      toast.error("Please enter a valid rate")
      return
    }

    const taxExclusiveRate = calculateTaxExclusive(taxInclusiveRate)

    setSaving(true)
    try {
      await createAircraftChargeRate({
        aircraft_id: aircraftId,
        flight_type_id: editingRate.flight_type_id,
        rate_per_hour: taxExclusiveRate,
        fixed_package_price: null,
        charge_hobbs: editingRate.charge_method === "hobbs",
        charge_tacho: editingRate.charge_method === "tacho",
        charge_airswitch: editingRate.charge_method === "airswitch",
      })
      await queryClient.invalidateQueries({ queryKey: aircraftChargeRatesQueryKey(aircraftId) })

      setAddingNewRate(false)
      setEditingRate(null)
      toast.success("Rate added successfully")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add rate")
    } finally {
      setSaving(false)
    }
  }

  const handleCancelNewRate = () => {
    setAddingNewRate(false)
    setEditingRate(null)
  }

  const handleEditRate = (rate: AircraftChargeRate) => {
    let chargeMethod: "hobbs" | "tacho" | "airswitch" | "" = ""
    if (rate.charge_hobbs) chargeMethod = "hobbs"
    else if (rate.charge_tacho) chargeMethod = "tacho"
    else if (rate.charge_airswitch) chargeMethod = "airswitch"

    if (isFixedPackageFlightType(flightTypes, rate.flight_type_id)) {
      const pkg = rate.fixed_package_price
      const n = pkg == null ? NaN : typeof pkg === "string" ? parseFloat(pkg) : Number(pkg)
      const pkgStr = Number.isFinite(n) && n > 0 ? String(n) : ""
      setEditingRate({
        id: rate.id,
        flight_type_id: rate.flight_type_id,
        rate_per_hour: "",
        fixed_package_price: pkgStr,
        charge_method: chargeMethod,
      })
      return
    }

    const taxInclusiveRate = calculateTaxInclusive(rate.rate_per_hour)
    setEditingRate({
      id: rate.id,
      flight_type_id: rate.flight_type_id,
      rate_per_hour: taxInclusiveRate.toFixed(2),
      fixed_package_price: "",
      charge_method: chargeMethod,
    })
  }

  const handleCancelEdit = () => {
    setEditingRate(null)
  }

  const handleSaveRate = async () => {
    if (!editingRate) return

    const fixed = isFixedPackageFlightType(flightTypes, editingRate.flight_type_id)

    if (fixed) {
      const pkg = parsePackageExGst(editingRate.fixed_package_price)
      if (pkg == null) {
        toast.error("Enter a package price greater than zero (ex GST)")
        return
      }
      setSaving(true)
      try {
        await updateAircraftChargeRate({
          id: editingRate.id,
          flight_type_id: editingRate.flight_type_id,
          rate_per_hour: 0,
          fixed_package_price: pkg,
          charge_hobbs: editingRate.charge_method === "hobbs",
          charge_tacho: editingRate.charge_method === "tacho",
          charge_airswitch: editingRate.charge_method === "airswitch",
        })
        await queryClient.invalidateQueries({ queryKey: aircraftChargeRatesQueryKey(aircraftId) })

        setEditingRate(null)
        toast.success("Rate updated successfully")
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to update rate")
      } finally {
        setSaving(false)
      }
      return
    }

    const taxInclusiveRate = Number.parseFloat(editingRate.rate_per_hour)
    if (Number.isNaN(taxInclusiveRate) || taxInclusiveRate < 0) {
      toast.error("Please enter a valid rate")
      return
    }

    const taxExclusiveRate = calculateTaxExclusive(taxInclusiveRate)

    setSaving(true)
    try {
      await updateAircraftChargeRate({
        id: editingRate.id,
        flight_type_id: editingRate.flight_type_id,
        rate_per_hour: taxExclusiveRate,
        fixed_package_price: null,
        charge_hobbs: editingRate.charge_method === "hobbs",
        charge_tacho: editingRate.charge_method === "tacho",
        charge_airswitch: editingRate.charge_method === "airswitch",
      })
      await queryClient.invalidateQueries({ queryKey: aircraftChargeRatesQueryKey(aircraftId) })

      setEditingRate(null)
      toast.success("Rate updated successfully")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update rate")
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteRate = async (rateId: string) => {
    if (!confirm("Are you sure you want to delete this rate?")) return

    try {
      await deleteAircraftChargeRate(rateId)
      await queryClient.invalidateQueries({ queryKey: aircraftChargeRatesQueryKey(aircraftId) })
      toast.success("Rate deleted successfully")
    } catch {
      toast.error("Failed to delete rate")
    }
  }

  const isEditing = (rateId: string) => editingRate?.id === rateId
  const isAddingNew = () => addingNewRate && editingRate?.id === "new"

  const calculateTaxExclusive = (taxInclusiveAmount: number): number => {
    return taxInclusiveAmount / (1 + defaultTaxRate)
  }

  const calculateTaxInclusive = (taxExclusiveAmount: number): number => {
    return taxExclusiveAmount * (1 + defaultTaxRate)
  }

  const availableFlightTypes = flightTypesForAircraftRates.filter((ft) => {
    const isCurrentFlightType = editingRate?.flight_type_id === ft.id
    const isAlreadyAssigned = displayRates.some(
      (rate) => rate.flight_type_id === ft.id && rate.id !== editingRate?.id
    )
    return isCurrentFlightType || !isAlreadyAssigned
  })

  const getChargeMethodLabel = (rate: AircraftChargeRate) => {
    if (rate.charge_hobbs) return "Hobbs"
    if (rate.charge_tacho) return "Tacho"
    if (rate.charge_airswitch) return "Airswitch"
    return "None"
  }

  const patchFlightTypeOnSelect = (flightTypeId: string) => {
    setEditingRate((prev) => {
      if (!prev) return null
      const mode = isFixedPackageFlightType(flightTypes, flightTypeId) ? "fixed_package" : "hourly"
      return {
        ...prev,
        flight_type_id: flightTypeId,
        rate_per_hour: mode === "hourly" ? prev.rate_per_hour : "",
        fixed_package_price: mode === "fixed_package" ? prev.fixed_package_price : "",
      }
    })
  }

  const renderBillingCell = (rate: AircraftChargeRate, editing: boolean) => {
    if (editing && editingRate) {
      if (isFixedPackageFlightType(flightTypes, editingRate.flight_type_id)) {
        return (
          <div className="space-y-1">
            <div className="relative max-w-[160px]">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
              <Input
                type="number"
                step="0.01"
                value={editingRate.fixed_package_price}
                onChange={(e) =>
                  setEditingRate((prev) => (prev ? { ...prev, fixed_package_price: e.target.value } : null))
                }
                className="h-9 border-slate-200 bg-white pl-7"
                placeholder="0.00"
                aria-label="Package price ex GST"
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              Hourly rate is not used for fixed-package billing.
            </p>
          </div>
        )
      }
      return (
        <div className="relative max-w-[140px]">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
          <Input
            type="number"
            step="0.01"
            value={editingRate.rate_per_hour}
            onChange={(e) =>
              setEditingRate((prev) => (prev ? { ...prev, rate_per_hour: e.target.value } : null))
            }
            className="h-9 border-slate-200 bg-white pl-7"
            aria-label="Hourly rate including tax"
          />
        </div>
      )
    }

    const fixed = isFixedPackageFlightType(flightTypes, rate.flight_type_id)
    if (fixed) {
      const raw = rate.fixed_package_price
      const ex =
        raw == null
          ? null
          : Number(typeof raw === "string" ? parseFloat(raw) : raw)
      const valid = ex != null && Number.isFinite(ex) && ex > 0
      return (
        <div className="space-y-0.5">
          <span className="text-sm font-semibold tabular-nums text-slate-900">
            {valid ? `$${ex.toFixed(2)}` : "—"}
            <span className="ml-1.5 text-xs font-normal text-muted-foreground">ex GST</span>
          </span>
          <p className="text-[11px] text-muted-foreground">Package price (fixed fee)</p>
        </div>
      )
    }

    return (
      <span className="text-sm font-semibold tabular-nums text-slate-900">
        ${calculateTaxInclusive(rate.rate_per_hour).toFixed(2)}
        <span className="ml-1.5 text-xs font-normal text-muted-foreground">incl. tax</span>
      </span>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-slate-600">
          {hasFixedPackageRow ? (
            <p>
              <span className="font-medium text-slate-800">Hourly</span> flight types use tax-inclusive rates
              per hour. <span className="font-medium text-slate-800">Fixed package</span> flight types use a
              flat package price (ex GST). Default tax rate: {(defaultTaxRate * 100).toFixed(0)}%.
            </p>
          ) : (
            <p>
              Rates are tax inclusive. Default tax rate: {(defaultTaxRate * 100).toFixed(0)}%.
            </p>
          )}
        </div>
        <Button
          type="button"
          onClick={handleAddRate}
          size="sm"
          className="h-9 rounded-xl bg-indigo-600 px-3 text-sm font-semibold text-white hover:bg-indigo-700"
          disabled={addingNewRate || !!editingRate}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Rate
        </Button>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[220px]">Flight type</TableHead>
              <TableHead className="min-w-[200px]">Rate / package</TableHead>
              <TableHead className="min-w-[170px]">Charge method</TableHead>
              <TableHead className="w-[120px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                  Loading rates...
                </TableCell>
              </TableRow>
            ) : null}

            {!loading && displayRates.length === 0 && !addingNewRate ? (
              <TableRow>
                <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                  No rates configured. Add one to get started.
                </TableCell>
              </TableRow>
            ) : null}

            {!loading
              ? displayRates.map((rate) => (
                  <TableRow key={rate.id} className={isEditing(rate.id) ? "bg-indigo-50/40" : ""}>
                    <TableCell>
                      {isEditing(rate.id) ? (
                        <Select
                          value={editingRate?.flight_type_id}
                          onValueChange={(value) => patchFlightTypeOnSelect(value)}
                        >
                          <SelectTrigger className="h-9 w-full border-slate-200 bg-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {availableFlightTypes.map((ft) => (
                              <SelectItem key={ft.id} value={ft.id}>
                                {ft.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="text-sm font-semibold text-slate-900">
                          {flightTypes.find((ft) => ft.id === rate.flight_type_id)?.name || "Unknown"}
                        </span>
                      )}
                    </TableCell>

                    <TableCell>{renderBillingCell(rate, isEditing(rate.id))}</TableCell>

                    <TableCell>
                      {isEditing(rate.id) ? (
                        <Select
                          value={editingRate?.charge_method}
                          onValueChange={(value) =>
                            setEditingRate((prev) =>
                              prev
                                ? { ...prev, charge_method: value as "hobbs" | "tacho" | "airswitch" | "" }
                                : null
                            )
                          }
                        >
                          <SelectTrigger className="h-9 w-full max-w-[160px] border-slate-200 bg-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="hobbs">Hobbs</SelectItem>
                            <SelectItem value="tacho">Tacho</SelectItem>
                            <SelectItem value="airswitch">Airswitch</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant="outline" className="border-slate-200 bg-white text-slate-700">
                          {getChargeMethodLabel(rate)}
                        </Badge>
                      )}
                    </TableCell>

                    <TableCell className="text-right">
                      {isEditing(rate.id) ? (
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={handleCancelEdit}
                            disabled={saving}
                            className="h-8 rounded-lg border-slate-200 px-2"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            onClick={handleSaveRate}
                            disabled={saving}
                            className="h-8 rounded-lg bg-indigo-600 px-2 text-white hover:bg-indigo-700"
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            onClick={() => handleEditRate(rate)}
                            className="h-8 w-8 rounded-lg border-slate-200 text-slate-600 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            onClick={() => handleDeleteRate(rate.id)}
                            className="h-8 w-8 rounded-lg border-slate-200 text-slate-600 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              : null}

            {isAddingNew() && editingRate ? (
              <TableRow className="bg-indigo-50/40">
                <TableCell>
                  <Select
                    value={editingRate.flight_type_id}
                    onValueChange={(value) => patchFlightTypeOnSelect(value)}
                  >
                    <SelectTrigger className="h-9 w-full border-indigo-200 bg-white">
                      <SelectValue placeholder="Select flight type" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableFlightTypes.map((ft) => (
                        <SelectItem key={ft.id} value={ft.id}>
                          {ft.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>

                <TableCell>
                  {isFixedPackageFlightType(flightTypes, editingRate.flight_type_id) ? (
                    <div className="space-y-1">
                      <div className="relative max-w-[160px]">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                        <Input
                          type="number"
                          step="0.01"
                          value={editingRate.fixed_package_price}
                          onChange={(e) =>
                            setEditingRate((prev) =>
                              prev ? { ...prev, fixed_package_price: e.target.value } : null
                            )
                          }
                          className="h-9 border-indigo-200 bg-white pl-7"
                          placeholder="0.00"
                          autoFocus
                          aria-label="Package price ex GST"
                        />
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Hourly rate is not used for fixed-package billing.
                      </p>
                    </div>
                  ) : (
                    <div className="relative max-w-[140px]">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                      <Input
                        type="number"
                        step="0.01"
                        value={editingRate.rate_per_hour}
                        onChange={(e) =>
                          setEditingRate((prev) => (prev ? { ...prev, rate_per_hour: e.target.value } : null))
                        }
                        className="h-9 border-indigo-200 bg-white pl-7"
                        placeholder="0.00"
                        autoFocus
                        aria-label="Hourly rate including tax"
                      />
                    </div>
                  )}
                </TableCell>

                <TableCell>
                  <Select
                    value={editingRate.charge_method}
                    onValueChange={(value) =>
                      setEditingRate((prev) =>
                        prev ? { ...prev, charge_method: value as "hobbs" | "tacho" | "airswitch" | "" } : null
                      )
                    }
                  >
                    <SelectTrigger className="h-9 w-full max-w-[160px] border-indigo-200 bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hobbs">Hobbs</SelectItem>
                      <SelectItem value="tacho">Tacho</SelectItem>
                      <SelectItem value="airswitch">Airswitch</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>

                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={handleCancelNewRate}
                      disabled={saving}
                      className="h-8 rounded-lg border-slate-200 px-2"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleSaveNewRate}
                      disabled={saving}
                      className="h-8 rounded-lg bg-indigo-600 px-2 text-white hover:bg-indigo-700"
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
