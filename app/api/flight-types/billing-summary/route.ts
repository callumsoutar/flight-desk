import { getTenantAdminRouteContext, noStoreJson } from "@/lib/api/tenant-route"

export const dynamic = "force-dynamic"

export type FlightTypeBillingSummary = {
  flight_type_id: string
  aircraft_total: number
  aircraft_priced: number
  min_price: number | null
  max_price: number | null
}

export async function GET() {
  const session = await getTenantAdminRouteContext()
  if (session.response) return session.response
  const { supabase, tenantId } = session.context

  const [aircraftRes, typesRes, ratesRes] = await Promise.all([
    supabase
      .from("aircraft")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("on_line", true)
      .is("voided_at", null),
    supabase.from("flight_types").select("*")
      .eq("tenant_id", tenantId)
      .is("voided_at", null)
      .eq("is_active", true),
    supabase
      .from("aircraft_charge_rates")
      .select("flight_type_id, aircraft_id, fixed_package_price")
      .eq("tenant_id", tenantId),
  ])

  if (aircraftRes.error || typesRes.error || ratesRes.error) {
    return noStoreJson({ error: "Failed to load billing summary" }, { status: 500 })
  }

  const activeAircraftIds = new Set((aircraftRes.data ?? []).map((a) => a.id))
  const aircraftTotal = activeAircraftIds.size

  const byFlightType = new Map<
    string,
    { pricedAircraftIds: Set<string>; prices: number[] }
  >()

  for (const r of ratesRes.data ?? []) {
    if (!activeAircraftIds.has(r.aircraft_id)) continue
    const price = r.fixed_package_price == null ? null : Number(r.fixed_package_price)
    if (price == null || !Number.isFinite(price) || price <= 0) continue
    const entry = byFlightType.get(r.flight_type_id) ?? {
      pricedAircraftIds: new Set<string>(),
      prices: [],
    }
    entry.pricedAircraftIds.add(r.aircraft_id)
    entry.prices.push(price)
    byFlightType.set(r.flight_type_id, entry)
  }

  const summaries: FlightTypeBillingSummary[] = (typesRes.data ?? []).map((ft) => {
    const rawPkg = "fixed_package_price" in ft ? (ft as { fixed_package_price?: unknown }).fixed_package_price : undefined
    const pkgOnType =
      ft.billing_mode === "fixed_package" && rawPkg != null
        ? Number(rawPkg)
        : null
    if (pkgOnType != null && Number.isFinite(pkgOnType) && pkgOnType > 0) {
      return {
        flight_type_id: ft.id,
        aircraft_total: aircraftTotal,
        aircraft_priced: aircraftTotal,
        min_price: pkgOnType,
        max_price: pkgOnType,
      }
    }
    const entry = byFlightType.get(ft.id)
    const prices = entry?.prices ?? []
    return {
      flight_type_id: ft.id,
      aircraft_total: aircraftTotal,
      aircraft_priced: entry?.pricedAircraftIds.size ?? 0,
      min_price: prices.length ? Math.min(...prices) : null,
      max_price: prices.length ? Math.max(...prices) : null,
    }
  })

  return noStoreJson({ summaries })
}
