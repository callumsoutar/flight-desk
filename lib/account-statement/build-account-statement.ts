import type { SupabaseClient } from "@supabase/supabase-js"

import type { AccountStatementEntry, AccountStatementResponse } from "@/lib/types/account-statement"
import type { Database } from "@/lib/types/database"

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

function toDateOnly(isoOrDate: string): string {
  const d = new Date(isoOrDate)
  if (Number.isNaN(d.getTime())) return ""
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

export async function buildAccountStatement(
  supabase: SupabaseClient<Database>,
  options: {
    tenantId: string
    targetUserId: string
    startDate?: string | null
    endDate?: string | null
  }
): Promise<{ ok: true; data: AccountStatementResponse } | { ok: false; error: "not_found" | "query_failed" }> {
  const { tenantId, targetUserId, startDate, endDate } = options

  const { data: tenantMember, error: tenantMemberError } = await supabase
    .from("tenant_users")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("user_id", targetUserId)
    .maybeSingle()

  if (tenantMemberError) {
    return { ok: false, error: "query_failed" }
  }

  if (!tenantMember) {
    return { ok: false, error: "not_found" }
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
    return { ok: false, error: "query_failed" }
  }

  const entries: SortableAccountStatementEntry[] = []

  for (const invoice of (invoicesResult.data ?? []) as InvoiceStatementRow[]) {
    const totalAmount =
      typeof invoice.total_amount === "number"
        ? invoice.total_amount
        : (invoice.subtotal ?? 0) + (invoice.tax_total ?? 0)

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
      reference: payment.payment_reference?.trim() || `PAY-${payment.id.slice(0, 8).toUpperCase()}`,
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

  const useDateRange =
    typeof startDate === "string" &&
    startDate.trim() !== "" &&
    typeof endDate === "string" &&
    endDate.trim() !== ""

  let statement: AccountStatementEntry[]
  let closingBalance: number

  if (useDateRange) {
    const safeStartDate = startDate.trim()
    const safeEndDate = endDate.trim()

    let openingBalance = 0
    const filtered: SortableAccountStatementEntry[] = []
    for (const entry of entries) {
      const dateOnly = toDateOnly(entry.date)
      if (dateOnly < safeStartDate) {
        openingBalance += entry.amount
      } else if (dateOnly >= safeStartDate && dateOnly <= safeEndDate) {
        filtered.push(entry)
      }
    }

    const openingRow: AccountStatementEntry = {
      entry_id: `opening-${safeStartDate}`,
      entry_type: "opening_balance",
      date: `${safeStartDate}T00:00:00.000Z`,
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

  return {
    ok: true,
    data: {
      statement,
      closing_balance: closingBalance,
    },
  }
}
