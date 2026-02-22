"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { getAuthSession } from "@/lib/auth/session"
import { normalizeTimeToSql, parseTimeToMinutes } from "@/lib/roster/availability"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import type { RosterRule } from "@/lib/types/roster"

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const timeSchema = z.string().regex(/^\d{2}:\d{2}(?::\d{2})?$/)
const dayLabels = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const

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

const checkRosterRuleConflictsSchema = z.object({
  instructor_id: z.string().uuid(),
  days_of_week: z.array(z.number().int().min(0).max(6)).min(1),
  start_time: timeSchema,
  end_time: timeSchema,
  effective_from: dateSchema,
  effective_until: dateSchema.nullable(),
  exclude_rule_id: z.string().uuid().optional(),
})

export type CreateRosterRuleInput = z.infer<typeof createRosterRuleSchema>
export type UpdateRosterRuleInput = z.infer<typeof updateRosterRuleSchema>
export type VoidRosterRuleInput = z.infer<typeof voidRosterRuleSchema>
export type CheckRosterRuleConflictsInput = z.infer<typeof checkRosterRuleConflictsSchema>

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

function formatDayLabel(dayOfWeek: number) {
  return dayLabels[dayOfWeek] ?? `Day ${dayOfWeek}`
}

function uniqueSortedDays(values: number[]) {
  return Array.from(new Set(values)).sort((a, b) => a - b)
}

function buildConflictMessage(days: number[]) {
  const labels = uniqueSortedDays(days).map(formatDayLabel)
  if (labels.length === 1) return `Conflicts with an existing roster entry on ${labels[0]}.`
  return `Conflicts with existing roster entries on ${labels.join(", ")}.`
}

type PostgrestErrorLike = {
  code?: string | null
  message?: string | null
  details?: string | null
  hint?: string | null
}

type RosterInsertPayload = {
  tenant_id: string
  instructor_id: string
  day_of_week: number
  start_time: string
  end_time: string
  effective_from: string
  effective_until: string | null
  notes: string | null
  is_active: boolean
  voided_at: string | null
}

function formatMutationError(error: PostgrestErrorLike | null | undefined, fallback: string) {
  if (!error) return fallback

  const loweredMessage = (error.message ?? "").toLowerCase()

  if (error.code === "23505") {
    return "A matching roster entry already exists."
  }
  if (error.code === "23503") {
    return "Selected instructor could not be found for this tenant."
  }
  if (loweredMessage.includes("overlap") || loweredMessage.includes("conflict")) {
    return "This roster entry overlaps an existing roster assignment."
  }

  const tail = [error.message, error.details, error.hint].filter(Boolean).join(" ")
  return tail ? `${fallback}: ${tail}` : fallback
}

function isUniqueDayTimeViolation(error: PostgrestErrorLike | null | undefined) {
  const message = error?.message ?? ""
  return error?.code === "23505" && message.includes("roster_rules_unique_instructor_day_time")
}

function isOneOffRule(rule: Pick<RosterRule, "effective_from" | "effective_until">) {
  return Boolean(rule.effective_until && rule.effective_until === rule.effective_from)
}

function canRecyclePastOneOffRule(
  existing: Pick<RosterRule, "effective_from" | "effective_until">,
  requestedFrom: string
) {
  if (!isOneOffRule(existing)) return false
  return (existing.effective_until ?? existing.effective_from) < requestedFrom
}

function formatRuleDateRange(rule: Pick<RosterRule, "effective_from" | "effective_until">) {
  if (!rule.effective_until || rule.effective_until !== rule.effective_from) {
    return `${rule.effective_from} onward`
  }
  return rule.effective_from
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

async function verifyInstructorInTenant(
  supabase: SupabaseServerClient,
  tenantId: string,
  instructorId: string
) {
  const { data, error } = await supabase
    .from("instructors")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("id", instructorId)
    .maybeSingle()

  if (error || !data) return false
  return true
}

async function fetchRuleInTenant(
  supabase: SupabaseServerClient,
  tenantId: string,
  ruleId: string
) {
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

async function fetchExactRuleKeyMatch({
  supabase,
  tenantId,
  instructorId,
  dayOfWeek,
  startTime,
  endTime,
}: {
  supabase: SupabaseServerClient
  tenantId: string
  instructorId: string
  dayOfWeek: number
  startTime: string
  endTime: string
}) {
  const { data, error } = await supabase
    .from("roster_rules")
    .select(
      "id, instructor_id, day_of_week, start_time, end_time, effective_from, effective_until, is_active, notes, voided_at, created_at, updated_at"
    )
    .eq("tenant_id", tenantId)
    .eq("instructor_id", instructorId)
    .eq("day_of_week", dayOfWeek)
    .eq("start_time", startTime)
    .eq("end_time", endTime)
    .maybeSingle()

  if (error || !data) return null
  return data as RosterRule
}

async function archiveRule({
  supabase,
  tenantId,
  ruleId,
}: {
  supabase: SupabaseServerClient
  tenantId: string
  ruleId: string
}) {
  return supabase
    .from("roster_rules")
    .update({
      is_active: false,
      voided_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_id", tenantId)
    .eq("id", ruleId)
}

async function createRosterRuleRow({
  supabase,
  insertPayload,
}: {
  supabase: SupabaseServerClient
  insertPayload: RosterInsertPayload
}) {
  return supabase
    .from("roster_rules")
    .insert(insertPayload)
    .select(
      "id, instructor_id, day_of_week, start_time, end_time, effective_from, effective_until, is_active, notes, voided_at, created_at, updated_at"
    )
    .single()
}

async function recycleRosterRuleRow({
  supabase,
  tenantId,
  ruleId,
  payload,
  startTime,
  endTime,
}: {
  supabase: SupabaseServerClient
  tenantId: string
  ruleId: string
  payload: CreateRosterRuleInput
  startTime: string
  endTime: string
}) {
  return supabase
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
    .eq("id", ruleId)
    .select(
      "id, instructor_id, day_of_week, start_time, end_time, effective_from, effective_until, is_active, notes, voided_at, created_at, updated_at"
    )
    .single()
}

async function findRosterRuleConflict({
  supabase,
  tenantId,
  instructorId,
  dayOfWeek,
  startTime,
  endTime,
  effectiveFrom,
  effectiveUntil,
  excludeRuleId,
}: {
  supabase: SupabaseServerClient
  tenantId: string
  instructorId: string
  dayOfWeek: number
  startTime: string
  endTime: string
  effectiveFrom: string
  effectiveUntil: string | null
  excludeRuleId?: string
}) {
  let query = supabase
    .from("roster_rules")
    .select(
      "id, instructor_id, day_of_week, start_time, end_time, effective_from, effective_until, is_active, notes, voided_at, created_at, updated_at"
    )
    .eq("tenant_id", tenantId)
    .eq("instructor_id", instructorId)
    .eq("day_of_week", dayOfWeek)
    .eq("is_active", true)
    .is("voided_at", null)
    .lt("start_time", endTime)
    .gt("end_time", startTime)
    .lte("effective_from", effectiveUntil ?? "9999-12-31")
    .or(`effective_until.is.null,effective_until.gte.${effectiveFrom}`)

  if (excludeRuleId) {
    query = query.neq("id", excludeRuleId)
  }

  const { data, error } = await query.limit(1).maybeSingle()
  if (error) throw error
  return (data as RosterRule | null) ?? null
}

async function findConflictDays({
  supabase,
  tenantId,
  instructorId,
  daysOfWeek,
  startTime,
  endTime,
  effectiveFrom,
  effectiveUntil,
  excludeRuleId,
}: {
  supabase: SupabaseServerClient
  tenantId: string
  instructorId: string
  daysOfWeek: number[]
  startTime: string
  endTime: string
  effectiveFrom: string
  effectiveUntil: string | null
  excludeRuleId?: string
}) {
  const uniqueDays = uniqueSortedDays(daysOfWeek)
  const checks = await Promise.all(
    uniqueDays.map(async (dayOfWeek) => {
      const conflict = await findRosterRuleConflict({
        supabase,
        tenantId,
        instructorId,
        dayOfWeek,
        startTime,
        endTime,
        effectiveFrom,
        effectiveUntil,
        excludeRuleId,
      })
      return conflict ? dayOfWeek : null
    })
  )

  return checks.filter((value): value is number => value !== null)
}

export async function checkRosterRuleConflictsAction(input: unknown) {
  const parsed = checkRosterRuleConflictsSchema.safeParse(input)
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

  const hasInstructor = await verifyInstructorInTenant(supabase, tenantId, payload.instructor_id)
  if (!hasInstructor) return { ok: false as const, error: "Instructor not found" }

  const startTime = normalizeTimeToSql(payload.start_time)
  const endTime = normalizeTimeToSql(payload.end_time)
  if (!startTime || !endTime) {
    return { ok: false as const, error: "Invalid start or end time" }
  }

  try {
    const conflictDays = await findConflictDays({
      supabase,
      tenantId,
      instructorId: payload.instructor_id,
      daysOfWeek: payload.days_of_week,
      startTime,
      endTime,
      effectiveFrom: payload.effective_from,
      effectiveUntil: payload.effective_until,
      excludeRuleId: payload.exclude_rule_id,
    })

    if (conflictDays.length) {
      return { ok: false as const, error: buildConflictMessage(conflictDays) }
    }

    return { ok: true as const }
  } catch (error) {
    console.error("[rosters] conflict check failed", {
      tenantId,
      userId: user.id,
      payload,
      error,
    })
    return { ok: false as const, error: "Failed to validate roster conflicts" }
  }
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

  const hasInstructor = await verifyInstructorInTenant(supabase, tenantId, payload.instructor_id)
  if (!hasInstructor) return { ok: false as const, error: "Instructor not found" }

  const startTime = normalizeTimeToSql(payload.start_time)
  const endTime = normalizeTimeToSql(payload.end_time)

  if (!startTime || !endTime) {
    return { ok: false as const, error: "Invalid start or end time" }
  }

  try {
    const conflict = await findRosterRuleConflict({
      supabase,
      tenantId,
      instructorId: payload.instructor_id,
      dayOfWeek: payload.day_of_week,
      startTime,
      endTime,
      effectiveFrom: payload.effective_from,
      effectiveUntil: payload.effective_until,
    })

    if (conflict) {
      return {
        ok: false as const,
        error: buildConflictMessage([payload.day_of_week]),
      }
    }
  } catch (error) {
    console.error("[rosters] create conflict check failed", {
      tenantId,
      userId: user.id,
      payload,
      error,
    })
    return { ok: false as const, error: "Failed to validate roster conflicts" }
  }

  const insertPayload: RosterInsertPayload = {
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
  }

  let { data, error } = await createRosterRuleRow({
    supabase,
    insertPayload,
  })

  if (isUniqueDayTimeViolation(error)) {
    const existing = await fetchExactRuleKeyMatch({
      supabase,
      tenantId,
      instructorId: payload.instructor_id,
      dayOfWeek: payload.day_of_week,
      startTime,
      endTime,
    })

    if (existing && canRecyclePastOneOffRule(existing, payload.effective_from)) {
      const { error: archiveError } = await archiveRule({
        supabase,
        tenantId,
        ruleId: existing.id,
      })

      if (!archiveError) {
        const retryInsert = await createRosterRuleRow({
          supabase,
          insertPayload,
        })
        data = retryInsert.data
        error = retryInsert.error
      }

      if (isUniqueDayTimeViolation(error)) {
        const recycleResult = await recycleRosterRuleRow({
          supabase,
          tenantId,
          ruleId: existing.id,
          payload,
          startTime,
          endTime,
        })
        if (!recycleResult.error && recycleResult.data) {
          data = recycleResult.data
          error = null
        }
      }
    }

    if (isUniqueDayTimeViolation(error) && existing) {
      return {
        ok: false as const,
        error: `A roster entry with this exact day/time already exists (${formatRuleDateRange(existing)}). Edit that entry instead.`,
      }
    }
  }

  if (error || !data) {
    console.error("[rosters] create failed", {
      tenantId,
      userId: user.id,
      payload,
      error,
    })
    return {
      ok: false as const,
      error: formatMutationError(error, "Failed to create roster entry"),
    }
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

  const existingRule = await fetchRuleInTenant(supabase, tenantId, payload.rule_id)
  if (!existingRule) return { ok: false as const, error: "Roster entry not found" }

  const timeError = validateTimes(payload.start_time, payload.end_time)
  if (timeError) return { ok: false as const, error: timeError }

  const rangeError = validateEffectiveRange(payload.effective_from, payload.effective_until)
  if (rangeError) return { ok: false as const, error: rangeError }

  const hasInstructor = await verifyInstructorInTenant(supabase, tenantId, payload.instructor_id)
  if (!hasInstructor) return { ok: false as const, error: "Instructor not found" }

  const startTime = normalizeTimeToSql(payload.start_time)
  const endTime = normalizeTimeToSql(payload.end_time)

  if (!startTime || !endTime) {
    return { ok: false as const, error: "Invalid start or end time" }
  }

  try {
    const conflict = await findRosterRuleConflict({
      supabase,
      tenantId,
      instructorId: payload.instructor_id,
      dayOfWeek: payload.day_of_week,
      startTime,
      endTime,
      effectiveFrom: payload.effective_from,
      effectiveUntil: payload.effective_until,
      excludeRuleId: payload.rule_id,
    })

    if (conflict) {
      return {
        ok: false as const,
        error: buildConflictMessage([payload.day_of_week]),
      }
    }
  } catch (error) {
    console.error("[rosters] update conflict check failed", {
      tenantId,
      userId: user.id,
      payload,
      error,
    })
    return { ok: false as const, error: "Failed to validate roster conflicts" }
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
    if (isUniqueDayTimeViolation(error)) {
      const exactMatch = await fetchExactRuleKeyMatch({
        supabase,
        tenantId,
        instructorId: payload.instructor_id,
        dayOfWeek: payload.day_of_week,
        startTime,
        endTime,
      })
      if (exactMatch && exactMatch.id !== payload.rule_id) {
        return {
          ok: false as const,
          error: `A roster entry with this exact day/time already exists (${formatRuleDateRange(exactMatch)}). Edit that entry instead.`,
        }
      }
    }

    console.error("[rosters] update failed", {
      tenantId,
      userId: user.id,
      payload,
      error,
    })
    return {
      ok: false as const,
      error: formatMutationError(error, "Failed to update roster entry"),
    }
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

  const existingRule = await fetchRuleInTenant(supabase, tenantId, parsed.data.rule_id)
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

  if (error) {
    console.error("[rosters] archive failed", {
      tenantId,
      userId: user.id,
      ruleId: parsed.data.rule_id,
      error,
    })
    return {
      ok: false as const,
      error: formatMutationError(error, "Failed to remove roster entry"),
    }
  }

  revalidatePath("/rosters")

  return { ok: true as const }
}
