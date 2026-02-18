"use client"

import React, { useEffect, useState } from "react"
import { Check, Edit2, Info, Plus, Trash2, X } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

interface FlightType {
  id: string
  name: string
}

interface Props {
  aircraftId: string
}

interface Rate {
  id: string
  aircraft_id: string
  flight_type_id: string
  rate_per_hour: string
  charge_hobbs: boolean
  charge_tacho: boolean
  charge_airswitch: boolean
}

interface EditingRate {
  id: string
  flight_type_id: string
  rate_per_hour: string
  charge_method: "hobbs" | "tacho" | "airswitch" | ""
}

export default function AircraftChargeRatesTable({ aircraftId }: Props) {
  const [rates, setRates] = useState<Rate[]>([])
  const [loading, setLoading] = useState(true)
  const [flightTypes, setFlightTypes] = useState<FlightType[]>([])
  const [editingRate, setEditingRate] = useState<EditingRate | null>(null)
  const [saving, setSaving] = useState(false)
  const [addingNewRate, setAddingNewRate] = useState(false)
  const [defaultTaxRate, setDefaultTaxRate] = useState<number>(0.15)

  useEffect(() => {
    async function fetchRates() {
      try {
        const ratesRes = await fetch(`/api/aircraft-charge-rates?aircraft_id=${aircraftId}`)
        if (!ratesRes.ok) {
          setRates([])
        } else {
          const ratesData = (await ratesRes.json()) as { rates?: Rate[] }
          setRates(ratesData.rates || [])
        }
      } catch {
        setRates([])
      } finally {
        setLoading(false)
      }
    }
    void fetchRates()
  }, [aircraftId])

  useEffect(() => {
    async function fetchData() {
      try {
        const [typesRes, taxRes] = await Promise.all([
          fetch("/api/flight-types"),
          fetch("/api/tax-rates?is_default=true"),
        ])

        if (!typesRes.ok) {
          return
        }

        const typesData = (await typesRes.json()) as { flight_types?: FlightType[] }
        setFlightTypes(typesData.flight_types || [])

        if (taxRes.ok) {
          const taxData = (await taxRes.json()) as { tax_rates?: Array<{ rate: string }> }
          if (taxData.tax_rates && taxData.tax_rates.length > 0) {
            setDefaultTaxRate(Number.parseFloat(taxData.tax_rates[0].rate))
          }
        }
      } catch {
        // Ignore initial load errors.
      }
    }
    void fetchData()
  }, [])

  const handleAddRate = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (!flightTypes.length) {
      toast.error("No flight types available")
      return
    }

    const assignedFlightTypeIds = rates.map((rate) => rate.flight_type_id)
    const availableFlightTypes = flightTypes.filter((ft) => !assignedFlightTypeIds.includes(ft.id))

    if (availableFlightTypes.length === 0) {
      toast.error("All flight types already have rates assigned")
      return
    }

    setAddingNewRate(true)
    setEditingRate({
      id: "new",
      flight_type_id: availableFlightTypes[0].id,
      rate_per_hour: "",
      charge_method: "hobbs",
    })
  }

  const handleSaveNewRate = async () => {
    if (!editingRate || editingRate.id !== "new") return

    const taxInclusiveRate = Number.parseFloat(editingRate.rate_per_hour)
    if (Number.isNaN(taxInclusiveRate) || taxInclusiveRate < 0) {
      toast.error("Please enter a valid rate")
      return
    }

    if (!editingRate.flight_type_id) {
      toast.error("Please select a flight type")
      return
    }

    if (!editingRate.charge_method) {
      toast.error("Please select a charge method")
      return
    }

    const taxExclusiveRate = calculateTaxExclusive(taxInclusiveRate)

    setSaving(true)
    try {
      const res = await fetch("/api/aircraft-charge-rates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          aircraft_id: aircraftId,
          flight_type_id: editingRate.flight_type_id,
          rate_per_hour: taxExclusiveRate,
          charge_hobbs: editingRate.charge_method === "hobbs",
          charge_tacho: editingRate.charge_method === "tacho",
          charge_airswitch: editingRate.charge_method === "airswitch",
        }),
      })

      if (!res.ok) {
        const errorData = (await res.json()) as { error?: string }
        throw new Error(errorData.error || "Failed to add rate")
      }

      const ratesRes = await fetch(`/api/aircraft-charge-rates?aircraft_id=${aircraftId}`)
      if (ratesRes.ok) {
        const ratesData = (await ratesRes.json()) as { rates?: Rate[] }
        setRates(ratesData.rates || [])
      }

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

  const handleEditRate = (rate: Rate) => {
    const taxInclusiveRate = calculateTaxInclusive(Number.parseFloat(rate.rate_per_hour))

    let chargeMethod: "hobbs" | "tacho" | "airswitch" | "" = ""
    if (rate.charge_hobbs) chargeMethod = "hobbs"
    else if (rate.charge_tacho) chargeMethod = "tacho"
    else if (rate.charge_airswitch) chargeMethod = "airswitch"

    setEditingRate({
      id: rate.id,
      flight_type_id: rate.flight_type_id,
      rate_per_hour: taxInclusiveRate.toFixed(2),
      charge_method: chargeMethod,
    })
  }

  const handleCancelEdit = () => {
    setEditingRate(null)
  }

  const handleSaveRate = async () => {
    if (!editingRate) return

    const taxInclusiveRate = Number.parseFloat(editingRate.rate_per_hour)
    if (Number.isNaN(taxInclusiveRate) || taxInclusiveRate < 0) {
      toast.error("Please enter a valid rate")
      return
    }

    const taxExclusiveRate = calculateTaxExclusive(taxInclusiveRate)

    setSaving(true)
    try {
      const res = await fetch("/api/aircraft-charge-rates", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingRate.id,
          flight_type_id: editingRate.flight_type_id,
          rate_per_hour: taxExclusiveRate,
          charge_hobbs: editingRate.charge_method === "hobbs",
          charge_tacho: editingRate.charge_method === "tacho",
          charge_airswitch: editingRate.charge_method === "airswitch",
        }),
      })

      if (!res.ok) {
        const errorData = (await res.json()) as { error?: string }
        throw new Error(errorData.error || "Failed to update rate")
      }

      const ratesRes = await fetch(`/api/aircraft-charge-rates?aircraft_id=${aircraftId}`)
      if (ratesRes.ok) {
        const ratesData = (await ratesRes.json()) as { rates?: Rate[] }
        setRates(ratesData.rates || [])
      }

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
      const res = await fetch("/api/aircraft-charge-rates", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: rateId }),
      })

      if (!res.ok) {
        throw new Error("Failed to delete rate")
      }

      const ratesRes = await fetch(`/api/aircraft-charge-rates?aircraft_id=${aircraftId}`)
      if (ratesRes.ok) {
        const ratesData = (await ratesRes.json()) as { rates?: Rate[] }
        setRates(ratesData.rates || [])
      }
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

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="h-4 w-48 animate-pulse rounded bg-gray-200" />
          </div>
          <div className="h-9 w-24 animate-pulse rounded bg-gray-200" />
        </div>
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <div className="space-y-3 p-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="grid grid-cols-4 items-center gap-4">
                <div className="h-4 animate-pulse rounded bg-gray-200" />
                <div className="h-4 w-20 animate-pulse rounded bg-gray-200" />
                <div className="h-4 w-32 animate-pulse rounded bg-gray-200" />
                <div className="flex justify-end gap-2">
                  <div className="h-8 w-16 animate-pulse rounded bg-gray-200" />
                  <div className="h-8 w-16 animate-pulse rounded bg-gray-200" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  const availableFlightTypes = flightTypes.filter((ft) => {
    const isCurrentFlightType = editingRate?.flight_type_id === ft.id
    const isAlreadyAssigned = rates.some(
      (rate) => rate.flight_type_id === ft.id && rate.id !== editingRate?.id
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
            <span className="font-semibold text-indigo-700">{Math.round(defaultTaxRate * 100)}% tax</span>
          </p>
        </div>
        <Button
          type="button"
          onClick={handleAddRate}
          size="sm"
          className="w-full rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white shadow-sm transition-all hover:bg-indigo-700 sm:w-auto"
          disabled={addingNewRate || !!editingRate}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Rate
        </Button>
      </div>

      {rates.length === 0 && !addingNewRate ? (
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
                      <label className="text-xs font-medium text-gray-500">Flight Type</label>
                      <Select
                        value={editingRate?.flight_type_id}
                        onValueChange={(value) =>
                          setEditingRate((prev) => (prev ? { ...prev, flight_type_id: value } : null))
                        }
                      >
                        <SelectTrigger className="w-full bg-white">
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
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-gray-500">Rate (Inc. Tax)</label>
                      <div className="relative">
                        <span className="absolute top-1/2 left-3 -translate-y-1/2 text-gray-400">$</span>
                        <Input
                          type="number"
                          step="0.01"
                          value={editingRate?.rate_per_hour}
                          onChange={(e) =>
                            setEditingRate((prev) => (prev ? { ...prev, rate_per_hour: e.target.value } : null))
                          }
                          className="bg-white pl-7"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-gray-500">Charge Method</label>
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
                        <SelectTrigger className="w-full bg-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="hobbs">Hobbs</SelectItem>
                          <SelectItem value="tacho">Tacho</SelectItem>
                          <SelectItem value="airswitch">Airswitch</SelectItem>
                        </SelectContent>
                      </Select>
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
                        <span className="font-semibold text-gray-900">
                          {flightTypes.find((ft) => ft.id === rate.flight_type_id)?.name || "Unknown"}
                        </span>
                      </div>
                      <span className="text-lg font-bold text-indigo-600">
                        ${calculateTaxInclusive(Number.parseFloat(rate.rate_per_hour)).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex gap-1">
                        {rate.charge_hobbs ? (
                          <span className="rounded-full border border-blue-100 bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                            Hobbs
                          </span>
                        ) : null}
                        {rate.charge_tacho ? (
                          <span className="rounded-full border border-green-100 bg-green-50 px-2 py-0.5 text-[10px] font-medium text-green-700">
                            Tacho
                          </span>
                        ) : null}
                        {rate.charge_airswitch ? (
                          <span className="rounded-full border border-purple-100 bg-purple-50 px-2 py-0.5 text-[10px] font-medium text-purple-700">
                            Airswitch
                          </span>
                        ) : null}
                      </div>
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
                      {availableFlightTypes.map((ft) => (
                        <SelectItem key={ft.id} value={ft.id}>
                          {ft.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-blue-600">Rate (Inc. Tax)</label>
                  <div className="relative">
                    <span className="absolute top-1/2 left-3 -translate-y-1/2 text-gray-400">$</span>
                    <Input
                      type="number"
                      step="0.01"
                      value={editingRate?.rate_per_hour}
                      onChange={(e) =>
                        setEditingRate((prev) => (prev ? { ...prev, rate_per_hour: e.target.value } : null))
                      }
                      className="border-blue-200 bg-white pl-7"
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-blue-600">Charge Method</label>
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
                    <SelectTrigger className="w-full border-blue-200 bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hobbs">Hobbs</SelectItem>
                      <SelectItem value="tacho">Tacho</SelectItem>
                      <SelectItem value="airswitch">Airswitch</SelectItem>
                    </SelectContent>
                  </Select>
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
                  <TableHead className="w-1/3 px-6 py-4 font-semibold text-gray-900">Flight Type</TableHead>
                  <TableHead className="w-1/4 px-6 py-4 font-semibold text-gray-900">Rate (Inc. Tax)</TableHead>
                  <TableHead className="w-1/4 px-6 py-4 font-semibold text-gray-900">Charge Method</TableHead>
                  <TableHead className="w-1/6 px-6 py-4 text-right font-semibold text-gray-900">Actions</TableHead>
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
                      {isEditing(rate.id) ? (
                        <Select
                          value={editingRate?.flight_type_id}
                          onValueChange={(value) =>
                            setEditingRate((prev) => (prev ? { ...prev, flight_type_id: value } : null))
                          }
                        >
                          <SelectTrigger className="w-full bg-white">
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
                        <div className="flex items-center gap-3">
                          <div className="h-2 w-2 rounded-full bg-indigo-500 opacity-0 transition-opacity group-hover:opacity-100" />
                          <span className="font-medium text-gray-900">
                            {flightTypes.find((ft) => ft.id === rate.flight_type_id)?.name || "Unknown"}
                          </span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="px-6 py-4">
                      {isEditing(rate.id) ? (
                        <div className="relative max-w-[140px]">
                          <span className="absolute top-1/2 left-3 -translate-y-1/2 text-gray-400">$</span>
                          <Input
                            type="number"
                            step="0.01"
                            value={editingRate?.rate_per_hour}
                            onChange={(e) =>
                              setEditingRate((prev) => (prev ? { ...prev, rate_per_hour: e.target.value } : null))
                            }
                            className="bg-white pl-7"
                          />
                        </div>
                      ) : (
                        <span className="font-semibold text-gray-900">
                          ${calculateTaxInclusive(Number.parseFloat(rate.rate_per_hour)).toFixed(2)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="px-6 py-4">
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
                          <SelectTrigger className="max-w-[160px] bg-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="hobbs">Hobbs</SelectItem>
                            <SelectItem value="tacho">Tacho</SelectItem>
                            <SelectItem value="airswitch">Airswitch</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className="flex gap-1">
                          {rate.charge_hobbs ? (
                            <span className="rounded-md border border-blue-100 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">
                              Hobbs
                            </span>
                          ) : null}
                          {rate.charge_tacho ? (
                            <span className="rounded-md border border-green-100 bg-green-50 px-2 py-1 text-xs font-medium text-green-700">
                              Tacho
                            </span>
                          ) : null}
                          {rate.charge_airswitch ? (
                            <span className="rounded-md border border-purple-100 bg-purple-50 px-2 py-1 text-xs font-medium text-purple-700">
                              Airswitch
                            </span>
                          ) : null}
                        </div>
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
                          {availableFlightTypes.map((ft) => (
                            <SelectItem key={ft.id} value={ft.id}>
                              {ft.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="px-6 py-4">
                      <div className="relative max-w-[140px]">
                        <span className="absolute top-1/2 left-3 -translate-y-1/2 text-gray-400">$</span>
                        <Input
                          type="number"
                          step="0.01"
                          value={editingRate?.rate_per_hour}
                          onChange={(e) =>
                            setEditingRate((prev) => (prev ? { ...prev, rate_per_hour: e.target.value } : null))
                          }
                          className="border-blue-200 bg-white pl-7"
                          placeholder="0.00"
                          autoFocus
                        />
                      </div>
                    </TableCell>
                    <TableCell className="px-6 py-4">
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
                        <SelectTrigger className="max-w-[160px] border-blue-200 bg-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="hobbs">Hobbs</SelectItem>
                          <SelectItem value="tacho">Tacho</SelectItem>
                          <SelectItem value="airswitch">Airswitch</SelectItem>
                        </SelectContent>
                      </Select>
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
