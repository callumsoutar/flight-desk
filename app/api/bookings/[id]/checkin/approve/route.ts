import { revalidatePath } from "next/cache"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { getAuthSession } from "@/lib/auth/session"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

const itemSchema = z.object({
  chargeable_id: z.string().uuid().nullable().optional(),
  description: z.string().min(1).max(400),
  quantity: z.number().positive(),
  unit_price: z.number().nonnegative(),
  tax_rate: z.number().min(0).max(1).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
})

const payloadSchema = z.object({
  checked_out_aircraft_id: z.string().uuid(),
  checked_out_instructor_id: z.string().uuid().nullable().optional(),
  flight_type_id: z.string().uuid(),

  hobbs_start: z.number().nullable().optional(),
  hobbs_end: z.number().nullable().optional(),
  tach_start: z.number().nullable().optional(),
  tach_end: z.number().nullable().optional(),
  airswitch_start: z.number().nullable().optional(),
  airswitch_end: z.number().nullable().optional(),

  solo_end_hobbs: z.number().nullable().optional(),
  solo_end_tach: z.number().nullable().optional(),
  dual_time: z.number().nullable().optional(),
  solo_time: z.number().nullable().optional(),

  billing_basis: z.string().min(1),
  billing_hours: z.number().positive(),
  tax_rate: z.number().min(0).max(1).optional(),
  due_date: z.string().datetime({ offset: true }).optional(),
  reference: z.string().max(200).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  items: z.array(itemSchema).min(1),
})

type RpcResult = {
  success: boolean
  error?: string
  message?: string
  booking_id?: string
  invoice_id?: string
  invoice_number?: string
  applied_aircraft_delta?: number
  total_hours_start?: number
  total_hours_end?: number
}

const NO_STORE = { "cache-control": "no-store" } as const

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const parsed = payloadSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.issues },
      { status: 400, headers: NO_STORE }
    )
  }

  const supabase = await createSupabaseServerClient()
  const { user, tenantId } = await getAuthSession(supabase, {
    includeRole: true,
    includeTenant: true,
    requireUser: true,
    authoritativeRole: true,
    authoritativeTenant: true,
  })

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE })
  }
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 400, headers: NO_STORE })
  }

  const { id: bookingId } = await context.params
  const payload = parsed.data

  const dueDate = payload.due_date
    ? payload.due_date
    : new Date(Date.now() + 7 * 86_400_000).toISOString()

  const rpcItems = payload.items.map((item) => ({
    chargeable_id: item.chargeable_id ?? null,
    description: item.description,
    quantity: item.quantity,
    unit_price: item.unit_price,
    tax_rate: item.tax_rate ?? null,
    notes: item.notes ?? null,
  }))

  const { data: result, error: rpcError } = await supabase.rpc(
    "approve_booking_checkin_atomic",
    {
      p_booking_id: bookingId,
      p_checked_out_aircraft_id: payload.checked_out_aircraft_id,
      p_checked_out_instructor_id: payload.checked_out_instructor_id ?? null,
      p_flight_type_id: payload.flight_type_id,
      p_hobbs_start: payload.hobbs_start ?? null,
      p_hobbs_end: payload.hobbs_end ?? null,
      p_tach_start: payload.tach_start ?? null,
      p_tach_end: payload.tach_end ?? null,
      p_airswitch_start: payload.airswitch_start ?? null,
      p_airswitch_end: payload.airswitch_end ?? null,
      p_solo_end_hobbs: payload.solo_end_hobbs ?? null,
      p_solo_end_tach: payload.solo_end_tach ?? null,
      p_dual_time: payload.dual_time ?? null,
      p_solo_time: payload.solo_time ?? null,
      p_billing_basis: payload.billing_basis,
      p_billing_hours: payload.billing_hours,
      p_tax_rate: payload.tax_rate ?? null,
      p_due_date: dueDate,
      p_reference: payload.reference ?? `Booking ${bookingId} check-in`,
      p_notes: payload.notes ?? "Auto-generated from booking check-in.",
      p_items: rpcItems,
    }
  )

  if (rpcError) {
    return NextResponse.json(
      { error: rpcError.message ?? "Check-in approval failed" },
      { status: 500, headers: NO_STORE }
    )
  }

  const rpcResult = result as RpcResult | null
  if (!rpcResult?.success) {
    const errorKey = rpcResult?.error
    const status =
      errorKey === "Unauthorized" ? 401
      : errorKey === "Forbidden" ? 403
      : errorKey === "Not found" ? 404
      : errorKey === "Already approved" || errorKey === "Invoice already exists" ? 409
      : 400

    return NextResponse.json(
      { error: errorKey ?? "Check-in approval failed", message: rpcResult?.message },
      { status, headers: NO_STORE }
    )
  }

  const invoiceId = rpcResult.invoice_id

  revalidatePath("/bookings")
  revalidatePath(`/bookings/${bookingId}`)
  revalidatePath(`/bookings/checkin/${bookingId}`)
  if (invoiceId) revalidatePath(`/invoices/${invoiceId}`)
  revalidatePath("/invoices")

  return NextResponse.json(
    {
      invoice: { id: invoiceId },
      applied_aircraft_delta: rpcResult.applied_aircraft_delta,
      total_hours_start: rpcResult.total_hours_start,
      total_hours_end: rpcResult.total_hours_end,
    },
    { headers: NO_STORE }
  )
}
