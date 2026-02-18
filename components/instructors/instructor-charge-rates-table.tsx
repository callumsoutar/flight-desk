"use client"

import * as React from "react"
import { Check, Edit2, Info, Plus, Trash2, X } from "lucide-react"
import { toast } from "sonner"

import {
  createInstructorRateAction,
  deleteInstructorRateAction,
  updateInstructorRateAction,
} from "@/app/instructors/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { InstructorFlightTypeLite, InstructorRateWithFlightType } from "@/lib/types/instructors"

type InstructorChargeRatesTableProps = {
  instructorId: string
  initialRates: InstructorRateWithFlightType[]
  flightTypes: InstructorFlightTypeLite[]
  defaultTaxRate: number | null
}

type EditingRate = {
  id: string
  flight_type_id: string
  rate_per_hour: string
  effective_from: string
  currency: string
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10)
}

function toDateInput(value: string | null | undefined) {
  if (!value) return todayIsoDate()
  return value.slice(0, 10)
}

function toDateLabel(value: string | null | undefined) {
  if (!value) return "Immediate"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Immediate"
  return date.toLocaleDateString()
}

export function InstructorChargeRatesTable({
  instructorId,
  initialRates,
  flightTypes,
  defaultTaxRate,
}: InstructorChargeRatesTableProps) {
  const [rates, setRates] = React.useState<InstructorRateWithFlightType[]>(initialRates)
  const [editingRate, setEditingRate] = React.useState<EditingRate | null>(null)
  const [saving, setSaving] = React.useState(false)
  const [addingNewRate, setAddingNewRate] = React.useState(false)

  const effectiveTaxRate = defaultTaxRate ?? 0.15

  React.useEffect(() => {
    setRates(initialRates)
    setEditingRate(null)
    setAddingNewRate(false)
  }, [initialRates, instructorId])

  const calculateTaxExclusive = React.useCallback(
    (taxInclusiveAmount: number): number => taxInclusiveAmount / (1 + effectiveTaxRate),
    [effectiveTaxRate]
  )

  const calculateTaxInclusive = React.useCallback(
    (taxExclusiveAmount: number): number => taxExclusiveAmount * (1 + effectiveTaxRate),
    [effectiveTaxRate]
  )

  const getFlightTypeName = React.useCallback(
    (rate: InstructorRateWithFlightType) =>
      flightTypes.find((flightType) => flightType.id === rate.flight_type_id)?.name ??
      rate.flight_type?.name ??
      "Unknown",
    [flightTypes]
  )

  const isEditing = React.useCallback((rateId: string) => editingRate?.id === rateId, [editingRate])
  const isAddingNew = React.useCallback(
    () => addingNewRate && editingRate?.id === "new",
    [addingNewRate, editingRate]
  )

  const refreshRates = React.useCallback((nextRates: InstructorRateWithFlightType[]) => {
    setRates(nextRates)
  }, [])

  const handleAddRate = React.useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault()
      event.stopPropagation()

      if (!flightTypes.length) {
        toast.error("No flight types available")
        return
      }

      const assignedFlightTypeIds = rates.map((rate) => rate.flight_type_id)
      const availableFlightTypes = flightTypes.filter(
        (flightType) => !assignedFlightTypeIds.includes(flightType.id)
      )

      if (availableFlightTypes.length === 0) {
        toast.error("All flight types already have rates assigned")
        return
      }

      setAddingNewRate(true)
      setEditingRate({
        id: "new",
        flight_type_id: availableFlightTypes[0].id,
        rate_per_hour: "",
        effective_from: todayIsoDate(),
        currency: rates[0]?.currency ?? "NZD",
      })
    },
    [flightTypes, rates]
  )

  const handleCancelNewRate = React.useCallback(() => {
    setAddingNewRate(false)
    setEditingRate(null)
  }, [])

  const handleEditRate = React.useCallback(
    (rate: InstructorRateWithFlightType) => {
      const taxInclusiveRate = calculateTaxInclusive(rate.rate)
      setEditingRate({
        id: rate.id,
        flight_type_id: rate.flight_type_id,
        rate_per_hour: taxInclusiveRate.toFixed(2),
        effective_from: toDateInput(rate.effective_from),
        currency: rate.currency ?? "NZD",
      })
    },
    [calculateTaxInclusive]
  )

  const handleCancelEdit = React.useCallback(() => {
    setEditingRate(null)
  }, [])

  const handleSaveNewRate = React.useCallback(async () => {
    if (!editingRate || editingRate.id !== "new") return

    const taxInclusiveRate = Number.parseFloat(editingRate.rate_per_hour)
    if (!Number.isFinite(taxInclusiveRate) || taxInclusiveRate < 0) {
      toast.error("Please enter a valid rate")
      return
    }

    if (!editingRate.flight_type_id) {
      toast.error("Please select a flight type")
      return
    }

    setSaving(true)
    try {
      const result = await createInstructorRateAction({
        instructorId,
        flight_type_id: editingRate.flight_type_id,
        rate_per_hour: calculateTaxExclusive(taxInclusiveRate),
        effective_from: editingRate.effective_from || todayIsoDate(),
        currency: editingRate.currency,
      })

      if (!result.ok) throw new Error(result.error || "Failed to add rate")

      refreshRates(result.rates)
      setAddingNewRate(false)
      setEditingRate(null)
      toast.success("Rate added successfully")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add rate")
    } finally {
      setSaving(false)
    }
  }, [calculateTaxExclusive, editingRate, instructorId, refreshRates])

  const handleSaveRate = React.useCallback(async () => {
    if (!editingRate || editingRate.id === "new") return

    const taxInclusiveRate = Number.parseFloat(editingRate.rate_per_hour)
    if (!Number.isFinite(taxInclusiveRate) || taxInclusiveRate < 0) {
      toast.error("Please enter a valid rate")
      return
    }

    setSaving(true)
    try {
      const result = await updateInstructorRateAction({
        id: editingRate.id,
        rate_per_hour: calculateTaxExclusive(taxInclusiveRate),
        effective_from: editingRate.effective_from || todayIsoDate(),
      })

      if (!result.ok) throw new Error(result.error || "Failed to update rate")

      refreshRates(result.rates)
      setEditingRate(null)
      toast.success("Rate updated successfully")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update rate")
    } finally {
      setSaving(false)
    }
  }, [calculateTaxExclusive, editingRate, refreshRates])

  const handleDeleteRate = React.useCallback(
    async (rateId: string) => {
      if (!window.confirm("Are you sure you want to delete this rate?")) return

      try {
        const result = await deleteInstructorRateAction({ id: rateId })
        if (!result.ok) throw new Error(result.error || "Failed to delete rate")
        refreshRates(result.rates)
        toast.success("Rate deleted successfully")
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to delete rate")
      }
    },
    [refreshRates]
  )

  const availableFlightTypes = flightTypes.filter((flightType) => {
    const isCurrentFlightType = editingRate?.flight_type_id === flightType.id
    const isAlreadyAssigned = rates.some(
      (rate) => rate.flight_type_id === flightType.id && rate.id !== editingRate?.id
    )
    return isCurrentFlightType || !isAlreadyAssigned
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1.5 text-gray-600">
          <Info className="h-4 w-4 text-indigo-500" />
          <p className="text-sm">
            Rates include{" "}
            <span className="font-semibold text-indigo-700">
              {Math.round(effectiveTaxRate * 100)}% tax
            </span>
          </p>
        </div>
        <Button
          type="button"
          onClick={handleAddRate}
          size="sm"
          className="w-full rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white shadow-sm transition-all hover:bg-indigo-700 sm:w-auto"
          disabled={addingNewRate || Boolean(editingRate)}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Rate
        </Button>
      </div>

      {rates.length === 0 && !isAddingNew() ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50/50 p-12 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
              <Plus className="h-8 w-8 text-indigo-500" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900">No rates configured</h3>
              <p className="mx-auto mt-1 max-w-[240px] text-sm text-gray-500">
                Set up your first flight type rate to begin tracking charges.
              </p>
            </div>
            <Button
              type="button"
              onClick={handleAddRate}
              variant="outline"
              size="sm"
              className="mt-2 border-indigo-200 text-indigo-600 hover:bg-indigo-50"
            >
              Add First Rate
            </Button>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="block divide-y divide-gray-100 sm:hidden">
            {rates.map((rate) => (
              <div key={rate.id} className={`p-4 ${isEditing(rate.id) ? "bg-indigo-50/50" : ""}`}>
                {isEditing(rate.id) ? (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-gray-500">Rate (Inc. Tax)</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                        <Input
                          type="number"
                          step="0.01"
                          value={editingRate?.rate_per_hour}
                          onChange={(event) =>
                            setEditingRate((prev) =>
                              prev ? { ...prev, rate_per_hour: event.target.value } : null
                            )
                          }
                          className="bg-white pl-7"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-medium text-gray-500">Effective From</label>
                      <Input
                        type="date"
                        value={editingRate?.effective_from}
                        onChange={(event) =>
                          setEditingRate((prev) =>
                            prev ? { ...prev, effective_from: event.target.value } : null
                          )
                        }
                        className="bg-white"
                      />
                    </div>

                    <div className="flex gap-2 pt-2">
                      <Button
                        type="button"
                        size="sm"
                        className="flex-1 bg-indigo-600"
                        onClick={handleSaveRate}
                        disabled={saving}
                      >
                        <Check className="mr-2 h-4 w-4" />
                        Save
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={handleCancelEdit}
                        disabled={saving}
                      >
                        <X className="mr-2 h-4 w-4" />
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-indigo-500" />
                        <span className="font-semibold text-gray-900">{getFlightTypeName(rate)}</span>
                      </div>
                      <span className="text-lg font-bold text-indigo-600">
                        ${calculateTaxInclusive(rate.rate).toFixed(2)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">
                        Effective {toDateLabel(rate.effective_from)}
                      </span>
                      <div className="flex gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-gray-500"
                          onClick={() => handleEditRate(rate)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-500"
                          onClick={() => handleDeleteRate(rate.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {isAddingNew() ? (
              <div className="space-y-4 border-t border-blue-100 bg-blue-50/50 p-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-blue-600">Flight Type</label>
                  <Select
                    value={editingRate?.flight_type_id}
                    onValueChange={(value) =>
                      setEditingRate((prev) => (prev ? { ...prev, flight_type_id: value } : null))
                    }
                  >
                    <SelectTrigger className="w-full border-blue-200 bg-white">
                      <SelectValue placeholder="Select flight type" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableFlightTypes.map((flightType) => (
                        <SelectItem key={flightType.id} value={flightType.id}>
                          {flightType.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-blue-600">Rate (Inc. Tax)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                    <Input
                      type="number"
                      step="0.01"
                      value={editingRate?.rate_per_hour}
                      onChange={(event) =>
                        setEditingRate((prev) => (prev ? { ...prev, rate_per_hour: event.target.value } : null))
                      }
                      className="border-blue-200 bg-white pl-7"
                      placeholder="0.00"
                      autoFocus
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-blue-600">Effective From</label>
                  <Input
                    type="date"
                    value={editingRate?.effective_from}
                    onChange={(event) =>
                      setEditingRate((prev) => (prev ? { ...prev, effective_from: event.target.value } : null))
                    }
                    className="border-blue-200 bg-white"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    type="button"
                    size="sm"
                    className="flex-1 bg-blue-600"
                    onClick={handleSaveNewRate}
                    disabled={saving}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="flex-1 border-blue-200"
                    onClick={handleCancelNewRate}
                    disabled={saving}
                  >
                    <X className="mr-2 h-4 w-4" />
                    Cancel
                  </Button>
                </div>
              </div>
            ) : null}
          </div>

          <div className="hidden overflow-x-auto sm:block">
            <Table>
              <TableHeader className="bg-gray-50/50">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="px-6 py-4 font-semibold text-gray-900">Flight Type</TableHead>
                  <TableHead className="px-6 py-4 font-semibold text-gray-900">Rate (Inc. Tax)</TableHead>
                  <TableHead className="px-6 py-4 font-semibold text-gray-900">Effective From</TableHead>
                  <TableHead className="px-6 py-4 text-right font-semibold text-gray-900">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rates.map((rate) => (
                  <TableRow
                    key={rate.id}
                    className={`group border-b border-gray-100 transition-colors ${
                      isEditing(rate.id) ? "bg-indigo-50/50" : "hover:bg-gray-50/50"
                    }`}
                  >
                    <TableCell className="px-6 py-4">
                      <span className="font-medium text-gray-900">{getFlightTypeName(rate)}</span>
                    </TableCell>
                    <TableCell className="px-6 py-4">
                      {isEditing(rate.id) ? (
                        <div className="relative max-w-[140px]">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                          <Input
                            type="number"
                            step="0.01"
                            value={editingRate?.rate_per_hour}
                            onChange={(event) =>
                              setEditingRate((prev) =>
                                prev ? { ...prev, rate_per_hour: event.target.value } : null
                              )
                            }
                            className="bg-white pl-7"
                          />
                        </div>
                      ) : (
                        <span className="font-semibold text-gray-900">
                          ${calculateTaxInclusive(rate.rate).toFixed(2)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="px-6 py-4">
                      {isEditing(rate.id) ? (
                        <Input
                          type="date"
                          value={editingRate?.effective_from}
                          onChange={(event) =>
                            setEditingRate((prev) =>
                              prev ? { ...prev, effective_from: event.target.value } : null
                            )
                          }
                          className="max-w-[180px] bg-white"
                        />
                      ) : (
                        <span className="text-gray-600">{toDateLabel(rate.effective_from)}</span>
                      )}
                    </TableCell>
                    <TableCell className="px-6 py-4">
                      {isEditing(rate.id) ? (
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={handleSaveRate}
                            disabled={saving}
                            className="h-8 w-8 p-0 text-green-600 hover:bg-green-50 hover:text-green-700"
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={handleCancelEdit}
                            disabled={saving}
                            className="h-8 w-8 p-0 text-gray-400 hover:bg-gray-100 hover:text-gray-500"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex justify-end gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditRate(rate)}
                            className="h-8 w-8 p-0 text-gray-400 hover:bg-indigo-50 hover:text-indigo-600"
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteRate(rate.id)}
                            className="h-8 w-8 p-0 text-gray-400 hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}

                {isAddingNew() ? (
                  <TableRow className="border-b border-blue-100 bg-blue-50/30">
                    <TableCell className="px-6 py-4">
                      <Select
                        value={editingRate?.flight_type_id}
                        onValueChange={(value) =>
                          setEditingRate((prev) => (prev ? { ...prev, flight_type_id: value } : null))
                        }
                      >
                        <SelectTrigger className="w-full border-blue-200 bg-white">
                          <SelectValue placeholder="Select flight type" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableFlightTypes.map((flightType) => (
                            <SelectItem key={flightType.id} value={flightType.id}>
                              {flightType.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="px-6 py-4">
                      <div className="relative max-w-[140px]">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                        <Input
                          type="number"
                          step="0.01"
                          value={editingRate?.rate_per_hour}
                          onChange={(event) =>
                            setEditingRate((prev) => (prev ? { ...prev, rate_per_hour: event.target.value } : null))
                          }
                          className="border-blue-200 bg-white pl-7"
                          placeholder="0.00"
                        />
                      </div>
                    </TableCell>
                    <TableCell className="px-6 py-4">
                      <Input
                        type="date"
                        value={editingRate?.effective_from}
                        onChange={(event) =>
                          setEditingRate((prev) => (prev ? { ...prev, effective_from: event.target.value } : null))
                        }
                        className="max-w-[180px] border-blue-200 bg-white"
                      />
                    </TableCell>
                    <TableCell className="px-6 py-4">
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={handleSaveNewRate}
                          disabled={saving}
                          className="h-8 w-8 p-0 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={handleCancelNewRate}
                          disabled={saving}
                          className="h-8 w-8 p-0 text-gray-400 hover:bg-gray-100 hover:text-gray-500"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  )
}
