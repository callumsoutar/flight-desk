import { NextRequest, NextResponse } from "next/server"

import { isStaffRole } from "@/lib/auth/roles"
import { getAuthSession } from "@/lib/auth/session"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import type { AccountStatementEntry, AccountStatementResponse } from "@/lib/types/account-statement"

export const dynamic = "force-dynamic"

type SortableAccountStatementEntry = AccountStatementEntry & {
  sort_ts: number
  created_ts: number
}

type InvoiceBookingSummary = {
  purpose: string | null
  booking_type: string | null
  route: string | null
  lesson: { name: string | null } | null
  flight_type: { name: string | null } | null
  aircraft: {
    registration: string | null
    type: string | null
    model: string | null
    manufacturer: string | null
  } | null
}

type InvoiceStatementRow = {
  id: string
  issue_date: string | null
  created_at: string | null
  invoice_number: string | null
  reference: string | null
  total_amount: number | null
  subtotal: number | null
  tax_total: number | null
  booking: InvoiceBookingSummary | null
}

function parseDateValue(value: string | null | undefined): number {
  if (!value) return Number.MAX_SAFE_INTEGER
  const date = new Date(value)
  const ts = date.getTime()
  return Number.isNaN(ts) ? Number.MAX_SAFE_INTEGER : ts
}

function getBookingDescription(booking: InvoiceBookingSummary | null): string | null {
  if (!booking) return null

  const primary =
    booking.lesson?.name?.trim() ||
    booking.flight_type?.name?.trim() ||
    booking.purpose?.trim() ||
    booking.route?.trim()

  return primary || (booking.booking_type ? booking.booking_type.replaceAll("_", " ") : "Booking")
}

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { user, role, tenantId } = await getAuthSession(supabase, {
    requireUser: true,
    includeRole: true,
    includeTenant: true,
    authoritativeRole: true,
    authoritativeTenant: true,
  })

  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: { "cache-control": "no-store" } }
    )
  }
  if (!tenantId) {
    return NextResponse.json(
      { error: "Account not configured" },
      { status: 400, headers: { "cache-control": "no-store" } }
    )
  }

  const userIdParam = request.nextUrl.searchParams.get("user_id")
  const targetUserId = userIdParam ?? user.id
  const startDateParam = request.nextUrl.searchParams.get("start_date")
  const endDateParam = request.nextUrl.searchParams.get("end_date")

  const canViewOtherMembers = isStaffRole(role)
  if (targetUserId !== user.id && !canViewOtherMembers) {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403, headers: { "cache-control": "no-store" } }
    )
  }

  const { data: tenantMember, error: tenantMemberError } = await supabase
    .from("tenant_users")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("user_id", targetUserId)
    .maybeSingle()

  if (tenantMemberError) {
    return NextResponse.json(
      { error: "Failed to validate member access" },
      { status: 500, headers: { "cache-control": "no-store" } }
    )
  }

  if (!tenantMember) {
    return NextResponse.json(
      { error: "Member not found" },
      { status: 404, headers: { "cache-control": "no-store" } }
    )
  }

  const [invoicesResult, paymentsResult, creditsResult] = await Promise.all([
    supabase
      .from("invoices")
      .select(
        "id, issue_date, created_at, invoice_number, reference, total_amount, subtotal, tax_total, booking:bookings!invoices_booking_id_fkey(purpose, booking_type, route, lesson:lessons!bookings_lesson_id_fkey(name), flight_type:flight_types!bookings_flight_type_id_fkey(name), aircraft:aircraft!bookings_aircraft_id_fkey(registration, type, model, manufacturer))"
      )
      .eq("tenant_id", tenantId)
      .eq("user_id", targetUserId)
      .is("deleted_at", null),
    supabase
      .from("invoice_payments")
      .select("id, paid_at, created_at, amount, payment_method, payment_reference, notes")
      .eq("tenant_id", tenantId)
      .eq("user_id", targetUserId),
    supabase
      .from("transactions")
      .select("id, amount, description, reference_number, completed_at, created_at")
      .eq("tenant_id", tenantId)
      .eq("user_id", targetUserId)
      .eq("status", "completed")
      .eq("type", "credit")
      .contains("metadata", { transaction_type: "member_credit_topup" }),
  ])

  if (invoicesResult.error || paymentsResult.error || creditsResult.error) {
    return NextResponse.json(
      { error: "Failed to load account statement" },
      { status: 500, headers: { "cache-control": "no-store" } }
    )
  }

  const entries: SortableAccountStatementEntry[] = []

  for (const invoice of (invoicesResult.data ?? []) as InvoiceStatementRow[]) {
    const totalAmount =
      typeof invoice.total_amount === "number"
        ? invoice.total_amount
        : (invoice.subtotal ?? 0) + (invoice.tax_total ?? 0)

    // For account history, use when the invoice record was created.
    // `issue_date` is often date-only and can collapse multiple actions to midnight.
    const eventDate = invoice.created_at ?? invoice.issue_date ?? new Date(0).toISOString()
    const bookingDescription = getBookingDescription(invoice.booking)

    entries.push({
      entry_id: invoice.id,
      entry_type: "invoice",
      date: eventDate,
      reference: invoice.invoice_number ?? `INV-${invoice.id.slice(0, 8).toUpperCase()}`,
      description: bookingDescription || invoice.reference?.trim() || "Invoice",
      amount: totalAmount,
      balance: 0,
      sort_ts: parseDateValue(eventDate),
      created_ts: parseDateValue(invoice.created_at),
    })
  }

  for (const payment of paymentsResult.data ?? []) {
    const methodLabel = (payment.payment_method ?? "other")
      .replaceAll("_", " ")
      .replace(/\b\w/g, (ch) => ch.toUpperCase())

    const eventDate = payment.paid_at ?? payment.created_at ?? new Date(0).toISOString()

    entries.push({
      entry_id: payment.id,
      entry_type: "payment",
      date: eventDate,
      reference:
        payment.payment_reference?.trim() || `PAY-${payment.id.slice(0, 8).toUpperCase()}`,
      description: payment.notes?.trim() || `Payment (${methodLabel})`,
      amount: -Math.abs(payment.amount),
      balance: 0,
      sort_ts: parseDateValue(eventDate),
      created_ts: parseDateValue(payment.created_at),
    })
  }

  for (const credit of creditsResult.data ?? []) {
    const eventDate = credit.completed_at ?? credit.created_at ?? new Date(0).toISOString()

    entries.push({
      entry_id: credit.id,
      entry_type: "credit_note",
      date: eventDate,
      reference: credit.reference_number?.trim() || `CR-${credit.id.slice(0, 8).toUpperCase()}`,
      description: credit.description?.trim() || "Member credit top-up",
      amount: -Math.abs(credit.amount),
      balance: 0,
      sort_ts: parseDateValue(eventDate),
      created_ts: parseDateValue(credit.created_at),
    })
  }

  entries.sort((a, b) => {
    const eventDiff = a.sort_ts - b.sort_ts
    if (eventDiff !== 0) return eventDiff

    const createdDiff = a.created_ts - b.created_ts
    if (createdDiff !== 0) return createdDiff

    return a.entry_id.localeCompare(b.entry_id)
  })

  function toDateOnly(isoOrDate: string): string {
    const d = new Date(isoOrDate)
    if (Number.isNaN(d.getTime())) return ""
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, "0")
    const day = String(d.getDate()).padStart(2, "0")
    return `${y}-${m}-${day}`
  }

  const useDateRange =
    typeof startDateParam === "string" &&
    startDateParam.trim() !== "" &&
    typeof endDateParam === "string" &&
    endDateParam.trim() !== ""

  let statement: AccountStatementEntry[]
  let closingBalance: number

  if (useDateRange) {
    const startDate = startDateParam.trim()
    const endDate = endDateParam.trim()

    let openingBalance = 0
    const filtered: SortableAccountStatementEntry[] = []
    for (const entry of entries) {
      const dateOnly = toDateOnly(entry.date)
      if (dateOnly < startDate) {
        openingBalance += entry.amount
      } else if (dateOnly >= startDate && dateOnly <= endDate) {
        filtered.push(entry)
      }
    }

    const openingRow: AccountStatementEntry = {
      entry_id: `opening-${startDate}`,
      entry_type: "opening_balance",
      date: `${startDate}T00:00:00.000Z`,
      reference: "Opening balance",
      description: "Balance at start of period",
      amount: 0,
      balance: Number(openingBalance.toFixed(2)),
    }

    let runningBalance = openingBalance
    const rangedRows = filtered.map((entry) => {
      runningBalance += entry.amount
      return {
        entry_id: entry.entry_id,
        entry_type: entry.entry_type,
        date: entry.date,
        reference: entry.reference,
        description: entry.description,
        amount: entry.amount,
        balance: Number(runningBalance.toFixed(2)),
      }
    })

    statement = [openingRow, ...rangedRows]
    closingBalance = Number(runningBalance.toFixed(2))
  } else {
    let runningBalance = 0
    statement = entries.map((entry) => {
      runningBalance += entry.amount
      return {
        entry_id: entry.entry_id,
        entry_type: entry.entry_type,
        date: entry.date,
        reference: entry.reference,
        description: entry.description,
        amount: entry.amount,
        balance: Number(runningBalance.toFixed(2)),
      }
    })
    closingBalance = Number(runningBalance.toFixed(2))
  }

  const payload: AccountStatementResponse = {
    statement,
    closing_balance: closingBalance,
  }

  return NextResponse.json(payload, {
    headers: { "cache-control": "no-store" },
  })
}
