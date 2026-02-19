"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { getAuthSession } from "@/lib/auth/session"
import { normalizeTimeToSql, parseTimeToMinutes } from "@/lib/roster/availability"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import type { RosterRule } from "@/lib/types/roster"

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const timeSchema = z.string().regex(/^\d{2}:\d{2}(?::\d{2})?$/)

const rosterPayloadSchema = z.object({
  instructor_id: z.string().uuid(),
  day_of_week: z.number().int().min(0).max(6),
  start_time: timeSchema,
  end_time: timeSchema,
  effective_from: dateSchema,
  effective_until: dateSchema.nullable(),
  notes: z.string().max(2000).nullable(),
})

const createRosterRuleSchema = rosterPayloadSchema

const updateRosterRuleSchema = rosterPayloadSchema.extend({
  rule_id: z.string().uuid(),
})

const voidRosterRuleSchema = z.object({
  rule_id: z.string().uuid(),
})

export type CreateRosterRuleInput = z.infer<typeof createRosterRuleSchema>
export type UpdateRosterRuleInput = z.infer<typeof updateRosterRuleSchema>
export type VoidRosterRuleInput = z.infer<typeof voidRosterRuleSchema>

function canManageRosters(role: string | null) {
  return role === "owner" || role === "admin" || role === "instructor"
}

function normalizeNotes(value: string | null | undefined) {
  if (!value) return null
  const trimmed = value.trim()
  return trimmed.length ? trimmed : null
}

function validateTimes(start: string, end: string) {
  const startMinutes = parseTimeToMinutes(start)
  const endMinutes = parseTimeToMinutes(end)

  if (startMinutes === null || endMinutes === null) {
    return "Invalid start or end time"
  }

  if (endMinutes <= startMinutes) {
    return "End time must be after start time"
  }

  return null
}

function validateEffectiveRange(fromDate: string, untilDate: string | null) {
  if (!untilDate) return null
  if (untilDate < fromDate) return "End date must be on or after start date"
  return null
}

async function requireTenantContext() {
  const supabase = await createSupabaseServerClient()
  const { user, role, tenantId } = await getAuthSession(supabase, {
    includeRole: true,
    includeTenant: true,
    requireUser: true,
    authoritativeRole: true,
    authoritativeTenant: true,
  })
  if (!user) return { supabase, user: null, role: null, tenantId: null }
  return { supabase, user, role, tenantId }
}

async function verifyInstructorInTenant(tenantId: string, instructorId: string) {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from("instructors")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("id", instructorId)
    .maybeSingle()

  if (error || !data) return false
  return true
}

async function fetchRuleInTenant(tenantId: string, ruleId: string) {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from("roster_rules")
    .select(
      "id, instructor_id, day_of_week, start_time, end_time, effective_from, effective_until, is_active, notes, voided_at, created_at, updated_at"
    )
    .eq("tenant_id", tenantId)
    .eq("id", ruleId)
    .maybeSingle()

  if (error || !data) return null
  return data as RosterRule
}

export async function createRosterRuleAction(input: unknown) {
  const parsed = createRosterRuleSchema.safeParse(input)
  if (!parsed.success) return { ok: false as const, error: "Invalid roster entry" }

  const { supabase, user, role, tenantId } = await requireTenantContext()
  if (!user) return { ok: false as const, error: "Unauthorized" }
  if (!tenantId) return { ok: false as const, error: "Missing tenant context" }
  if (!canManageRosters(role)) return { ok: false as const, error: "Forbidden" }

  const payload = parsed.data

  const timeError = validateTimes(payload.start_time, payload.end_time)
  if (timeError) return { ok: false as const, error: timeError }

  const rangeError = validateEffectiveRange(payload.effective_from, payload.effective_until)
  if (rangeError) return { ok: false as const, error: rangeError }

  const hasInstructor = await verifyInstructorInTenant(tenantId, payload.instructor_id)
  if (!hasInstructor) return { ok: false as const, error: "Instructor not found" }

  const startTime = normalizeTimeToSql(payload.start_time)
  const endTime = normalizeTimeToSql(payload.end_time)

  if (!startTime || !endTime) {
    return { ok: false as const, error: "Invalid start or end time" }
  }

  const { data, error } = await supabase
    .from("roster_rules")
    .insert({
      tenant_id: tenantId,
      instructor_id: payload.instructor_id,
      day_of_week: payload.day_of_week,
      start_time: startTime,
      end_time: endTime,
      effective_from: payload.effective_from,
      effective_until: payload.effective_until,
      notes: normalizeNotes(payload.notes),
      is_active: true,
      voided_at: null,
    })
    .select(
      "id, instructor_id, day_of_week, start_time, end_time, effective_from, effective_until, is_active, notes, voided_at, created_at, updated_at"
    )
    .single()

  if (error || !data) {
    return { ok: false as const, error: "Failed to create roster entry" }
  }

  revalidatePath("/rosters")

  return { ok: true as const, rule: data as RosterRule }
}

export async function updateRosterRuleAction(input: unknown) {
  const parsed = updateRosterRuleSchema.safeParse(input)
  if (!parsed.success) return { ok: false as const, error: "Invalid roster entry" }

  const { supabase, user, role, tenantId } = await requireTenantContext()
  if (!user) return { ok: false as const, error: "Unauthorized" }
  if (!tenantId) return { ok: false as const, error: "Missing tenant context" }
  if (!canManageRosters(role)) return { ok: false as const, error: "Forbidden" }

  const payload = parsed.data

  const existingRule = await fetchRuleInTenant(tenantId, payload.rule_id)
  if (!existingRule) return { ok: false as const, error: "Roster entry not found" }

  const timeError = validateTimes(payload.start_time, payload.end_time)
  if (timeError) return { ok: false as const, error: timeError }

  const rangeError = validateEffectiveRange(payload.effective_from, payload.effective_until)
  if (rangeError) return { ok: false as const, error: rangeError }

  const hasInstructor = await verifyInstructorInTenant(tenantId, payload.instructor_id)
  if (!hasInstructor) return { ok: false as const, error: "Instructor not found" }

  const startTime = normalizeTimeToSql(payload.start_time)
  const endTime = normalizeTimeToSql(payload.end_time)

  if (!startTime || !endTime) {
    return { ok: false as const, error: "Invalid start or end time" }
  }

  const { data, error } = await supabase
    .from("roster_rules")
    .update({
      instructor_id: payload.instructor_id,
      day_of_week: payload.day_of_week,
      start_time: startTime,
      end_time: endTime,
      effective_from: payload.effective_from,
      effective_until: payload.effective_until,
      notes: normalizeNotes(payload.notes),
      is_active: true,
      voided_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_id", tenantId)
    .eq("id", payload.rule_id)
    .select(
      "id, instructor_id, day_of_week, start_time, end_time, effective_from, effective_until, is_active, notes, voided_at, created_at, updated_at"
    )
    .single()

  if (error || !data) {
    return { ok: false as const, error: "Failed to update roster entry" }
  }

  revalidatePath("/rosters")

  return { ok: true as const, rule: data as RosterRule }
}

export async function voidRosterRuleAction(input: unknown) {
  const parsed = voidRosterRuleSchema.safeParse(input)
  if (!parsed.success) return { ok: false as const, error: "Invalid roster entry" }

  const { supabase, user, role, tenantId } = await requireTenantContext()
  if (!user) return { ok: false as const, error: "Unauthorized" }
  if (!tenantId) return { ok: false as const, error: "Missing tenant context" }
  if (!canManageRosters(role)) return { ok: false as const, error: "Forbidden" }

  const existingRule = await fetchRuleInTenant(tenantId, parsed.data.rule_id)
  if (!existingRule) return { ok: false as const, error: "Roster entry not found" }

  const { error } = await supabase
    .from("roster_rules")
    .update({
      is_active: false,
      voided_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_id", tenantId)
    .eq("id", parsed.data.rule_id)

  if (error) return { ok: false as const, error: "Failed to remove roster entry" }

  revalidatePath("/rosters")

  return { ok: true as const }
}
