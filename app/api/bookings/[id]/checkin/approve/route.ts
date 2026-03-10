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
    return NextResponse.json({ error: "Account not configured" }, { status: 400, headers: NO_STORE })
  }

  const { id: bookingId } = await context.params
  const payload = parsed.data

  const dueDate = payload.due_date
    ? payload.due_date
    : new Date(Date.now() + 7 * 86_400_000).toISOString()

  const { data: selectedFlightType } = await supabase
    .from("flight_types")
    .select("instruction_type, aircraft_gl_code, instructor_gl_code")
    .eq("tenant_id", tenantId)
    .eq("id", payload.flight_type_id)
    .is("voided_at", null)
    .maybeSingle()

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
      p_checked_out_instructor_id: (payload.checked_out_instructor_id ?? null) as unknown as string,
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
    } as never
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

  if (invoiceId) {
    const { data: invoiceItems } = await supabase
      .from("invoice_items")
      .select("id, chargeable_id, description")
      .eq("tenant_id", tenantId)
      .eq("invoice_id", invoiceId)
      .is("deleted_at", null)

    const chargeableIds = Array.from(
      new Set(
        (invoiceItems ?? [])
          .map((item) => item.chargeable_id)
          .filter((value): value is string => typeof value === "string")
      )
    )
    const { data: chargeables } = chargeableIds.length
      ? await supabase
          .from("chargeables")
          .select("id, chargeable_type_id")
          .eq("tenant_id", tenantId)
          .in("id", chargeableIds)
      : { data: [] }

    const chargeableTypeIds = Array.from(
      new Set(
        (chargeables ?? [])
          .map((item) => item.chargeable_type_id)
          .filter((value): value is string => typeof value === "string")
      )
    )
    const { data: chargeableTypes } = chargeableTypeIds.length
      ? await supabase
          .from("chargeable_types")
          .select("id, gl_code")
          .or(`tenant_id.eq.${tenantId},is_global.eq.true`)
          .in("id", chargeableTypeIds)
      : { data: [] }

    const chargeableById = new Map((chargeables ?? []).map((row) => [row.id, row]))
    const typeGlById = new Map((chargeableTypes ?? []).map((row) => [row.id, row.gl_code ?? null]))

    const itemUpdates = (invoiceItems ?? []).map((item) => {
      let glCode: string | null = null
      if (item.chargeable_id) {
        const chargeable = chargeableById.get(item.chargeable_id)
        if (chargeable?.chargeable_type_id) {
          glCode = typeGlById.get(chargeable.chargeable_type_id) ?? null
        }
      } else {
        const desc = (item.description ?? "").toLowerCase()
        if (desc.includes("aircraft hire")) {
          glCode = selectedFlightType?.aircraft_gl_code ?? null
        } else if (
          desc.includes("instructor rate") &&
          selectedFlightType?.instruction_type !== "solo"
        ) {
          glCode = selectedFlightType?.instructor_gl_code ?? null
        }
      }

      return { id: item.id, gl_code: glCode }
    })

    await Promise.all(
      itemUpdates
        .filter((item) => item.gl_code)
        .map((item) => supabase.from("invoice_items").update({ gl_code: item.gl_code }).eq("id", item.id))
    )
  }

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
