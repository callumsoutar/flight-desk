import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { isStaffRole } from "@/lib/auth/roles"
import { getAuthSession } from "@/lib/auth/session"
import { createBookingInTenant, createBookingPayloadSchema } from "@/lib/bookings/create-booking"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

const createRecurringBookingsSchema = createBookingPayloadSchema
  .omit({ start_time: true, end_time: true })
  .extend({
    occurrences: z
      .array(
        z.object({
          start_time: z.string(),
          end_time: z.string(),
        })
      )
      .min(1)
      .max(366),
  })

function resolveBatchStatus({
  total,
  createdCount,
  failures,
}: {
  total: number
  createdCount: number
  failures: Array<{ status: number }>
}) {
  if (createdCount === total) return 201
  if (createdCount > 0) return 207
  const statuses = failures.map((f) => f.status)
  if (statuses.includes(500)) return 500
  if (statuses.includes(403)) return 403
  if (statuses.includes(404)) return 404
  if (statuses.includes(409)) return 409
  if (statuses.includes(400)) return 400
  return 409
}

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { user, role, tenantId } = await getAuthSession(supabase, {
    includeRole: true,
    includeTenant: true,
    requireUser: true,
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

  const parsed = createRecurringBookingsSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload" },
      { status: 400, headers: { "cache-control": "no-store" } }
    )
  }

  const { occurrences, ...common } = parsed.data

  const staff = isStaffRole(role)
  if (!staff && common.user_id && common.user_id !== user.id) {
    return NextResponse.json(
      { error: "You can only create bookings for yourself" },
      { status: 403, headers: { "cache-control": "no-store" } }
    )
  }
  if ((common.status ?? "unconfirmed") === "confirmed" && !staff) {
    return NextResponse.json(
      { error: "Only staff can create confirmed bookings." },
      { status: 403, headers: { "cache-control": "no-store" } }
    )
  }

  const created: unknown[] = []
  const failed: Array<{ start_time: string; end_time: string; status: number; error: string }> = []

  for (const occ of occurrences) {
    const payload = { ...common, start_time: occ.start_time, end_time: occ.end_time }
    const result = await createBookingInTenant({ supabase, tenantId, user, role, payload })

    if (result.ok) {
      created.push(result.booking)
      continue
    }

    failed.push({
      start_time: occ.start_time,
      end_time: occ.end_time,
      status: result.status,
      error: result.error,
    })
  }

  const status = resolveBatchStatus({ total: occurrences.length, createdCount: created.length, failures: failed })

  return NextResponse.json(
    {
      requestedCount: occurrences.length,
      createdCount: created.length,
      failedCount: failed.length,
      created,
      failed,
    },
    { status, headers: { "cache-control": "no-store" } }
  )
}

