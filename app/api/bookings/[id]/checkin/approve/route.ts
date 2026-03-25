import { revalidatePath } from "next/cache"
import { NextRequest, NextResponse } from "next/server"
import { render } from "@react-email/render"
import { z } from "zod"

import { getAuthSession } from "@/lib/auth/session"
import { getTriggerConfig } from "@/lib/email/get-trigger-config"
import { interpolateSubject } from "@/lib/email/interpolate-subject"
import { sendEmail } from "@/lib/email/send-email"
import { CheckinApprovedEmail } from "@/lib/email/templates/checkin-approved"
import { EMAIL_TRIGGER_KEYS } from "@/lib/email/trigger-keys"
import { invalidPayloadResponse } from "@/lib/security/http"
import { logError } from "@/lib/security/logger"
import { fetchInvoicingSettings } from "@/lib/settings/fetch-invoicing-settings"
import { fetchXeroSettings } from "@/lib/settings/fetch-xero-settings"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

const itemSchema = z.strictObject({
  chargeable_id: z.string().uuid().nullable().optional(),
  description: z.string().min(1).max(400),
  quantity: z.number().positive(),
  unit_price: z.number().nonnegative(),
  tax_rate: z.number().min(0).max(1).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
})

const payloadSchema = z.strictObject({
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
    return invalidPayloadResponse()
  }

  const supabase = await createSupabaseServerClient()
  const { user, role, tenantId } = await getAuthSession(supabase, {
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
  if (!role || !["owner", "admin", "instructor"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: NO_STORE })
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
    logError("[checkin/approve] RPC error", { error: rpcError.message, tenantId, bookingId })
    return NextResponse.json(
      { error: "Check-in approval failed" },
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
    const [invoicingSettings, xeroSettings] = await Promise.all([
      fetchInvoicingSettings(supabase, tenantId).catch(() => null),
      fetchXeroSettings(supabase, tenantId).catch(() => null),
    ])
    const defaultTaxType = xeroSettings?.default_tax_type ?? null

    const { data: invoiceItems } = await supabase
      .from("invoice_items")
      .select("id, chargeable_id, description, tax_rate")
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
          .select("id, chargeable_type_id, gl_code, xero_tax_type")
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
          .select("id, code, gl_code")
          .or(`tenant_id.eq.${tenantId},scope.eq.system`)
          .in("id", chargeableTypeIds)
      : { data: [] }

    const chargeableById = new Map((chargeables ?? []).map((row) => [row.id, row]))
    const chargeableTypeById = new Map((chargeableTypes ?? []).map((row) => [row.id, row]))

    const itemUpdates = (invoiceItems ?? []).map((item) => {
      let glCode: string | null = null
      let xeroTaxType: string | null = (item.tax_rate ?? 0) > 0 ? defaultTaxType : null
      if (item.chargeable_id) {
        const chargeable = chargeableById.get(item.chargeable_id)
        xeroTaxType = (item.tax_rate ?? 0) > 0 ? chargeable?.xero_tax_type ?? defaultTaxType : null
        if (chargeable?.chargeable_type_id) {
          const chargeableType = chargeableTypeById.get(chargeable.chargeable_type_id)
          if (chargeableType?.code === "landing_fees") {
            glCode = invoicingSettings?.landing_fee_gl_code || null
          } else if (chargeableType?.code === "airways_fees") {
            glCode = invoicingSettings?.airways_fee_gl_code || null
          } else {
            glCode = chargeable.gl_code ?? chargeableType?.gl_code ?? null
          }
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

      return { id: item.id, gl_code: glCode, xero_tax_type: xeroTaxType }
    })

    await Promise.all(
      itemUpdates
        .filter((item) => item.gl_code || item.xero_tax_type)
        .map((item) =>
          supabase
            .from("invoice_items")
            .update({
              gl_code: item.gl_code ?? null,
              xero_tax_type: item.xero_tax_type ?? null,
            })
            .eq("id", item.id)
        )
    )
  }

  if (invoiceId) {
    try {
      const triggerConfig = await getTriggerConfig(supabase, tenantId, EMAIL_TRIGGER_KEYS.CHECKIN_APPROVED)
      if (triggerConfig.is_enabled) {
        const [{ data: tenant }, { data: booking }, { data: invoice }] = await Promise.all([
          supabase
            .from("tenants")
            .select("name, logo_url, contact_email, timezone, currency")
            .eq("id", tenantId)
            .maybeSingle(),
          supabase
            .from("bookings")
            .select(
              "id, user_id, start_time, checked_out_aircraft:aircraft!bookings_checked_out_aircraft_id_fkey(registration), aircraft:aircraft!bookings_aircraft_id_fkey(registration), student:user_directory!bookings_user_id_fkey(first_name, email), instructor:instructors!bookings_instructor_id_fkey(first_name, last_name, user:user_directory!instructors_user_id_fkey(email))"
            )
            .eq("tenant_id", tenantId)
            .eq("id", bookingId)
            .maybeSingle(),
          supabase
            .from("invoices")
            .select("id, user_id, invoice_number, total_amount, due_date")
            .eq("tenant_id", tenantId)
            .eq("id", invoiceId)
            .maybeSingle(),
        ])

        const member = (booking?.student as { first_name?: string | null; email?: string | null } | null) ?? null
        const memberEmail = member?.email ?? null
        const memberFirstName = member?.first_name ?? "there"
        const instructorEmail =
          (booking?.instructor as { user?: { email?: string | null } | null } | null)?.user?.email ??
          null

        if (memberEmail) {
          const timezone = tenant?.timezone ?? "Pacific/Auckland"
          const flightDate = new Intl.DateTimeFormat("en-NZ", {
            timeZone: timezone,
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          }).format(new Date(String(booking?.start_time ?? new Date().toISOString())))
          const invoiceUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/invoices/${invoiceId}`

          const html = await render(
            CheckinApprovedEmail({
              tenantName: tenant?.name ?? "Your Aero Club",
              logoUrl: tenant?.logo_url,
              memberFirstName,
              bookingId,
              flightDate,
              aircraftRegistration:
                ((booking?.checked_out_aircraft as { registration?: string | null } | null)?.registration ??
                  (booking?.aircraft as { registration?: string | null } | null)?.registration ??
                  null),
              invoiceNumber: invoice?.invoice_number ?? null,
              invoiceTotal: invoice?.total_amount ?? null,
              currency: tenant?.currency ?? "NZD",
              invoiceUrl,
              dueDate: invoice?.due_date ?? null,
            })
          )

          const subject = triggerConfig.subject_template
            ? interpolateSubject(triggerConfig.subject_template, {
                tenantName: tenant?.name ?? undefined,
                memberFirstName,
                bookingId,
                invoiceNumber: invoice?.invoice_number ?? undefined,
                flightDate,
              })
            : `Flight Complete - Invoice ${invoice?.invoice_number ?? "Ready"}`

          await sendEmail({
            supabase,
            tenantId,
            triggerKey: EMAIL_TRIGGER_KEYS.CHECKIN_APPROVED,
            to: memberEmail,
            subject,
            html,
            bookingId,
            invoiceId,
            userId: invoice?.user_id ?? booking?.user_id ?? undefined,
            triggeredBy: user.id,
            fromName: triggerConfig.from_name ?? tenant?.name ?? undefined,
            replyTo: triggerConfig.reply_to ?? tenant?.contact_email ?? undefined,
            cc: triggerConfig.cc_emails,
          })

          if (triggerConfig.notify_instructor && instructorEmail) {
            await sendEmail({
              supabase,
              tenantId,
              triggerKey: EMAIL_TRIGGER_KEYS.CHECKIN_APPROVED,
              to: instructorEmail,
              subject,
              html,
              bookingId,
              invoiceId,
              userId: invoice?.user_id ?? booking?.user_id ?? undefined,
              triggeredBy: user.id,
              fromName: triggerConfig.from_name ?? tenant?.name ?? undefined,
              replyTo: triggerConfig.reply_to ?? tenant?.contact_email ?? undefined,
              cc: triggerConfig.cc_emails,
            })
          }
        }
      }
    } catch (emailErr) {
      logError("[email] Trigger send failed (non-fatal)", { error: emailErr, tenantId, bookingId })
    }
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
