import { NextRequest } from "next/server"
import { z } from "zod"

import { getTenantAdminRouteContext, noStoreJson } from "@/lib/api/tenant-route"

export const dynamic = "force-dynamic"

const duplicateSchema = z.strictObject({
  source_id: z.string().uuid(),
  name: z.string().trim().min(1).max(140),
  copy_aircraft_rates: z.boolean().optional(),
  copy_instructor_rates: z.boolean().optional(),
})

export async function POST(request: NextRequest) {
  const session = await getTenantAdminRouteContext()
  if (session.response) return session.response
  const { supabase, tenantId } = session.context

  const raw = await request.json().catch(() => null)
  const parsed = duplicateSchema.safeParse(raw)
  if (!parsed.success) {
    return noStoreJson({ error: "Invalid payload" }, { status: 400 })
  }

  const { source_id, name, copy_aircraft_rates = true, copy_instructor_rates = true } = parsed.data

  const { data: source, error: sourceError } = await supabase
    .from("flight_types")
    .select(
      "id, name, description, instruction_type, billing_mode, duration_minutes, fixed_package_price, aircraft_gl_code, instructor_gl_code, is_active, is_revenue"
    )
    .eq("tenant_id", tenantId)
    .eq("id", source_id)
    .is("voided_at", null)
    .maybeSingle()

  if (sourceError || !source) {
    return noStoreJson({ error: "Source flight type not found" }, { status: 404 })
  }

  const { data: inserted, error: insertError } = await supabase
    .from("flight_types")
    .insert({
      tenant_id: tenantId,
      name: name.trim(),
      description: source.description,
      instruction_type: source.instruction_type,
      billing_mode: source.billing_mode,
      duration_minutes: source.duration_minutes,
      fixed_package_price: source.fixed_package_price,
      aircraft_gl_code: source.aircraft_gl_code,
      instructor_gl_code:
        source.instruction_type === "solo" ? null : source.instructor_gl_code,
      is_active: source.is_active,
      is_revenue: source.is_revenue ?? true,
      is_default_solo: false,
    })
    .select("id")
    .single()

  if (insertError || !inserted) {
    return noStoreJson({ error: "Failed to duplicate flight type" }, { status: 500 })
  }

  let aircraftCopied = 0
  let instructorCopied = 0

  if (copy_aircraft_rates) {
    const { data: acRates } = await supabase
      .from("aircraft_charge_rates")
      .select(
        "aircraft_id, rate_per_hour, fixed_package_price, charge_hobbs, charge_tacho, charge_airswitch"
      )
      .eq("tenant_id", tenantId)
      .eq("flight_type_id", source_id)

    if (acRates && acRates.length > 0) {
      const rows = acRates.map((r) => ({
        tenant_id: tenantId,
        flight_type_id: inserted.id,
        aircraft_id: r.aircraft_id,
        rate_per_hour: r.rate_per_hour,
        fixed_package_price: r.fixed_package_price,
        charge_hobbs: r.charge_hobbs,
        charge_tacho: r.charge_tacho,
        charge_airswitch: r.charge_airswitch,
      }))
      const { error: copyErr } = await supabase.from("aircraft_charge_rates").insert(rows)
      if (!copyErr) aircraftCopied = rows.length
    }
  }

  if (copy_instructor_rates) {
    const { data: instRates } = await supabase
      .from("instructor_flight_type_rates")
      .select("instructor_id, rate, revenue_allocation, effective_from")
      .eq("tenant_id", tenantId)
      .eq("flight_type_id", source_id)

    if (instRates && instRates.length > 0) {
      const rows = instRates.map((r) => ({
        tenant_id: tenantId,
        flight_type_id: inserted.id,
        instructor_id: r.instructor_id,
        rate: r.rate,
        revenue_allocation: r.revenue_allocation,
        effective_from: r.effective_from ?? new Date().toISOString().slice(0, 10),
      }))
      const { error: copyErr } = await supabase
        .from("instructor_flight_type_rates")
        .insert(rows)
      if (!copyErr) instructorCopied = rows.length
    }
  }

  return noStoreJson(
    {
      id: inserted.id,
      aircraft_rates_copied: aircraftCopied,
      instructor_rates_copied: instructorCopied,
    },
    { status: 201 }
  )
}
