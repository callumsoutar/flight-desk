import { revalidatePath } from "next/cache"
import { NextRequest } from "next/server"
import { z } from "zod"

import { getTenantScopedRouteContext, noStoreJson } from "@/lib/api/tenant-route"
import { invalidPayloadResponse } from "@/lib/security/http"
import { logError } from "@/lib/security/logger"

export const dynamic = "force-dynamic"

const payloadSchema = z.strictObject({
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

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const parsed = payloadSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return invalidPayloadResponse()
  }

  const session = await getTenantScopedRouteContext()
  if (session.response) return session.response
  const { supabase } = session.context

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
    logError("[checkin/correct] RPC error", { error: rpcError.message, bookingId })
    return noStoreJson({ error: "Correction failed" }, { status: 500 })
  }

  const rpcResult = result as RpcResult | null
  if (!rpcResult?.success) {
    const errorKey = rpcResult?.error
    const status =
      errorKey === "Unauthorized" ? 401
      : errorKey === "Forbidden" ? 403
      : errorKey === "Not found" ? 404
      : 400

    return noStoreJson(
      { error: errorKey ?? "Correction failed", message: rpcResult?.message },
      { status }
    )
  }

  revalidatePath("/bookings")
  revalidatePath(`/bookings/${bookingId}`)
  revalidatePath(`/bookings/checkin/${bookingId}`)
  revalidatePath("/aircraft")

  return noStoreJson(
    {
      booking_id: rpcResult.booking_id,
      correction_delta: rpcResult.correction_delta,
      new_applied_delta: rpcResult.new_applied_delta,
      aircraft_total_time_in_service: rpcResult.aircraft_total_time_in_service,
    },
    {}
  )
}
