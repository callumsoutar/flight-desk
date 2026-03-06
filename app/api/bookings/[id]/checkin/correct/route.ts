import { revalidatePath } from "next/cache"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { getAuthSession } from "@/lib/auth/session"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

const payloadSchema = z.object({
  hobbs_end: z.number().nullable().optional(),
  tach_end: z.number().nullable().optional(),
  airswitch_end: z.number().nullable().optional(),
  correction_reason: z.string().min(10, "Correction reason must be at least 10 characters").max(2000),
})

type RpcResult = {
  success: boolean
  error?: string
  message?: string
  booking_id?: string
  old_applied_delta?: number
  new_applied_delta?: number
  correction_delta?: number
  aircraft_total_time_in_service?: number
  is_most_recent_booking?: boolean
  updated_current_meters?: boolean
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

  // The RPC accepts NULL for unused meters (skips delta calculation),
  // but generated Supabase types mark them as non-nullable.
  const rpcArgs = {
    p_booking_id: bookingId,
    p_hobbs_end: payload.hobbs_end ?? null,
    p_tach_end: payload.tach_end ?? null,
    p_airswitch_end: payload.airswitch_end ?? null,
    p_correction_reason: payload.correction_reason,
  } as { p_booking_id: string; p_hobbs_end: number; p_tach_end: number; p_airswitch_end: number; p_correction_reason: string }

  const { data: result, error: rpcError } = await supabase.rpc(
    "correct_booking_checkin_ttis_atomic",
    rpcArgs
  )

  if (rpcError) {
    return NextResponse.json(
      { error: rpcError.message ?? "Correction failed" },
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
      : 400

    return NextResponse.json(
      { error: errorKey ?? "Correction failed", message: rpcResult?.message },
      { status, headers: NO_STORE }
    )
  }

  revalidatePath("/bookings")
  revalidatePath(`/bookings/${bookingId}`)
  revalidatePath(`/bookings/checkin/${bookingId}`)
  revalidatePath("/aircraft")

  return NextResponse.json(
    {
      booking_id: rpcResult.booking_id,
      correction_delta: rpcResult.correction_delta,
      new_applied_delta: rpcResult.new_applied_delta,
      aircraft_total_time_in_service: rpcResult.aircraft_total_time_in_service,
    },
    { headers: NO_STORE }
  )
}
