import { NextRequest } from "next/server"
import { z } from "zod"

import { getTenantStaffRouteContext, noStoreJson } from "@/lib/api/tenant-route"
import { invalidPayloadResponse } from "@/lib/security/http"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { getZonedYyyyMmDdAndHHmm, zonedTodayYyyyMmDd } from "@/lib/utils/timezone"

export const dynamic = "force-dynamic"

const lessonOutcomeSchema = z.union([z.literal("pass"), z.literal("not yet competent")])

const putSchema = z.strictObject({
  status: lessonOutcomeSchema.nullable().optional(),
  instructor_comments: z.string().nullable().optional(),
  focus_next_lesson: z.string().nullable().optional(),
  lesson_highlights: z.string().nullable().optional(),
  areas_for_improvement: z.string().nullable().optional(),
  airmanship: z.string().nullable().optional(),
  weather_conditions: z.string().nullable().optional(),
  safety_concerns: z.string().nullable().optional(),
})

async function fetchBookingContext(
  tenantId: string,
  bookingId: string,
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>
) {
  const { data, error } = await supabase
    .from("bookings")
    .select("id, user_id, instructor_id, checked_out_instructor_id, lesson_id, start_time, lesson:lessons(syllabus_id)")
    .eq("tenant_id", tenantId)
    .eq("id", bookingId)
    .maybeSingle()

  if (error) throw error
  return data
}

async function fetchTenantTimezone(tenantId: string, supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>) {
  const { data, error } = await supabase
    .from("tenants")
    .select("timezone")
    .eq("id", tenantId)
    .maybeSingle()

  if (error) throw error
  return data?.timezone ?? null
}

function normalizeText(value: string | null | undefined) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function stripHtmlToText(value: string) {
  return value
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function normalizeRichText(value: string | null | undefined) {
  const trimmed = value?.trim()
  if (!trimmed) return null
  const text = stripHtmlToText(trimmed)
  return text ? trimmed : null
}

function resolveTimezoneOrUtc(value: string | null) {
  if (!value) return "UTC"
  try {
    // Validate the IANA timezone string.
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date())
    return value
  } catch {
    return "UTC"
  }
}

export async function GET(_: NextRequest, context: { params: Promise<{ id: string }> }) {
  const supabase = await createSupabaseServerClient()
  const ctx = await getTenantStaffRouteContext(supabase)
  if (ctx.response) return ctx.response
  const { tenantId } = ctx.context

  const { id } = await context.params
  const booking = await fetchBookingContext(tenantId, id, supabase).catch(() => null)
  if (!booking) {
    return noStoreJson({ error: "Booking not found" }, { status: 404 })
  }

  const { data, error } = await supabase
    .from("lesson_progress")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("booking_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    return noStoreJson({ error: "Failed to load debrief" }, { status: 500 })
  }

  return noStoreJson({ lesson_progress: data ?? null })
}

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const supabase = await createSupabaseServerClient()
  const ctx = await getTenantStaffRouteContext(supabase)
  if (ctx.response) return ctx.response
  const { tenantId } = ctx.context

  const parsed = putSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return invalidPayloadResponse()
  }

  const { id } = await context.params
  const booking = await fetchBookingContext(tenantId, id, supabase).catch(() => null)
  if (!booking) {
    return noStoreJson({ error: "Booking not found" }, { status: 404 })
  }
  if (!booking.user_id) {
    return noStoreJson({ error: "Booking does not have a valid member for debrief logging" }, { status: 400 })
  }

  const { data: existing, error: existingError } = await supabase
    .from("lesson_progress")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("booking_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existingError) {
    return noStoreJson({ error: "Failed to load existing debrief" }, { status: 500 })
  }

  const incoming = parsed.data
  const hasAnyContent = Boolean(
    normalizeRichText(incoming.instructor_comments) ||
      normalizeText(incoming.focus_next_lesson) ||
      normalizeText(incoming.lesson_highlights) ||
      normalizeText(incoming.areas_for_improvement) ||
      normalizeText(incoming.airmanship) ||
      normalizeText(incoming.weather_conditions) ||
      normalizeText(incoming.safety_concerns) ||
      incoming.status
  )

  if (!existing && !hasAnyContent) {
    return noStoreJson({ error: "Nothing to save" }, { status: 400 })
  }

  const timezone = resolveTimezoneOrUtc(await fetchTenantTimezone(tenantId, supabase).catch(() => null))
  const dateYyyyMmDd = booking.start_time
    ? getZonedYyyyMmDdAndHHmm(new Date(booking.start_time), timezone).yyyyMmDd
    : zonedTodayYyyyMmDd(timezone)

  const instructorId = booking.checked_out_instructor_id ?? booking.instructor_id ?? null

  const update = {
    status: incoming.status || existing?.status || "pass",
    instructor_comments:
      incoming.instructor_comments !== undefined
        ? normalizeRichText(incoming.instructor_comments)
        : existing?.instructor_comments ?? null,
    focus_next_lesson:
      incoming.focus_next_lesson !== undefined
        ? normalizeText(incoming.focus_next_lesson)
        : existing?.focus_next_lesson ?? null,
    lesson_highlights:
      incoming.lesson_highlights !== undefined
        ? normalizeText(incoming.lesson_highlights)
        : existing?.lesson_highlights ?? null,
    areas_for_improvement:
      incoming.areas_for_improvement !== undefined
        ? normalizeText(incoming.areas_for_improvement)
        : existing?.areas_for_improvement ?? null,
    airmanship:
      incoming.airmanship !== undefined ? normalizeText(incoming.airmanship) : existing?.airmanship ?? null,
    weather_conditions:
      incoming.weather_conditions !== undefined
        ? normalizeText(incoming.weather_conditions)
        : existing?.weather_conditions ?? null,
    safety_concerns:
      incoming.safety_concerns !== undefined
        ? normalizeText(incoming.safety_concerns)
        : existing?.safety_concerns ?? null,
    date: dateYyyyMmDd,
    instructor_id: instructorId,
  }

  if (existing?.id) {
    const { data, error } = await supabase
      .from("lesson_progress")
      .update(update)
      .eq("tenant_id", tenantId)
      .eq("id", existing.id)
      .select("*")
      .single()

    if (error) {
      return noStoreJson({ error: "Failed to save debrief" }, { status: 500 })
    }

    return noStoreJson({ lesson_progress: data })
  }

  const insertRow = {
    tenant_id: tenantId,
    booking_id: id,
    user_id: booking.user_id,
    lesson_id: booking.lesson_id ?? null,
    syllabus_id: (booking.lesson as { syllabus_id: string | null } | null)?.syllabus_id ?? null,
    attempt: 1,
    ...update,
  }

  const { data, error } = await supabase
    .from("lesson_progress")
    .insert(insertRow)
    .select("*")
    .single()

  if (error) {
    return noStoreJson({ error: "Failed to create debrief" }, { status: 500 })
  }

  return noStoreJson({ lesson_progress: data })
}
