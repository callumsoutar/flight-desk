"use client"

import React, { useEffect, useState } from "react"
import { Check, Edit2, Plus, Trash2, X } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
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

  const availableFlightTypes = flightTypes.filter((ft) => {
    const isCurrentFlightType = editingRate?.flight_type_id === ft.id
    const isAlreadyAssigned = rates.some(
      (rate) => rate.flight_type_id === ft.id && rate.id !== editingRate?.id
    )
    return isCurrentFlightType || !isAlreadyAssigned
  })

  const getChargeMethodLabel = (rate: Rate) => {
    if (rate.charge_hobbs) return "Hobbs"
    if (rate.charge_tacho) return "Tacho"
    if (rate.charge_airswitch) return "Airswitch"
    return "None"
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-600">
          Rates are tax inclusive. Default tax rate: {(defaultTaxRate * 100).toFixed(0)}%.
        </p>
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
                <TableHead className="min-w-[170px]">Rate (incl.)</TableHead>
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

              {!loading && rates.length === 0 && !addingNewRate ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                    No rates configured. Add one to get started.
                  </TableCell>
                </TableRow>
              ) : null}

              {!loading
                ? rates.map((rate) => (
                    <TableRow key={rate.id} className={isEditing(rate.id) ? "bg-indigo-50/40" : ""}>
                      <TableCell>
                        {isEditing(rate.id) ? (
                          <Select
                            value={editingRate?.flight_type_id}
                            onValueChange={(value) =>
                              setEditingRate((prev) => (prev ? { ...prev, flight_type_id: value } : null))
                            }
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

                      <TableCell>
                        {isEditing(rate.id) ? (
                          <div className="relative max-w-[140px]">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                            <Input
                              type="number"
                              step="0.01"
                              value={editingRate?.rate_per_hour}
                              onChange={(e) =>
                                setEditingRate((prev) => (prev ? { ...prev, rate_per_hour: e.target.value } : null))
                              }
                              className="h-9 border-slate-200 bg-white pl-7"
                            />
                          </div>
                        ) : (
                          <span className="text-sm font-semibold tabular-nums text-slate-900">
                            ${calculateTaxInclusive(Number.parseFloat(rate.rate_per_hour)).toFixed(2)}
                          </span>
                        )}
                      </TableCell>

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

              {isAddingNew() ? (
                <TableRow className="bg-indigo-50/40">
                  <TableCell>
                    <Select
                      value={editingRate?.flight_type_id}
                      onValueChange={(value) =>
                        setEditingRate((prev) => (prev ? { ...prev, flight_type_id: value } : null))
                      }
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
                    <div className="relative max-w-[140px]">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                      <Input
                        type="number"
                        step="0.01"
                        value={editingRate?.rate_per_hour}
                        onChange={(e) =>
                          setEditingRate((prev) => (prev ? { ...prev, rate_per_hour: e.target.value } : null))
                        }
                        className="h-9 border-indigo-200 bg-white pl-7"
                        placeholder="0.00"
                        autoFocus
                      />
                    </div>
                  </TableCell>

                  <TableCell>
                    <Select
                      value={editingRate?.charge_method}
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
