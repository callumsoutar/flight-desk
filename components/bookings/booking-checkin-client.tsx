"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  IconAlertCircle,
  IconCalculator,
  IconCheck,
  IconClock,
  IconEdit,
  IconFileText,
  IconLoader2,
  IconPlane,
  IconPlus,
  IconTrash,
  IconX,
} from "@tabler/icons-react"
import { toast } from "sonner"

import { BookingHeader } from "@/components/bookings/booking-header"
import {
  BookingStatusTracker,
  deriveBookingTrackerState,
  getBookingTrackerStages,
} from "@/components/bookings/booking-status-tracker"
import ChargeableSearchDropdown from "@/components/invoices/chargeable-search-dropdown"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { InvoiceCalculations, roundToTwoDecimals } from "@/lib/invoices/invoice-calculations"
import type { InvoiceRow } from "@/lib/types"
import type { BookingOptions, BookingWithRelations } from "@/lib/types/bookings"
import type { InvoiceItem } from "@/lib/types/invoice_items"
import type { UserRole } from "@/lib/types/roles"
import { cn } from "@/lib/utils"

type ChargeBasis = "hobbs" | "tacho" | "airswitch"

type ChargeRate = {
  id: string
  rate_per_hour: number | string
  charge_hobbs: boolean
  charge_tacho: boolean
  charge_airswitch: boolean
}

type ManualItemGroup = "landing_fee" | "airways_fee" | "other"

type InvoiceBuilderItem = {
  id: string
  chargeable_id: string | null
  description: string
  quantity: number
  unit_price: number
  tax_rate: number | null
  notes?: string | null
  source: "generated" | "manual"
  manual_group?: ManualItemGroup
  chargeable_type_id?: string | null
  chargeable_type_code?: string | null
}

type ManualInvoiceItem = InvoiceBuilderItem & {
  source: "manual"
  manual_group: ManualItemGroup
}

type LineItemEditState = {
  itemId: string
  quantity: string
  rateInclusive: string
}

type GeneratedItemOverride = {
  quantity: number
  unit_price: number
}

type CalculatedInvoiceLine = InvoiceBuilderItem & {
  amount: number
  tax_amount: number
  rate_inclusive: number
  line_total: number
}

function getErrorMessage(err: unknown) {
  if (err instanceof Error) return err.message
  if (typeof err === "string") return err
  return "Request failed"
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  if (!res.ok) {
    let message = "Request failed"
    try {
      const data = await res.json()
      if (typeof data?.error === "string") message = data.error
      if (Array.isArray(data?.details) && data.details.length > 0) {
        const first = data.details[0]
        const path = Array.isArray(first?.path) ? first.path.join(".") : undefined
        const issue = typeof first?.message === "string" ? first.message : undefined
        if (issue) message = path ? `${message}: ${path} - ${issue}` : `${message}: ${issue}`
      }
    } catch {
      // ignore parse errors
    }
    throw new Error(message)
  }
  return (await res.json()) as T
}

function calculateFlightHours(start: number | null | undefined, end: number | null | undefined): number {
  if (start == null || end == null || !Number.isFinite(start) || !Number.isFinite(end) || end < start) return 0
  return parseFloat((end - start).toFixed(1))
}

function deriveChargeBasisFromFlags(rate: ChargeRate | null | undefined): ChargeBasis | null {
  if (!rate) return null
  if (rate.charge_hobbs && !rate.charge_tacho && !rate.charge_airswitch) return "hobbs"
  if (rate.charge_tacho && !rate.charge_hobbs && !rate.charge_airswitch) return "tacho"
  if (rate.charge_airswitch && !rate.charge_hobbs && !rate.charge_tacho) return "airswitch"
  if (rate.charge_hobbs) return "hobbs"
  if (rate.charge_tacho) return "tacho"
  if (rate.charge_airswitch) return "airswitch"
  return null
}

function parseOptionalNumber(input: string): number | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  const value = Number(trimmed)
  return Number.isFinite(value) ? value : null
}

function parseNumberLike(input: unknown): number | null {
  if (typeof input === "number") return Number.isFinite(input) ? input : null
  if (typeof input === "string") {
    const trimmed = input.trim()
    if (!trimmed) return null
    const value = Number(trimmed)
    return Number.isFinite(value) ? value : null
  }
  return null
}

function exclusiveToInclusive(unitPrice: number, taxRate: number): number {
  if (taxRate <= 0) return roundToTwoDecimals(unitPrice)
  return roundToTwoDecimals(unitPrice * (1 + taxRate))
}

function inclusiveToExclusive(rateInclusive: number, taxRate: number): number {
  if (taxRate <= 0) return roundToTwoDecimals(rateInclusive)
  return roundToTwoDecimals(rateInclusive / (1 + taxRate))
}

function createLocalLineItemId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  return `line-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

type QuickAddState = {
  chargeableId: string
  quantity: string
  rateInclusive: string
}

const MANUAL_GROUP_LABELS: Record<ManualItemGroup, string> = {
  landing_fee: "Landing Fee",
  airways_fee: "Airways Fee",
  other: "Other",
}

const MANUAL_GROUP_ORDER: ManualItemGroup[] = ["landing_fee", "airways_fee", "other"]

const MANUAL_GROUP_FILTERS: Array<{
  group: ManualItemGroup
  title: string
  emptyText: string
}> = [
  {
    group: "landing_fee",
    title: "Landing Fees",
    emptyText: "No landing fee chargeables configured.",
  },
  {
    group: "airways_fee",
    title: "Airways Fees",
    emptyText: "No airways fee chargeables configured.",
  },
  {
    group: "other",
    title: "Other",
    emptyText: "No optional chargeables configured.",
  },
]

export function BookingCheckinClient({
  bookingId,
  booking,
  options,
  role,
}: {
  bookingId: string
  booking: BookingWithRelations
  options: BookingOptions
  role: UserRole | null
}) {
  const router = useRouter()
  const isAdminOrInstructor = role === "owner" || role === "admin" || role === "instructor"

  const [selectedAircraftId] = React.useState<string | null>(
    booking.checked_out_aircraft_id ?? booking.aircraft_id ?? null
  )
  const [selectedInstructorId, setSelectedInstructorId] = React.useState<string | null>(
    booking.checked_out_instructor_id ?? booking.instructor_id ?? null
  )
  const [selectedFlightTypeId, setSelectedFlightTypeId] = React.useState<string | null>(
    booking.flight_type_id ?? null
  )

  const aircraftCurrentHobbs = parseNumberLike(
    booking.checked_out_aircraft?.current_hobbs ?? booking.aircraft?.current_hobbs ?? null
  )
  const aircraftCurrentTach = parseNumberLike(
    booking.checked_out_aircraft?.current_tach ?? booking.aircraft?.current_tach ?? null
  )

  const [hobbsStartInput, setHobbsStartInput] = React.useState(() => {
    const value = booking.hobbs_start ?? aircraftCurrentHobbs
    return value != null ? String(value) : ""
  })
  const [hobbsEndInput, setHobbsEndInput] = React.useState(
    booking.hobbs_end != null ? String(booking.hobbs_end) : ""
  )
  const [tachStartInput, setTachStartInput] = React.useState(() => {
    const value = booking.tach_start ?? aircraftCurrentTach
    return value != null ? String(value) : ""
  })
  const [tachEndInput, setTachEndInput] = React.useState(
    booking.tach_end != null ? String(booking.tach_end) : ""
  )
  const [soloEndHobbsInput, setSoloEndHobbsInput] = React.useState(
    booking.solo_end_hobbs != null ? String(booking.solo_end_hobbs) : ""
  )
  const [soloEndTachInput, setSoloEndTachInput] = React.useState(
    booking.solo_end_tach != null ? String(booking.solo_end_tach) : ""
  )

  const [hasSoloAtEnd, setHasSoloAtEnd] = React.useState(
    booking.solo_end_hobbs != null || booking.solo_end_tach != null
  )
  const [hasAttemptedCalculation, setHasAttemptedCalculation] = React.useState(false)
  const [isCalculating, setIsCalculating] = React.useState(false)
  const [isApproving, setIsApproving] = React.useState(false)

  const [aircraftChargeRate, setAircraftChargeRate] = React.useState<ChargeRate | null>(null)
  const [instructorChargeRate, setInstructorChargeRate] = React.useState<ChargeRate | null>(null)
  const [aircraftRateLoading, setAircraftRateLoading] = React.useState(false)
  const [instructorRateLoading, setInstructorRateLoading] = React.useState(false)

  const [taxRate, setTaxRate] = React.useState(0.15)
  const [manualItems, setManualItems] = React.useState<ManualInvoiceItem[]>([])
  const [generatedItemOverrides, setGeneratedItemOverrides] = React.useState<
    Record<string, GeneratedItemOverride>
  >({})
  const [removedGeneratedItemIds, setRemovedGeneratedItemIds] = React.useState<Record<string, true>>({})
  const [editingLineItem, setEditingLineItem] = React.useState<LineItemEditState | null>(null)
  const [quickAdd, setQuickAdd] = React.useState<Record<ManualItemGroup, QuickAddState>>({
    landing_fee: { chargeableId: "", quantity: "1", rateInclusive: "" },
    airways_fee: { chargeableId: "", quantity: "1", rateInclusive: "" },
    other: { chargeableId: "", quantity: "1", rateInclusive: "" },
  })
  const [activeManualGroup, setActiveManualGroup] = React.useState<ManualItemGroup>("landing_fee")
  const [landingFeeAircraftTypeOverrideId, setLandingFeeAircraftTypeOverrideId] = React.useState<string | null>(
    null
  )
  const [showLandingFeeAircraftTypeEditor, setShowLandingFeeAircraftTypeEditor] = React.useState(false)
  const [draftCalculation, setDraftCalculation] = React.useState<null | {
    signature: string
    calculated_at: string
    billing_basis: ChargeBasis
    billing_hours: number
    dual_time: number
    solo_time: number
    items: InvoiceBuilderItem[]
    lines: CalculatedInvoiceLine[]
    totals: { subtotal: number; tax_total: number; total_amount: number }
  }>(null)

  const [localInvoiceId, setLocalInvoiceId] = React.useState<string | null>(null)
  const [invoice, setInvoice] = React.useState<InvoiceRow | null>(null)
  const [invoiceItems, setInvoiceItems] = React.useState<InvoiceItem[]>([])
  const [invoiceLoading, setInvoiceLoading] = React.useState(false)

  const [isCorrectionMode, setIsCorrectionMode] = React.useState(false)
  const [correctionHobbsEnd, setCorrectionHobbsEnd] = React.useState("")
  const [correctionTachEnd, setCorrectionTachEnd] = React.useState("")
  const [correctionReason, setCorrectionReason] = React.useState("")
  const [isCorrecting, setIsCorrecting] = React.useState(false)

  const checkinInvoiceId = booking.checkin_invoice_id ?? localInvoiceId
  const isApproved = Boolean(booking.checkin_approved_at || localInvoiceId)
  const trackerStages = React.useMemo(
    () => getBookingTrackerStages(Boolean(booking.briefing_completed)),
    [booking.briefing_completed]
  )
  const lessonProgressExists = React.useMemo(() => {
    if (!booking.lesson_progress) return false
    return Array.isArray(booking.lesson_progress)
      ? booking.lesson_progress.length > 0
      : true
  }, [booking.lesson_progress])

  const trackerState = React.useMemo(
    () =>
      deriveBookingTrackerState({
        stages: trackerStages,
        status: booking.status,
        briefingCompleted: booking.briefing_completed,
        authorizationCompleted: booking.authorization_completed,
        checkedOutAt: booking.checked_out_at,
        checkedInAt: booking.checked_in_at,
        checkinApprovedAt: booking.checkin_approved_at ?? (isApproved ? "approved" : null),
        hasDebrief: lessonProgressExists,
        forceActiveStageId:
          lessonProgressExists || isApproved || booking.checked_in_at || booking.status === "complete"
            ? "debrief"
            : "checkin",
      }),
    [
      booking.authorization_completed,
      booking.briefing_completed,
      booking.checkin_approved_at,
      booking.checked_in_at,
      booking.checked_out_at,
      booking.status,
      isApproved,
      lessonProgressExists,
      trackerStages,
    ]
  )

  const hobbsStart = React.useMemo(() => parseOptionalNumber(hobbsStartInput), [hobbsStartInput])
  const hobbsEnd = React.useMemo(() => parseOptionalNumber(hobbsEndInput), [hobbsEndInput])
  const tachStart = React.useMemo(() => parseOptionalNumber(tachStartInput), [tachStartInput])
  const tachEnd = React.useMemo(() => parseOptionalNumber(tachEndInput), [tachEndInput])
  const soloEndHobbs = React.useMemo(() => parseOptionalNumber(soloEndHobbsInput), [soloEndHobbsInput])
  const soloEndTach = React.useMemo(() => parseOptionalNumber(soloEndTachInput), [soloEndTachInput])

  const selectedFlightType = React.useMemo(() => {
    if (!selectedFlightTypeId) return booking.flight_type ?? null
    return options.flightTypes.find((item) => item.id === selectedFlightTypeId) ?? booking.flight_type ?? null
  }, [booking.flight_type, options.flightTypes, selectedFlightTypeId])
  const chargeables = React.useMemo(() => options.chargeables ?? [], [options.chargeables])
  const chargeableTypes = React.useMemo(() => options.chargeableTypes ?? [], [options.chargeableTypes])
  const landingFeeRates = React.useMemo(() => options.landingFeeRates ?? [], [options.landingFeeRates])
  const chargeableMap = React.useMemo(
    () => new Map(chargeables.map((chargeable) => [chargeable.id, chargeable])),
    [chargeables]
  )
  const chargeableTypeCodeById = React.useMemo(
    () => new Map(chargeableTypes.map((type) => [type.id, type.code])),
    [chargeableTypes]
  )
  const categorizedChargeables = React.useMemo(() => {
    const grouped: Record<ManualItemGroup, typeof chargeables> = {
      landing_fee: [],
      airways_fee: [],
      other: [],
    }

    for (const chargeable of chargeables) {
      const code = chargeableTypeCodeById.get(chargeable.chargeable_type_id) ?? null

      if (code === "landing_fee") {
        grouped.landing_fee.push(chargeable)
        continue
      }

      if (code === "airways_fee") {
        grouped.airways_fee.push(chargeable)
        continue
      }

      if (code === "aircraft_hire" || code === "instruction") {
        continue
      }

      grouped.other.push(chargeable)
    }

    return grouped
  }, [chargeables, chargeableTypeCodeById])

  const selectedAircraft = React.useMemo(
    () =>
      options.aircraft.find((item) => item.id === selectedAircraftId) ??
      booking.checked_out_aircraft ??
      booking.aircraft,
    [booking.aircraft, booking.checked_out_aircraft, options.aircraft, selectedAircraftId]
  )
  const selectedAircraftTypeId = selectedAircraft?.aircraft_type_id ?? null

  const aircraftTypeNameById = React.useMemo(() => {
    const map = new Map<string, string>()

    for (const type of options.aircraftTypes ?? []) {
      map.set(type.id, type.name)
    }

    for (const aircraft of options.aircraft) {
      if (!aircraft.aircraft_type_id || map.has(aircraft.aircraft_type_id)) continue
      const fallbackName = aircraft.type?.trim()
      if (fallbackName) {
        map.set(aircraft.aircraft_type_id, fallbackName)
      }
    }

    const bookingAircrafts = [booking.aircraft, booking.checked_out_aircraft]
    for (const aircraft of bookingAircrafts) {
      if (!aircraft?.aircraft_type_id || map.has(aircraft.aircraft_type_id)) continue
      const fallbackName = aircraft.type?.trim()
      if (fallbackName) {
        map.set(aircraft.aircraft_type_id, fallbackName)
      }
    }

    return map
  }, [booking.aircraft, booking.checked_out_aircraft, options.aircraft, options.aircraftTypes])

  const landingFeeAircraftTypeOptions = React.useMemo(() => {
    const ids = new Set<string>()

    if (selectedAircraftTypeId) ids.add(selectedAircraftTypeId)
    for (const rateRow of landingFeeRates) {
      ids.add(rateRow.aircraft_type_id)
    }
    for (const type of options.aircraftTypes ?? []) {
      ids.add(type.id)
    }

    return Array.from(ids)
      .map((id) => ({
        id,
        name: aircraftTypeNameById.get(id) ?? "Unknown aircraft type",
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [aircraftTypeNameById, landingFeeRates, options.aircraftTypes, selectedAircraftTypeId])

  const effectiveLandingFeeAircraftTypeId = landingFeeAircraftTypeOverrideId ?? selectedAircraftTypeId
  const selectedAircraftTypeName = selectedAircraftTypeId
    ? aircraftTypeNameById.get(selectedAircraftTypeId) ?? selectedAircraft?.type ?? "Unknown aircraft type"
    : null
  const effectiveLandingFeeAircraftTypeName = effectiveLandingFeeAircraftTypeId
    ? aircraftTypeNameById.get(effectiveLandingFeeAircraftTypeId) ??
      (effectiveLandingFeeAircraftTypeId === selectedAircraftTypeId ? selectedAircraft?.type : null) ??
      "Unknown aircraft type"
    : null
  const isLandingFeeAircraftTypeOverridden =
    landingFeeAircraftTypeOverrideId != null && landingFeeAircraftTypeOverrideId !== selectedAircraftTypeId

  const landingFeeRateByAircraftAndChargeable = React.useMemo(() => {
    const map = new Map<string, number>()
    for (const rateRow of landingFeeRates) {
      if (!Number.isFinite(rateRow.rate)) continue
      map.set(`${rateRow.aircraft_type_id}:${rateRow.chargeable_id}`, Number(rateRow.rate))
    }
    return map
  }, [landingFeeRates])

  const instructionType = selectedFlightType?.instruction_type ?? null

  const aircraftBillingBasis = React.useMemo(
    () => deriveChargeBasisFromFlags(aircraftChargeRate),
    [aircraftChargeRate]
  )

  const displayedHobbsHours = React.useMemo(
    () => calculateFlightHours(hobbsStart, hobbsEnd),
    [hobbsStart, hobbsEnd]
  )
  const displayedTachHours = React.useMemo(
    () => calculateFlightHours(tachStart, tachEnd),
    [tachStart, tachEnd]
  )

  React.useEffect(() => {
    if (instructionType === "solo" && hasSoloAtEnd) {
      setHasSoloAtEnd(false)
      setSoloEndHobbsInput("")
      setSoloEndTachInput("")
    }
  }, [instructionType, hasSoloAtEnd])

  React.useEffect(() => {
    if (!selectedAircraftId || !selectedFlightTypeId) {
      setAircraftChargeRate(null)
      return
    }

    let cancelled = false
    setAircraftRateLoading(true)
    fetchJson<{ charge_rate: ChargeRate | null }>(
      `/api/aircraft-charge-rates?aircraft_id=${selectedAircraftId}&flight_type_id=${selectedFlightTypeId}`
    )
      .then((result) => {
        if (!cancelled) setAircraftChargeRate(result.charge_rate ?? null)
      })
      .catch(() => {
        if (!cancelled) setAircraftChargeRate(null)
      })
      .finally(() => {
        if (!cancelled) setAircraftRateLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [selectedAircraftId, selectedFlightTypeId])

  React.useEffect(() => {
    if (!selectedInstructorId || !selectedFlightTypeId) {
      setInstructorChargeRate(null)
      return
    }

    let cancelled = false
    setInstructorRateLoading(true)
    fetchJson<{ charge_rate: ChargeRate | null }>(
      `/api/instructor-charge-rates?instructor_id=${selectedInstructorId}&flight_type_id=${selectedFlightTypeId}`
    )
      .then((result) => {
        if (!cancelled) setInstructorChargeRate(result.charge_rate ?? null)
      })
      .catch(() => {
        if (!cancelled) setInstructorChargeRate(null)
      })
      .finally(() => {
        if (!cancelled) setInstructorRateLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [selectedInstructorId, selectedFlightTypeId])

  React.useEffect(() => {
    let cancelled = false

    fetchJson<{ tax_rates: Array<{ rate: number }> }>("/api/tax-rates?is_default=true")
      .then((result) => {
        if (cancelled) return
        const rate = result.tax_rates?.[0]?.rate
        if (typeof rate === "number" && Number.isFinite(rate)) {
          setTaxRate(rate)
        }
      })
      .catch(() => {
        // keep fallback value
      })

    return () => {
      cancelled = true
    }
  }, [])

  React.useEffect(() => {
    if (!checkinInvoiceId) {
      setInvoice(null)
      setInvoiceItems([])
      return
    }

    let cancelled = false
    setInvoiceLoading(true)

    Promise.all([
      fetchJson<{ invoice: InvoiceRow }>(`/api/invoices/${checkinInvoiceId}`),
      fetchJson<{ invoice_items: InvoiceItem[] }>(`/api/invoice_items?invoice_id=${checkinInvoiceId}`),
    ])
      .then(([invoiceResult, itemsResult]) => {
        if (cancelled) return
        setInvoice(invoiceResult.invoice)
        setInvoiceItems(itemsResult.invoice_items ?? [])
      })
      .catch(() => {
        if (cancelled) return
        setInvoice(null)
        setInvoiceItems([])
      })
      .finally(() => {
        if (!cancelled) setInvoiceLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [checkinInvoiceId])

  React.useEffect(() => {
    if (!landingFeeAircraftTypeOverrideId) return
    if (landingFeeAircraftTypeOptions.some((option) => option.id === landingFeeAircraftTypeOverrideId)) return
    setLandingFeeAircraftTypeOverrideId(null)
  }, [landingFeeAircraftTypeOptions, landingFeeAircraftTypeOverrideId])

  React.useEffect(() => {
    if (!showLandingFeeAircraftTypeEditor) return
    if (isApproved || landingFeeAircraftTypeOptions.length === 0) {
      setShowLandingFeeAircraftTypeEditor(false)
    }
  }, [isApproved, landingFeeAircraftTypeOptions.length, showLandingFeeAircraftTypeEditor])

  React.useEffect(() => {
    if (activeManualGroup !== "landing_fee" && showLandingFeeAircraftTypeEditor) {
      setShowLandingFeeAircraftTypeEditor(false)
    }
  }, [activeManualGroup, showLandingFeeAircraftTypeEditor])

  const hobbsTotalHours = React.useMemo(() => {
    const effectiveEnd =
      instructionType !== "solo" && hasSoloAtEnd && aircraftBillingBasis === "hobbs" ? soloEndHobbs : hobbsEnd
    return calculateFlightHours(hobbsStart, effectiveEnd)
  }, [
    aircraftBillingBasis,
    hasSoloAtEnd,
    hobbsEnd,
    hobbsStart,
    instructionType,
    soloEndHobbs,
  ])

  const tachTotalHours = React.useMemo(() => {
    const effectiveEnd =
      instructionType !== "solo" && hasSoloAtEnd && aircraftBillingBasis === "tacho" ? soloEndTach : tachEnd
    return calculateFlightHours(tachStart, effectiveEnd)
  }, [
    aircraftBillingBasis,
    hasSoloAtEnd,
    instructionType,
    soloEndTach,
    tachEnd,
    tachStart,
  ])

  const splitTimes = React.useMemo(() => {
    if (!aircraftBillingBasis || aircraftBillingBasis === "airswitch") {
      return { total: 0, dual: 0, solo: 0, error: null as string | null }
    }

    if (instructionType === "solo") {
      const total = aircraftBillingBasis === "hobbs" ? hobbsTotalHours : tachTotalHours
      return { total, dual: 0, solo: total, error: null }
    }

    const basisStart = aircraftBillingBasis === "hobbs" ? hobbsStart : tachStart
    const dualEnd = aircraftBillingBasis === "hobbs" ? hobbsEnd : tachEnd
    const finalEnd =
      aircraftBillingBasis === "hobbs"
        ? hasSoloAtEnd
          ? soloEndHobbs
          : hobbsEnd
        : hasSoloAtEnd
          ? soloEndTach
          : tachEnd

    if (hasSoloAtEnd) {
      if (basisStart == null || dualEnd == null || finalEnd == null) {
        return { total: 0, dual: 0, solo: 0, error: "Solo split requires start, dual end, and solo end." }
      }
      if (dualEnd < basisStart) return { total: 0, dual: 0, solo: 0, error: "Dual end cannot be less than start." }
      if (finalEnd < dualEnd) return { total: 0, dual: 0, solo: 0, error: "Solo end cannot be less than dual end." }

      const roundToTenth = (value: number) => parseFloat(value.toFixed(1))
      const dual = roundToTenth(dualEnd - basisStart)
      const solo = roundToTenth(finalEnd - dualEnd)
      const total = roundToTenth(dual + solo)
      return { total, dual, solo, error: null }
    }

    const total = aircraftBillingBasis === "hobbs" ? hobbsTotalHours : tachTotalHours
    return { total, dual: total, solo: 0, error: null }
  }, [
    aircraftBillingBasis,
    hasSoloAtEnd,
    hobbsEnd,
    hobbsStart,
    hobbsTotalHours,
    instructionType,
    soloEndHobbs,
    soloEndTach,
    tachEnd,
    tachStart,
    tachTotalHours,
  ])

  const billingHours = React.useMemo(() => {
    if (!aircraftBillingBasis) return 0
    if (aircraftBillingBasis === "hobbs") return hobbsTotalHours
    if (aircraftBillingBasis === "tacho") return tachTotalHours
    return 0
  }, [aircraftBillingBasis, hobbsTotalHours, tachTotalHours])

  const isAirswitchBillingUnsupported = aircraftBillingBasis === "airswitch"

  const aircraftRatePerHourExclTax = React.useMemo(() => {
    if (!aircraftChargeRate) return null
    const value =
      typeof aircraftChargeRate.rate_per_hour === "string"
        ? parseFloat(aircraftChargeRate.rate_per_hour)
        : aircraftChargeRate.rate_per_hour
    return Number.isFinite(value) ? value : null
  }, [aircraftChargeRate])

  const instructorRatePerHourExclTax = React.useMemo(() => {
    if (!instructorChargeRate) return null
    const value =
      typeof instructorChargeRate.rate_per_hour === "string"
        ? parseFloat(instructorChargeRate.rate_per_hour)
        : instructorChargeRate.rate_per_hour
    return Number.isFinite(value) ? value : null
  }, [instructorChargeRate])

  const getDefaultInclusiveRate = React.useCallback(
    (chargeableId: string, group: ManualItemGroup) => {
      const chargeable = chargeableMap.get(chargeableId)
      if (!chargeable) return 0

      const fallbackRate = Number.isFinite(chargeable.rate) ? Number(chargeable.rate) : 0
      const landingRate =
        group === "landing_fee" && effectiveLandingFeeAircraftTypeId
          ? landingFeeRateByAircraftAndChargeable.get(
              `${effectiveLandingFeeAircraftTypeId}:${chargeable.id}`
            )
          : undefined
      const effectiveRate = landingRate != null ? landingRate : fallbackRate
      const itemTaxRate = chargeable.is_taxable ? taxRate : 0

      return exclusiveToInclusive(effectiveRate, itemTaxRate)
    },
    [chargeableMap, effectiveLandingFeeAircraftTypeId, landingFeeRateByAircraftAndChargeable, taxRate]
  )

  const selectedLandingQuickAddChargeableId = quickAdd.landing_fee.chargeableId

  React.useEffect(() => {
    if (!selectedLandingQuickAddChargeableId) return

    const nextDefaultRate = getDefaultInclusiveRate(selectedLandingQuickAddChargeableId, "landing_fee").toFixed(2)
    setQuickAdd((prev) => {
      if (prev.landing_fee.chargeableId !== selectedLandingQuickAddChargeableId) return prev
      if (prev.landing_fee.rateInclusive === nextDefaultRate) return prev

      return {
        ...prev,
        landing_fee: {
          ...prev.landing_fee,
          rateInclusive: nextDefaultRate,
        },
      }
    })
  }, [effectiveLandingFeeAircraftTypeId, getDefaultInclusiveRate, selectedLandingQuickAddChargeableId])

  const updateQuickAdd = React.useCallback(
    (group: ManualItemGroup, patch: Partial<QuickAddState>) => {
      setQuickAdd((prev) => ({
        ...prev,
        [group]: {
          ...prev[group],
          ...patch,
        },
      }))
    },
    []
  )

  const canAddGroupItem = React.useCallback(
    (group: ManualItemGroup) => {
      const state = quickAdd[group]
      const quantity = parseOptionalNumber(state.quantity)
      const rateInclusive = parseOptionalNumber(state.rateInclusive)
      return (
        !isApproved &&
        Boolean(state.chargeableId) &&
        quantity != null &&
        quantity > 0 &&
        rateInclusive != null &&
        rateInclusive >= 0
      )
    },
    [isApproved, quickAdd]
  )

  const getItemTaxRate = React.useCallback(
    (item: Pick<InvoiceBuilderItem, "tax_rate">) =>
      typeof item.tax_rate === "number" && item.tax_rate >= 0 ? item.tax_rate : taxRate,
    [taxRate]
  )

  const beginLineItemEdit = React.useCallback(
    (itemId: string) => {
      if (isApproved) return
      if (editingLineItem && editingLineItem.itemId !== itemId) {
        toast.error("Save or cancel the current line item edit first")
        return
      }

      const manualItem = manualItems.find((candidate) => candidate.id === itemId)
      let item: InvoiceBuilderItem | null = manualItem ?? null

      if (!item && draftCalculation) {
        const generatedItem = draftCalculation.items.find((candidate) => candidate.id === itemId)
        if (generatedItem) {
          const override = generatedItemOverrides[itemId]
          item = override
            ? {
                ...generatedItem,
                quantity: override.quantity,
                unit_price: override.unit_price,
              }
            : generatedItem
        }
      }

      if (!item) return

      setEditingLineItem({
        itemId,
        quantity: Number.isFinite(item.quantity) ? String(item.quantity) : "",
        rateInclusive: String(exclusiveToInclusive(item.unit_price, getItemTaxRate(item))),
      })
    },
    [draftCalculation, editingLineItem, generatedItemOverrides, getItemTaxRate, isApproved, manualItems]
  )

  const saveLineItemEdit = React.useCallback(() => {
    if (!editingLineItem) return

    const quantity = parseOptionalNumber(editingLineItem.quantity)
    if (quantity == null || quantity <= 0) {
      toast.error("Quantity must be greater than zero")
      return
    }

    const rateInclusive = parseOptionalNumber(editingLineItem.rateInclusive)
    if (rateInclusive == null || rateInclusive < 0) {
      toast.error("Rate cannot be negative")
      return
    }

    const manualItem = manualItems.find((item) => item.id === editingLineItem.itemId)
    if (manualItem) {
      const itemTaxRate = getItemTaxRate(manualItem)
      setManualItems((prev) =>
        prev.map((item) =>
          item.id === editingLineItem.itemId
            ? {
                ...item,
                quantity: roundToTwoDecimals(quantity),
                unit_price: inclusiveToExclusive(rateInclusive, itemTaxRate),
              }
            : item
        )
      )
      setEditingLineItem(null)
      return
    }

    const generatedBaseItem = draftCalculation?.items.find((item) => item.id === editingLineItem.itemId)
    if (generatedBaseItem) {
      const itemTaxRate = getItemTaxRate(generatedBaseItem)
      const nextQuantity = roundToTwoDecimals(quantity)
      const nextUnitPrice = inclusiveToExclusive(rateInclusive, itemTaxRate)
      const baseQuantity = roundToTwoDecimals(generatedBaseItem.quantity)
      const baseUnitPrice = roundToTwoDecimals(generatedBaseItem.unit_price)

      setGeneratedItemOverrides((prev) => {
        const existing = prev[editingLineItem.itemId]
        const isUnchanged = nextQuantity === baseQuantity && nextUnitPrice === baseUnitPrice

        if (isUnchanged) {
          if (!existing) return prev
          const nextOverrides = { ...prev }
          delete nextOverrides[editingLineItem.itemId]
          return nextOverrides
        }

        if (existing && existing.quantity === nextQuantity && existing.unit_price === nextUnitPrice) {
          return prev
        }

        return {
          ...prev,
          [editingLineItem.itemId]: {
            quantity: nextQuantity,
            unit_price: nextUnitPrice,
          },
        }
      })
      setEditingLineItem(null)
      return
    }

    setEditingLineItem(null)
  }, [draftCalculation, editingLineItem, getItemTaxRate, manualItems])

  const cancelLineItemEdit = React.useCallback(() => {
    setEditingLineItem(null)
  }, [])

  const updateEditingLineItem = React.useCallback(
    (patch: Partial<Omit<LineItemEditState, "itemId">>) => {
      setEditingLineItem((prev) => (prev ? { ...prev, ...patch } : prev))
    },
    []
  )

  const removeLineItem = React.useCallback((item: Pick<InvoiceBuilderItem, "id" | "source">) => {
    if (item.source === "manual") {
      setManualItems((prev) => prev.filter((manualItem) => manualItem.id !== item.id))
    } else {
      setRemovedGeneratedItemIds((prev) => {
        if (prev[item.id]) return prev
        return {
          ...prev,
          [item.id]: true,
        }
      })
      setGeneratedItemOverrides((prev) => {
        if (!prev[item.id]) return prev
        const nextOverrides = { ...prev }
        delete nextOverrides[item.id]
        return nextOverrides
      })
    }

    setEditingLineItem((prev) => (prev?.itemId === item.id ? null : prev))
  }, [])

  const addManualItemForGroup = React.useCallback((group: ManualItemGroup) => {
    const state = quickAdd[group]
    const chargeable = chargeableMap.get(state.chargeableId)
    if (!chargeable) {
      toast.error(`Select a ${MANUAL_GROUP_LABELS[group].toLowerCase()} item`)
      return
    }
    const quantity = parseOptionalNumber(state.quantity)
    if (quantity == null || quantity <= 0) {
      toast.error("Quantity must be greater than zero")
      return
    }
    const rateInclusive = parseOptionalNumber(state.rateInclusive)
    if (rateInclusive == null || rateInclusive < 0) {
      toast.error("Rate cannot be negative")
      return
    }

    const itemTaxRate = chargeable.is_taxable ? taxRate : 0
    const chargeableTypeCode = chargeableTypeCodeById.get(chargeable.chargeable_type_id) ?? null
    setManualItems((prev) => [
      ...prev,
      {
        id: createLocalLineItemId(),
        chargeable_id: chargeable.id,
        description: chargeable.name,
        quantity: roundToTwoDecimals(quantity),
        unit_price: inclusiveToExclusive(rateInclusive, itemTaxRate),
        tax_rate: itemTaxRate,
        notes: null,
        source: "manual",
        manual_group: group,
        chargeable_type_id: chargeable.chargeable_type_id,
        chargeable_type_code: chargeableTypeCode,
      },
    ])
    updateQuickAdd(group, {
      chargeableId: "",
      quantity: "1",
      rateInclusive: "",
    })
  }, [chargeableMap, chargeableTypeCodeById, quickAdd, taxRate, updateQuickAdd])

  const buildGeneratedInvoiceItems = React.useCallback((): InvoiceBuilderItem[] => {
    if (!aircraftChargeRate || !aircraftBillingBasis || aircraftBillingBasis === "airswitch") return []
    if (billingHours <= 0) return []

    const aircraftRate = typeof aircraftChargeRate.rate_per_hour === "string"
      ? parseFloat(aircraftChargeRate.rate_per_hour)
      : aircraftChargeRate.rate_per_hour

    if (!Number.isFinite(aircraftRate) || aircraftRate <= 0) return []

    const selectedAircraft =
      options.aircraft.find((item) => item.id === selectedAircraftId) ??
      booking.checked_out_aircraft ??
      booking.aircraft
    const aircraftReg = selectedAircraft?.registration ?? "Aircraft"

    const items: InvoiceBuilderItem[] = [
      {
        id: "generated-aircraft-hire",
        chargeable_id: null,
        description: `Aircraft Hire (${aircraftReg})`,
        quantity: billingHours,
        unit_price: aircraftRate,
        tax_rate: taxRate,
        notes: `Booking ${booking.id}; basis=${aircraftBillingBasis}; total=${billingHours.toFixed(1)}h; dual=${splitTimes.dual.toFixed(1)}h; solo=${splitTimes.solo.toFixed(1)}h`,
        source: "generated",
      },
    ]

    if (selectedInstructorId && instructorRatePerHourExclTax != null && instructionType !== "solo") {
      const selectedInstructor =
        options.instructors.find((item) => item.id === selectedInstructorId) ??
        booking.checked_out_instructor ??
        booking.instructor
      const instructorLabel =
        [selectedInstructor?.first_name, selectedInstructor?.last_name].filter(Boolean).join(" ") ||
        selectedInstructor?.user?.email ||
        "Instructor"

      if (splitTimes.dual > 0) {
        items.push({
          id: "generated-instructor-hire",
          chargeable_id: null,
          description: `Instructor Rate (${instructorLabel})`,
          quantity: splitTimes.dual,
          unit_price: instructorRatePerHourExclTax,
          tax_rate: taxRate,
          notes: `Booking ${booking.id}; dual_time=${splitTimes.dual.toFixed(1)}h`,
          source: "generated",
        })
      }
    }

    return items
  }, [
    aircraftBillingBasis,
    aircraftChargeRate,
    billingHours,
    booking.aircraft,
    booking.checked_out_aircraft,
    booking.checked_out_instructor,
    booking.id,
    booking.instructor,
    instructionType,
    instructorRatePerHourExclTax,
    options.aircraft,
    options.instructors,
    selectedAircraftId,
    selectedInstructorId,
    splitTimes.dual,
    splitTimes.solo,
    taxRate,
  ])

  const generatedItemsForInvoice = React.useMemo(() => {
    if (!draftCalculation) return []
    return draftCalculation.items.map((item) => {
      if (removedGeneratedItemIds[item.id]) return null
      const override = generatedItemOverrides[item.id]
      if (!override) return item
      return {
        ...item,
        quantity: override.quantity,
        unit_price: override.unit_price,
      }
    }).filter((item): item is InvoiceBuilderItem => item != null)
  }, [draftCalculation, generatedItemOverrides, removedGeneratedItemIds])

  const validManualItems = React.useMemo(
    () =>
      manualItems.filter((item) => {
        if (!item.description.trim()) return false
        if (!Number.isFinite(item.quantity) || item.quantity <= 0) return false
        if (!Number.isFinite(item.unit_price) || item.unit_price < 0) return false
        return true
      }),
    [manualItems]
  )

  const calculateInvoiceLine = React.useCallback(
    (item: InvoiceBuilderItem): CalculatedInvoiceLine => {
      const quantityIsValid = Number.isFinite(item.quantity) && item.quantity > 0
      const unitPriceIsValid = Number.isFinite(item.unit_price) && item.unit_price >= 0
      const itemTaxRate = getItemTaxRate(item)

      if (!quantityIsValid || !unitPriceIsValid) {
        return {
          ...item,
          amount: 0,
          tax_amount: 0,
          rate_inclusive: 0,
          line_total: 0,
        }
      }

      const calculated = InvoiceCalculations.calculateItemAmounts({
        quantity: item.quantity,
        unitPrice: item.unit_price,
        taxRate: itemTaxRate,
      })

      return {
        ...item,
        amount: calculated.amount,
        tax_amount: calculated.taxAmount,
        rate_inclusive: calculated.rateInclusive,
        line_total: calculated.lineTotal,
      }
    },
    [getItemTaxRate]
  )

  const invoiceBuilderLines = React.useMemo<CalculatedInvoiceLine[]>(() => {
    const generatedLines = generatedItemsForInvoice.map(calculateInvoiceLine)
    const manualLines = manualItems.map(calculateInvoiceLine)
    return [...generatedLines, ...manualLines]
  }, [calculateInvoiceLine, generatedItemsForInvoice, manualItems])

  const invoiceBuilderLineGroups = React.useMemo(() => {
    const groups: Array<{ id: string; label: string; lines: CalculatedInvoiceLine[] }> = []

    const generatedLines = invoiceBuilderLines.filter((line) => line.source === "generated")
    if (generatedLines.length > 0) {
      groups.push({
        id: "generated",
        label: "Flight Hire",
        lines: generatedLines,
      })
    }

    for (const manualGroup of MANUAL_GROUP_ORDER) {
      const groupedLines = invoiceBuilderLines.filter(
        (line) => line.source === "manual" && (line.manual_group ?? "other") === manualGroup
      )
      if (groupedLines.length === 0) continue

      groups.push({
        id: `manual-${manualGroup}`,
        label: MANUAL_GROUP_LABELS[manualGroup],
        lines: groupedLines,
      })
    }

    return groups
  }, [invoiceBuilderLines])

  const invoiceBuilderTotals = React.useMemo(() => {
    const subtotal = roundToTwoDecimals(invoiceBuilderLines.reduce((sum, line) => sum + line.amount, 0))
    const taxTotal = roundToTwoDecimals(invoiceBuilderLines.reduce((sum, line) => sum + line.tax_amount, 0))
    const totalAmount = roundToTwoDecimals(invoiceBuilderLines.reduce((sum, line) => sum + line.line_total, 0))
    return { subtotal, taxTotal, totalAmount }
  }, [invoiceBuilderLines])

  const approvalInvoiceItems = React.useMemo(() => {
    if (!draftCalculation) return []
    return [...generatedItemsForInvoice, ...validManualItems]
  }, [draftCalculation, generatedItemsForInvoice, validManualItems])

  const draftSignature = React.useMemo(() => {
    return JSON.stringify({
      booking_id: booking.id,
      selectedAircraftId,
      selectedInstructorId,
      selectedFlightTypeId,
      hobbsStart,
      hobbsEnd,
      tachStart,
      tachEnd,
      soloEndHobbs: hasSoloAtEnd ? soloEndHobbs : null,
      soloEndTach: hasSoloAtEnd ? soloEndTach : null,
      hasSoloAtEnd,
      instructionType,
      aircraftChargeRate,
      instructorChargeRate,
      taxRate,
    })
  }, [
    aircraftChargeRate,
    booking.id,
    hasSoloAtEnd,
    hobbsEnd,
    hobbsStart,
    instructionType,
    instructorChargeRate,
    selectedAircraftId,
    selectedFlightTypeId,
    selectedInstructorId,
    soloEndHobbs,
    soloEndTach,
    tachEnd,
    tachStart,
    taxRate,
  ])

  const isDraftCalculated = Boolean(draftCalculation)
  const isDraftStale = Boolean(draftCalculation && draftCalculation.signature !== draftSignature)

  const calculateDraft = React.useCallback(async () => {
    setHasAttemptedCalculation(true)
    if (splitTimes.error) {
      toast.error(splitTimes.error)
      return
    }

    if (!selectedAircraftId) {
      toast.error("Aircraft is required")
      return
    }
    if (!selectedFlightTypeId) {
      toast.error("Flight type is required")
      return
    }
    if (!aircraftChargeRate || !aircraftBillingBasis) {
      toast.error("Aircraft charge rate is not configured")
      return
    }
    if (isAirswitchBillingUnsupported) {
      toast.error("Airswitch billing is not supported in this check-in UI")
      return
    }
    if (billingHours <= 0) {
      toast.error("Billing hours must be greater than zero")
      return
    }

    setIsCalculating(true)
    try {
      const generatedItems = buildGeneratedInvoiceItems()
      if (generatedItems.length === 0) {
        setDraftCalculation(null)
        setGeneratedItemOverrides({})
        setRemovedGeneratedItemIds({})
        setEditingLineItem(null)
        toast.error("No generated invoice items to calculate")
        return
      }

      const lines: CalculatedInvoiceLine[] = generatedItems.map((item) => {
        const calculated = InvoiceCalculations.calculateItemAmounts({
          quantity: item.quantity,
          unitPrice: item.unit_price,
          taxRate: getItemTaxRate(item),
        })
        return {
          ...item,
          amount: calculated.amount,
          tax_amount: calculated.taxAmount,
          rate_inclusive: calculated.rateInclusive,
          line_total: calculated.lineTotal,
        }
      })

      const subtotal = roundToTwoDecimals(lines.reduce((sum, line) => sum + line.amount, 0))
      const taxTotal = roundToTwoDecimals(lines.reduce((sum, line) => sum + line.tax_amount, 0))
      const totalAmount = roundToTwoDecimals(lines.reduce((sum, line) => sum + line.line_total, 0))

      setDraftCalculation({
        signature: draftSignature,
        calculated_at: new Date().toISOString(),
        billing_basis: aircraftBillingBasis,
        billing_hours: billingHours,
        dual_time: splitTimes.dual,
        solo_time: splitTimes.solo,
        items: generatedItems,
        lines,
        totals: { subtotal, tax_total: taxTotal, total_amount: totalAmount },
      })
      setGeneratedItemOverrides({})
      setRemovedGeneratedItemIds({})
      setEditingLineItem(null)
      toast.success("Draft invoice calculated")
    } catch (error) {
      toast.error(getErrorMessage(error))
      setDraftCalculation(null)
      setGeneratedItemOverrides({})
      setRemovedGeneratedItemIds({})
      setEditingLineItem(null)
    } finally {
      setIsCalculating(false)
    }
  }, [
    aircraftBillingBasis,
    aircraftChargeRate,
    billingHours,
    buildGeneratedInvoiceItems,
    draftSignature,
    getItemTaxRate,
    isAirswitchBillingUnsupported,
    selectedAircraftId,
    selectedFlightTypeId,
    splitTimes.dual,
    splitTimes.error,
    splitTimes.solo,
  ])

  const approveDraft = React.useCallback(async () => {
    if (!isAdminOrInstructor) {
      toast.error("Only staff can approve check-in")
      return
    }
    if (!draftCalculation) {
      toast.error("Calculate flight charges before approval")
      return
    }
    if (editingLineItem) {
      toast.error("Save or cancel the current line item edit before approving.")
      return
    }
    if (isDraftStale) {
      toast.error("Draft is out of date. Recalculate before approving.")
      return
    }
    if (approvalInvoiceItems.length === 0) {
      toast.error("Add at least one invoice line item before approving.")
      return
    }
    if (!selectedAircraftId || !selectedFlightTypeId) {
      toast.error("Aircraft and flight type are required")
      return
    }
    if (!aircraftBillingBasis) {
      toast.error("No aircraft billing basis configured")
      return
    }

    setIsApproving(true)
    try {
      const dueDate = new Date()
      dueDate.setDate(dueDate.getDate() + 7)

      const result = await fetchJson<{ invoice: { id: string } }>(
        `/api/bookings/${bookingId}/checkin/approve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            checked_out_aircraft_id: selectedAircraftId,
            checked_out_instructor_id: selectedInstructorId,
            flight_type_id: selectedFlightTypeId,
            hobbs_start: hobbsStart,
            hobbs_end: hobbsEnd,
            tach_start: tachStart,
            tach_end: tachEnd,
            airswitch_start: null,
            airswitch_end: null,
            solo_end_hobbs:
              aircraftBillingBasis === "hobbs" && hasSoloAtEnd ? (soloEndHobbs ?? null) : null,
            solo_end_tach:
              aircraftBillingBasis === "tacho" && hasSoloAtEnd ? (soloEndTach ?? null) : null,
            dual_time: draftCalculation.dual_time > 0 ? draftCalculation.dual_time : null,
            solo_time: draftCalculation.solo_time > 0 ? draftCalculation.solo_time : null,
            billing_basis: draftCalculation.billing_basis,
            billing_hours: draftCalculation.billing_hours,
            tax_rate: taxRate,
            due_date: dueDate.toISOString(),
            reference: `Booking ${bookingId} check-in`,
            notes: "Auto-generated from booking check-in.",
            items: approvalInvoiceItems.map((item) => ({
              chargeable_id: item.chargeable_id,
              description: item.description,
              quantity: item.quantity,
              unit_price: item.unit_price,
              tax_rate: item.tax_rate,
              notes: item.notes ?? null,
            })),
          }),
        }
      )

      setLocalInvoiceId(result.invoice.id)
      toast.success("Check-in approved and invoice created")
      router.refresh()
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setIsApproving(false)
    }
  }, [
    approvalInvoiceItems,
    aircraftBillingBasis,
    bookingId,
    draftCalculation,
    editingLineItem,
    hasSoloAtEnd,
    hobbsEnd,
    hobbsStart,
    isAdminOrInstructor,
    isDraftStale,
    router,
    selectedAircraftId,
    selectedFlightTypeId,
    selectedInstructorId,
    soloEndHobbs,
    soloEndTach,
    tachEnd,
    tachStart,
    taxRate,
  ])

  const canApprove =
    !isApproved &&
    Boolean(draftCalculation) &&
    approvalInvoiceItems.length > 0 &&
    !editingLineItem &&
    !isDraftStale &&
    !isApproving &&
    !isAirswitchBillingUnsupported &&
    !splitTimes.error &&
    billingHours > 0

  const enterCorrectionMode = React.useCallback(() => {
    setCorrectionHobbsEnd(booking.hobbs_end != null ? String(booking.hobbs_end) : "")
    setCorrectionTachEnd(booking.tach_end != null ? String(booking.tach_end) : "")
    setCorrectionReason("")
    setIsCorrectionMode(true)
  }, [booking.hobbs_end, booking.tach_end])

  const exitCorrectionMode = React.useCallback(() => {
    setIsCorrectionMode(false)
    setCorrectionReason("")
  }, [])

  const correctionHobbsEndNum = React.useMemo(() => parseOptionalNumber(correctionHobbsEnd), [correctionHobbsEnd])
  const correctionTachEndNum = React.useMemo(() => parseOptionalNumber(correctionTachEnd), [correctionTachEnd])

  const correctionHobbsDelta = React.useMemo(() => {
    if (booking.hobbs_start == null || correctionHobbsEndNum == null) return null
    const delta = correctionHobbsEndNum - Number(booking.hobbs_start)
    return delta >= 0 ? parseFloat(delta.toFixed(1)) : null
  }, [booking.hobbs_start, correctionHobbsEndNum])

  const correctionTachDelta = React.useMemo(() => {
    if (booking.tach_start == null || correctionTachEndNum == null) return null
    const delta = correctionTachEndNum - Number(booking.tach_start)
    return delta >= 0 ? parseFloat(delta.toFixed(1)) : null
  }, [booking.tach_start, correctionTachEndNum])

  const hasEndReadingChanged =
    (booking.hobbs_end != null && correctionHobbsEndNum != null && correctionHobbsEndNum !== Number(booking.hobbs_end)) ||
    (booking.tach_end != null && correctionTachEndNum != null && correctionTachEndNum !== Number(booking.tach_end))

  const canSubmitCorrection =
    isCorrectionMode &&
    !isCorrecting &&
    hasEndReadingChanged &&
    correctionReason.trim().length >= 10

  const submitCorrection = React.useCallback(async () => {
    if (!canSubmitCorrection) return

    setIsCorrecting(true)
    try {
      await fetchJson(`/api/bookings/${bookingId}/checkin/correct`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hobbs_end: correctionHobbsEndNum,
          tach_end: correctionTachEndNum,
          airswitch_end: null,
          correction_reason: correctionReason.trim(),
        }),
      })

      toast.success("Flight readings corrected successfully")
      setIsCorrectionMode(false)
      setCorrectionReason("")
      router.refresh()
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setIsCorrecting(false)
    }
  }, [
    bookingId,
    canSubmitCorrection,
    correctionHobbsEndNum,
    correctionReason,
    correctionTachEndNum,
    router,
  ])

  const aircraftRatePerHourInclTax =
    aircraftRatePerHourExclTax == null ? null : roundToTwoDecimals(aircraftRatePerHourExclTax * (1 + taxRate))
  const instructorRatePerHourInclTax =
    instructorRatePerHourExclTax == null ? null : roundToTwoDecimals(instructorRatePerHourExclTax * (1 + taxRate))
  const formSelectTriggerClass =
    "h-10 w-full text-sm text-foreground"

  const activeManualGroupConfig =
    MANUAL_GROUP_FILTERS.find((option) => option.group === activeManualGroup) ?? MANUAL_GROUP_FILTERS[0]
  const activeQuickAddState = quickAdd[activeManualGroup]
  const activeScopedChargeables = categorizedChargeables[activeManualGroup]
  const selectedActiveChargeable = activeQuickAddState.chargeableId
    ? (chargeableMap.get(activeQuickAddState.chargeableId) ?? null)
    : null
  const usesAircraftLandingRate =
    activeManualGroup === "landing_fee" &&
    selectedActiveChargeable != null &&
    effectiveLandingFeeAircraftTypeId != null &&
    landingFeeRateByAircraftAndChargeable.has(
      `${effectiveLandingFeeAircraftTypeId}:${selectedActiveChargeable.id}`
    )

  const selectedAircraftLabel = selectedAircraft?.registration ?? "Aircraft"

  if (!isAdminOrInstructor) {
    return (
      <div className="flex flex-1 flex-col bg-muted/30">
        <BookingHeader
          booking={booking}
          title="Flight Check-In"
          backHref={`/bookings/${bookingId}`}
          backLabel="Back to Booking"
        />
        <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <Card>
            <CardHeader>
              <CardTitle>Check-in access required</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Only staff users can complete flight check-ins.
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (booking.booking_type !== "flight") {
    return (
      <div className="flex flex-1 flex-col bg-muted/30">
        <BookingHeader
          booking={booking}
          title="Flight Check-In"
          backHref={`/bookings/${bookingId}`}
          backLabel="Back to Booking"
        />
        <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <Card>
            <CardHeader>
              <CardTitle>Invalid booking type</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Flight check-in is only available for flight bookings.
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col bg-muted/30">
      <BookingHeader
        booking={booking}
        title="Flight Check-In"
        backHref={`/bookings/${bookingId}`}
        backLabel="Back to Booking"
      />

      <div className="mx-auto w-full max-w-7xl flex-1 space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <BookingStatusTracker
          stages={trackerStages}
          activeStageId={trackerState.activeStageId}
          completedStageIds={trackerState.completedStageIds}
        />

        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconClock className="h-4 w-4" />
              Flight Details & Billing
            </CardTitle>
            <CardDescription>
              Record meter readings, pick active rates, then calculate draft charges.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {isAirswitchBillingUnsupported ? (
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                This aircraft rate bills by airswitch. The check-in UI currently supports Hobbs/Tacho only.
              </div>
            ) : null}

            <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2 max-w-3xl">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Flight Type</label>
                <Select
                  value={selectedFlightTypeId ?? "none"}
                  disabled={isApproved}
                  onValueChange={(value) => setSelectedFlightTypeId(value === "none" ? null : value)}
                >
                  <SelectTrigger className={formSelectTriggerClass}>
                    <SelectValue placeholder="Select flight type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No flight type</SelectItem>
                    {options.flightTypes.map((flightType) => (
                      <SelectItem key={flightType.id} value={flightType.id}>
                        {flightType.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {aircraftRateLoading ? (
                    "Loading aircraft rate..."
                  ) : aircraftRatePerHourInclTax != null ? (
                    <>
                      Aircraft rate: <span className="font-semibold text-foreground">${aircraftRatePerHourInclTax.toFixed(2)}</span>/hr (inc. tax)
                    </>
                  ) : (
                    "No aircraft rate configured for this aircraft + flight type."
                  )}
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Instructor</label>
                <Select
                  value={selectedInstructorId ?? "none"}
                  disabled={isApproved}
                  onValueChange={(value) => setSelectedInstructorId(value === "none" ? null : value)}
                >
                  <SelectTrigger className={formSelectTriggerClass}>
                    <SelectValue placeholder="Select instructor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No instructor</SelectItem>
                    {options.instructors.map((instructor) => (
                      <SelectItem key={instructor.id} value={instructor.id}>
                        {[instructor.first_name, instructor.last_name].filter(Boolean).join(" ") ||
                          instructor.user?.email ||
                          "Instructor"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {selectedInstructorId ? (
                    instructorRateLoading ? (
                      "Loading instructor rate..."
                    ) : instructorRatePerHourInclTax != null ? (
                      <>
                        Instructor rate:{" "}
                        <span className="font-semibold text-foreground">${instructorRatePerHourInclTax.toFixed(2)}</span>/hr (inc. tax)
                      </>
                    ) : (
                      "No instructor rate configured for this flight type."
                    )
                  ) : (
                    "No instructor selected."
                  )}
                </p>
              </div>
            </div>

            <div className="border-t border-border/50" />

            <div className="space-y-2">
              <div className="hidden sm:grid sm:grid-cols-[140px_1fr_1fr_60px] max-w-xl gap-3 text-xs font-medium text-muted-foreground">
                <div>Meter</div>
                <div>Start</div>
                <div>End</div>
                <div className="text-right">Hours</div>
              </div>

              {(aircraftBillingBasis === "tacho" ? ["tacho", "hobbs"] as const : ["hobbs", "tacho"] as const).map(
                (meter) => {
                  const isBilling = aircraftBillingBasis === meter
                  const isHobbs = meter === "hobbs"
                  const startValue = isHobbs ? hobbsStartInput : tachStartInput
                  const endValue = isHobbs ? hobbsEndInput : tachEndInput
                  const setStart = isHobbs ? setHobbsStartInput : setTachStartInput
                  const setEnd = isHobbs ? setHobbsEndInput : setTachEndInput
                  const displayedHours = isHobbs ? displayedHobbsHours : displayedTachHours
                  const meterLabel = isHobbs ? "Hobbs" : "Tacho"
                  const MeterIcon = isHobbs ? IconClock : IconPlane
                  const showSoloAtEnd =
                    isBilling && instructionType !== "solo"
                  const soloEndValue = isHobbs ? soloEndHobbsInput : soloEndTachInput
                  const setSoloEnd = isHobbs ? setSoloEndHobbsInput : setSoloEndTachInput

                  return (
                    <React.Fragment key={meter}>
                      <div className="grid items-center gap-3 sm:grid-cols-[140px_1fr_1fr_60px] max-w-xl">
                        <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                          <MeterIcon className="h-4 w-4 text-muted-foreground" />
                          {meterLabel}
                          {isBilling ? (
                            <Badge variant="secondary" className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0">
                              Billing
                            </Badge>
                          ) : null}
                        </label>
                        <div>
                          <label className="text-xs font-medium text-muted-foreground sm:hidden">Start</label>
                          <Input
                            inputMode="decimal"
                            placeholder="0.0"
                            value={startValue}
                            disabled={isApproved}
                            onChange={(event) => setStart(event.target.value)}
                            className="h-9 tabular-nums"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-muted-foreground sm:hidden">End</label>
                          <Input
                            inputMode="decimal"
                            placeholder="0.0"
                            value={endValue}
                            disabled={isApproved}
                            onChange={(event) => setEnd(event.target.value)}
                            className="h-9 tabular-nums"
                          />
                        </div>
                        <div className={cn(
                          "text-right text-sm tabular-nums",
                          isBilling ? "font-semibold text-foreground" : "text-muted-foreground"
                        )}>
                          {displayedHours.toFixed(1)}h
                        </div>
                      </div>

                      {showSoloAtEnd ? (
                        <div className="grid items-center gap-3 sm:grid-cols-[140px_1fr_1fr_60px] max-w-xl">
                          <div />
                          <div className="flex items-center justify-between sm:col-span-2">
                            <div className="flex items-center gap-2.5">
                              <Switch
                                checked={hasSoloAtEnd}
                                disabled={isApproved}
                                onCheckedChange={(checked) => {
                                  setHasSoloAtEnd(checked)
                                  if (!checked) setSoloEnd("")
                                }}
                              />
                              <span className="text-sm text-muted-foreground">Solo at end</span>
                            </div>
                            {hasSoloAtEnd ? (
                              <div className="flex items-center gap-2">
                                <label className="text-xs font-medium text-muted-foreground whitespace-nowrap">Solo End {meterLabel}</label>
                                <Input
                                  inputMode="decimal"
                                  placeholder="0.0"
                                  value={soloEndValue}
                                  disabled={isApproved}
                                  onChange={(event) => setSoloEnd(event.target.value)}
                                  className="h-9 w-28 tabular-nums"
                                />
                              </div>
                            ) : null}
                          </div>
                        </div>
                      ) : null}
                    </React.Fragment>
                  )
                }
              )}
            </div>

            <div className="flex justify-stretch sm:justify-start">
              <Button
                type="button"
                className="h-9 w-full sm:w-auto rounded-md bg-slate-700 text-sm font-medium text-white shadow-sm hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700"
                onClick={() => void calculateDraft()}
                disabled={isApproved || isCalculating}
              >
                {isCalculating ? (
                  <>
                    <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
                    Calculating...
                  </>
                ) : (
                  <>
                    <IconCalculator className="mr-2 h-4 w-4" />
                    {isDraftCalculated ? "Recalculate Flight Charges" : "Calculate Flight Charges"}
                  </>
                )}
              </Button>
            </div>

            {hasAttemptedCalculation && splitTimes.error ? (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                <div className="flex items-start gap-2">
                  <IconAlertCircle className="mt-0.5 h-3.5 w-3.5" />
                  <span>{splitTimes.error}</span>
                </div>
              </div>
            ) : null}

          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <IconFileText className="h-4 w-4" />
                Invoice Builder
              </CardTitle>
              <span className="text-sm tabular-nums text-muted-foreground">
                {invoiceBuilderLines.length} {invoiceBuilderLines.length === 1 ? "item" : "items"}
              </span>
            </div>
            {!isDraftCalculated ? (
              <p className="text-sm text-muted-foreground">
                Calculate flight charges to generate line items, then add any extra fees below.
              </p>
            ) : isDraftStale ? (
              <div className="mt-1 flex items-center gap-2 text-sm text-destructive">
                <IconAlertCircle className="h-4 w-4 shrink-0" />
                Draft is out of date. Recalculate before approving.
              </div>
            ) : (
              <div className="mt-1 flex items-center gap-2 text-sm text-emerald-700">
                <IconCheck className="h-4 w-4 shrink-0" />
                Draft is up to date and ready for approval.
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-5">
            {invoiceBuilderLines.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No invoice items yet. Set flight details and calculate charges to generate line items.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Description</TableHead>
                      <TableHead className="w-[100px] text-right">Qty</TableHead>
                      <TableHead className="w-[140px] text-right">Rate (inc.)</TableHead>
                      <TableHead className="w-[120px] text-right">Total</TableHead>
                      <TableHead className="w-[220px] text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoiceBuilderLineGroups.map((group) => (
                      <React.Fragment key={group.id}>
                        <TableRow className="bg-muted/20 hover:bg-muted/20">
                          <TableCell
                            colSpan={5}
                            className="py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
                          >
                            {group.label}
                          </TableCell>
                        </TableRow>
                        {group.lines.map((line) => {
                          const isEditing = editingLineItem?.itemId === line.id
                          const quantityDisplay = Number.isFinite(line.quantity) ? line.quantity.toFixed(1) : "—"

                          return (
                            <TableRow key={line.id}>
                              <TableCell>
                                <span className="font-medium">{line.description || "Manual item"}</span>
                              </TableCell>
                              <TableCell className="text-right">
                                {isEditing ? (
                                  <Input
                                    type="number"
                                    min={0}
                                    step={0.1}
                                    value={editingLineItem?.quantity ?? ""}
                                    disabled={isApproved}
                                    onChange={(event) => updateEditingLineItem({ quantity: event.target.value })}
                                    className="h-8 w-20 text-right tabular-nums"
                                  />
                                ) : (
                                  <span className="tabular-nums">{quantityDisplay}</span>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                {isEditing ? (
                                  <div className="relative inline-block">
                                    <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                                      $
                                    </span>
                                    <Input
                                      type="number"
                                      min={0}
                                      step={0.01}
                                      value={editingLineItem?.rateInclusive ?? ""}
                                      disabled={isApproved}
                                      onChange={(event) => updateEditingLineItem({ rateInclusive: event.target.value })}
                                      className="h-8 w-28 pl-5 text-right tabular-nums"
                                    />
                                  </div>
                                ) : (
                                  <span className="tabular-nums">${line.rate_inclusive.toFixed(2)}</span>
                                )}
                              </TableCell>
                              <TableCell className="text-right tabular-nums font-medium">
                                ${line.line_total.toFixed(2)}
                              </TableCell>
                              <TableCell className="text-right">
                                {isEditing ? (
                                  <div className="flex items-center justify-end gap-1">
                                    <Button
                                      type="button"
                                      variant="secondary"
                                      size="sm"
                                      disabled={isApproved}
                                      onClick={saveLineItemEdit}
                                    >
                                      Save
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      disabled={isApproved}
                                      onClick={cancelLineItemEdit}
                                    >
                                      Cancel
                                    </Button>
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-end gap-1">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      disabled={isApproved}
                                      onClick={() => beginLineItemEdit(line.id)}
                                    >
                                      Edit
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      disabled={isApproved}
                                      onClick={() => removeLineItem(line)}
                                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                    >
                                      <IconTrash className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                )}
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </React.Fragment>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            <div className="border-t pt-5">
              <h4 className="mb-4 text-sm font-semibold text-foreground">Add Charges</h4>

              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  {MANUAL_GROUP_FILTERS.map((option) => {
                    const isActive = option.group === activeManualGroup
                    return (
                      <Button
                        key={option.group}
                        type="button"
                        variant={isActive ? "secondary" : "outline"}
                        size="sm"
                        onClick={() => setActiveManualGroup(option.group)}
                        disabled={isApproved}
                        className={cn(
                          "h-8 rounded-md px-3 text-sm",
                          !isActive && "text-muted-foreground"
                        )}
                      >
                        {option.title}
                      </Button>
                    )
                  })}
                </div>

                <div className="rounded-lg border border-border/70 bg-muted/20 p-3 sm:p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <label className="text-sm font-medium text-foreground">{activeManualGroupConfig.title}</label>
                    {activeManualGroup === "landing_fee" && effectiveLandingFeeAircraftTypeName ? (
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>
                          Aircraft type:{" "}
                          <span className="font-medium text-foreground">{effectiveLandingFeeAircraftTypeName}</span>
                          {isLandingFeeAircraftTypeOverridden ? " (override)" : ""}
                        </span>
                        <Button
                          type="button"
                          variant="link"
                          size="sm"
                          className="h-auto p-0 text-xs"
                          disabled={isApproved || landingFeeAircraftTypeOptions.length === 0}
                          onClick={() => setShowLandingFeeAircraftTypeEditor((prev) => !prev)}
                        >
                          {showLandingFeeAircraftTypeEditor ? "Done" : "Change"}
                        </Button>
                      </div>
                    ) : null}
                  </div>

                  {activeManualGroup === "landing_fee" && showLandingFeeAircraftTypeEditor ? (
                    <div className="mb-3 mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                      <Select
                        value={landingFeeAircraftTypeOverrideId ?? "auto"}
                        disabled={isApproved}
                        onValueChange={(value) =>
                          setLandingFeeAircraftTypeOverrideId(value === "auto" ? null : value)
                        }
                      >
                        <SelectTrigger className="h-9 w-full sm:w-72">
                          <SelectValue placeholder="Select aircraft type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="auto">
                            {selectedAircraftTypeName
                              ? `Checked-out type (${selectedAircraftTypeName})`
                              : "Use checked-out aircraft type"}
                          </SelectItem>
                          {landingFeeAircraftTypeOptions.map((aircraftTypeOption) => (
                            <SelectItem key={aircraftTypeOption.id} value={aircraftTypeOption.id}>
                              {aircraftTypeOption.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {landingFeeAircraftTypeOverrideId ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-9 w-full sm:w-auto"
                          disabled={isApproved}
                          onClick={() => setLandingFeeAircraftTypeOverrideId(null)}
                        >
                          Reset
                        </Button>
                      ) : null}
                    </div>
                  ) : null}

                  {activeScopedChargeables.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{activeManualGroupConfig.emptyText}</p>
                  ) : (
                    <div className="mt-3 space-y-1.5">
                      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
                        <div className="w-full sm:max-w-[380px]">
                          <ChargeableSearchDropdown
                            chargeables={activeScopedChargeables}
                            value={activeQuickAddState.chargeableId}
                            taxRate={taxRate}
                            resolveInclusiveRate={(chargeable) =>
                              getDefaultInclusiveRate(chargeable.id, activeManualGroup)
                            }
                            disabled={isApproved}
                            onSelect={(chargeable) => {
                              updateQuickAdd(activeManualGroup, {
                                chargeableId: chargeable?.id ?? "",
                                rateInclusive:
                                  chargeable != null
                                    ? getDefaultInclusiveRate(chargeable.id, activeManualGroup).toFixed(2)
                                    : "",
                              })
                            }}
                          />
                        </div>
                        <Input
                          type="number"
                          min={1}
                          step={1}
                          placeholder="Qty"
                          value={activeQuickAddState.quantity}
                          onChange={(event) => updateQuickAdd(activeManualGroup, { quantity: event.target.value })}
                          disabled={isApproved}
                          className="h-10 w-full text-right tabular-nums sm:w-20"
                          aria-label={`${activeManualGroupConfig.title} quantity`}
                        />
                        <div className="relative w-full sm:w-28">
                          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                            $
                          </span>
                          <Input
                            type="number"
                            min={0}
                            step={0.01}
                            placeholder="0.00"
                            value={activeQuickAddState.rateInclusive}
                            onChange={(event) => updateQuickAdd(activeManualGroup, { rateInclusive: event.target.value })}
                            disabled={isApproved}
                            className="h-10 pl-6 text-right tabular-nums"
                            aria-label={`${activeManualGroupConfig.title} rate`}
                          />
                        </div>
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => addManualItemForGroup(activeManualGroup)}
                          disabled={!canAddGroupItem(activeManualGroup)}
                          className="h-10 w-full sm:w-auto"
                        >
                          <IconPlus className="mr-1 h-4 w-4" />
                          Add
                        </Button>
                      </div>
                      {activeManualGroup === "landing_fee" && selectedActiveChargeable ? (
                        <p className="text-xs text-muted-foreground">
                          {usesAircraftLandingRate
                            ? `Rate from landing fee schedule for ${effectiveLandingFeeAircraftTypeName ?? "selected aircraft type"}.`
                            : effectiveLandingFeeAircraftTypeId
                              ? "No override for this aircraft type - using default rate."
                              : "Using default chargeable rate."}
                        </p>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <div className="ml-auto max-w-xs space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="tabular-nums">${invoiceBuilderTotals.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tax</span>
                  <span className="tabular-nums">${invoiceBuilderTotals.taxTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-t pt-1.5 text-base font-semibold">
                  <span>Total</span>
                  <span className="tabular-nums">${invoiceBuilderTotals.totalAmount.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end border-t pt-4">
              <Button type="button" onClick={() => void approveDraft()} disabled={!canApprove}>
                {isApproving ? (
                  <>
                    <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
                    Approving...
                  </>
                ) : (
                  <>
                    <IconCheck className="mr-2 h-4 w-4" />
                    Approve Check-In & Create Invoice
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconPlane className="h-4 w-4" />
              Finalized Check-In
            </CardTitle>
          </CardHeader>
          <CardContent>
            {checkinInvoiceId ? (
              invoiceLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <IconLoader2 className="h-4 w-4 animate-spin" />
                  Loading invoice details...
                </div>
              ) : invoice ? (
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="rounded-md border p-3">
                      <div className="text-xs uppercase text-muted-foreground">Invoice Number</div>
                      <div className="mt-1 font-semibold">{invoice.invoice_number || "Draft"}</div>
                    </div>
                    <div className="rounded-md border p-3">
                      <div className="text-xs uppercase text-muted-foreground">Total</div>
                      <div className="mt-1 font-semibold">${Number(invoice.total_amount || 0).toFixed(2)}</div>
                    </div>
                    <div className="rounded-md border p-3">
                      <div className="text-xs uppercase text-muted-foreground">Aircraft</div>
                      <div className="mt-1 font-semibold">{selectedAircraftLabel}</div>
                    </div>
                  </div>

                  <div className="overflow-x-auto rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Description</TableHead>
                          <TableHead className="text-right">Qty</TableHead>
                          <TableHead className="text-right">Rate</TableHead>
                          <TableHead className="text-right">Line Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {invoiceItems.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell>{item.description}</TableCell>
                            <TableCell className="text-right tabular-nums">{item.quantity.toFixed(2)}</TableCell>
                            <TableCell className="text-right tabular-nums">
                              ${(item.rate_inclusive ?? item.unit_price).toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              ${Number(item.line_total ?? 0).toFixed(2)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="flex justify-end">
                    <Button asChild variant="outline">
                      <Link href={`/invoices/${checkinInvoiceId}`}>View Full Invoice</Link>
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                  Failed to load invoice details.
                </div>
              )
            ) : null}
          </CardContent>
        </Card>

        {isApproved && !isCorrectionMode ? (
          <div className="flex items-center justify-between rounded-md border border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-950/30">
            <span className="text-sm text-green-800 dark:text-green-300">
              Check-in has been approved.
            </span>
            {isAdminOrInstructor ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={enterCorrectionMode}
                className="ml-3 shrink-0"
              >
                <IconEdit className="mr-2 h-3.5 w-3.5" />
                Correct Readings
              </Button>
            ) : null}
          </div>
        ) : null}

        {isCorrectionMode ? (
          <Card className="border-amber-300 bg-amber-50/50 dark:border-amber-700 dark:bg-amber-950/20">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <IconEdit className="h-4 w-4" />
                  Correct Flight Readings
                </CardTitle>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={exitCorrectionMode}
                  className="h-8 w-8"
                >
                  <IconX className="h-4 w-4" />
                </Button>
              </div>
              <CardDescription>
                Update end meter readings to fix an incorrect entry. Start readings are locked.
                The aircraft TTIS will be automatically adjusted.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <div className="hidden sm:grid sm:grid-cols-[140px_1fr_1fr_80px] max-w-xl gap-3 text-xs font-medium text-muted-foreground">
                  <div>Meter</div>
                  <div>Start (locked)</div>
                  <div>End (corrected)</div>
                  <div className="text-right">Delta</div>
                </div>

                {booking.hobbs_start != null ? (
                  <div className="grid items-center gap-3 sm:grid-cols-[140px_1fr_1fr_80px] max-w-xl">
                    <label className="flex items-center gap-2 text-sm font-medium">
                      <IconClock className="h-4 w-4 text-muted-foreground" />
                      Hobbs
                    </label>
                    <Input
                      value={String(booking.hobbs_start)}
                      disabled
                      className="h-9 tabular-nums bg-muted/50"
                    />
                    <Input
                      inputMode="decimal"
                      placeholder="0.0"
                      value={correctionHobbsEnd}
                      onChange={(e) => setCorrectionHobbsEnd(e.target.value)}
                      className="h-9 tabular-nums"
                    />
                    <div className={cn(
                      "text-right text-sm tabular-nums",
                      correctionHobbsDelta != null && correctionHobbsDelta !== calculateFlightHours(
                        Number(booking.hobbs_start), booking.hobbs_end != null ? Number(booking.hobbs_end) : null
                      )
                        ? "font-semibold text-amber-700 dark:text-amber-400"
                        : "text-muted-foreground"
                    )}>
                      {correctionHobbsDelta != null ? `${correctionHobbsDelta.toFixed(1)}h` : "—"}
                    </div>
                  </div>
                ) : null}

                {booking.tach_start != null ? (
                  <div className="grid items-center gap-3 sm:grid-cols-[140px_1fr_1fr_80px] max-w-xl">
                    <label className="flex items-center gap-2 text-sm font-medium">
                      <IconPlane className="h-4 w-4 text-muted-foreground" />
                      Tacho
                    </label>
                    <Input
                      value={String(booking.tach_start)}
                      disabled
                      className="h-9 tabular-nums bg-muted/50"
                    />
                    <Input
                      inputMode="decimal"
                      placeholder="0.0"
                      value={correctionTachEnd}
                      onChange={(e) => setCorrectionTachEnd(e.target.value)}
                      className="h-9 tabular-nums"
                    />
                    <div className={cn(
                      "text-right text-sm tabular-nums",
                      correctionTachDelta != null && correctionTachDelta !== calculateFlightHours(
                        Number(booking.tach_start), booking.tach_end != null ? Number(booking.tach_end) : null
                      )
                        ? "font-semibold text-amber-700 dark:text-amber-400"
                        : "text-muted-foreground"
                    )}>
                      {correctionTachDelta != null ? `${correctionTachDelta.toFixed(1)}h` : "—"}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  Reason for Correction <span className="text-destructive">*</span>
                </label>
                <Textarea
                  placeholder="Explain why the readings need to be corrected (min 10 characters)..."
                  value={correctionReason}
                  onChange={(e) => setCorrectionReason(e.target.value)}
                  className="min-h-[80px] resize-y"
                />
                {correctionReason.length > 0 && correctionReason.trim().length < 10 ? (
                  <p className="text-xs text-destructive">
                    Reason must be at least 10 characters ({correctionReason.trim().length}/10)
                  </p>
                ) : null}
              </div>

              <div className="flex items-center gap-3 border-t border-amber-200 pt-4 dark:border-amber-800">
                <Button
                  type="button"
                  onClick={() => void submitCorrection()}
                  disabled={!canSubmitCorrection}
                >
                  {isCorrecting ? (
                    <>
                      <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
                      Applying...
                    </>
                  ) : (
                    <>
                      <IconCheck className="mr-2 h-4 w-4" />
                      Apply Correction
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={exitCorrectionMode}
                  disabled={isCorrecting}
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {isApproved && booking.corrected_at ? (
          <div className="rounded-md border border-amber-200 bg-amber-50/60 p-3 dark:border-amber-800 dark:bg-amber-950/20">
            <div className="flex items-start gap-2 text-sm text-amber-800 dark:text-amber-300">
              <IconAlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <span className="font-medium">Readings corrected</span>
                {" on "}
                {new Date(booking.corrected_at).toLocaleString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
                {booking.correction_reason ? (
                  <span className="text-amber-700 dark:text-amber-400">
                    {" — "}{booking.correction_reason}
                  </span>
                ) : null}
                {booking.correction_delta != null ? (
                  <span className="ml-1 text-xs text-amber-600 dark:text-amber-500">
                    (TTIS adjustment: {Number(booking.correction_delta) >= 0 ? "+" : ""}
                    {Number(booking.correction_delta).toFixed(1)}h)
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
