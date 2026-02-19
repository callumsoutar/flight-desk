"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { getAuthSession } from "@/lib/auth/session"
import { fetchMemberMembershipsData } from "@/lib/members/fetch-member-memberships-data"
import { createSupabaseServerClient } from "@/lib/supabase/server"

const updateContactSchema = z.object({
  memberId: z.string().uuid(),
  first_name: z.string().min(1).max(100),
  last_name: z.string().min(1).max(100),
  email: z.string().email(),
  phone: z.string().max(20).nullable(),
  street_address: z.string().max(200).nullable(),
  gender: z.enum(["male", "female"]).nullable(),
  date_of_birth: z.string().nullable(),
  notes: z.string().nullable(),
  next_of_kin_name: z.string().max(200).nullable(),
  next_of_kin_phone: z.string().max(20).nullable(),
  company_name: z.string().max(100).nullable(),
  occupation: z.string().max(100).nullable(),
  employer: z.string().max(100).nullable(),
})

export type UpdateMemberContactInput = z.infer<typeof updateContactSchema>

const updatePilotSchema = z.object({
  memberId: z.string().uuid(),
  pilot_license_number: z.string().nullable(),
  pilot_license_type: z.string().nullable(),
  pilot_license_id: z.string().uuid().nullable(),
  pilot_license_expiry: z.string().nullable(),
  medical_certificate_expiry: z.string().nullable(),
})

const addEndorsementSchema = z.object({
  memberId: z.string().uuid(),
  endorsementId: z.string().uuid(),
  issuedDate: z.string(),
  expiryDate: z.string().nullable(),
  notes: z.string().nullable(),
})

const removeEndorsementSchema = z.object({
  memberId: z.string().uuid(),
  userEndorsementId: z.string().uuid(),
})

const renewMembershipSchema = z.object({
  memberId: z.string().uuid(),
  currentMembershipId: z.string().uuid(),
  membership_type_id: z.string().uuid().optional(),
  notes: z.string().nullable().optional(),
  create_invoice: z.boolean().optional(),
})

const createMembershipSchema = z.object({
  memberId: z.string().uuid(),
  membership_type_id: z.string().uuid(),
  custom_expiry_date: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  create_invoice: z.boolean().optional(),
})

export type UpdateMemberPilotInput = z.infer<typeof updatePilotSchema>
export type AddMemberEndorsementInput = z.infer<typeof addEndorsementSchema>
export type RemoveMemberEndorsementInput = z.infer<typeof removeEndorsementSchema>
export type RenewMemberMembershipInput = z.infer<typeof renewMembershipSchema>
export type CreateMemberMembershipInput = z.infer<typeof createMembershipSchema>

async function requireTenantContext() {
  const supabase = await createSupabaseServerClient()
  const { user, tenantId } = await getAuthSession(supabase, {
    requireUser: true,
    includeTenant: true,
    authoritativeTenant: true,
  })
  if (!user) return { supabase, user: null, tenantId: null }
  return { supabase, user, tenantId }
}

async function verifyMemberInTenant(
  memberId: string,
  tenantId: string
) {
  const supabase = await createSupabaseServerClient()
  const { data: membership, error } = await supabase
    .from("tenant_users")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("user_id", memberId)
    .maybeSingle()

  if (error) return false
  return Boolean(membership)
}

export async function updateMemberContactAction(input: UpdateMemberContactInput) {
  const parsed = updateContactSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false as const, error: "Invalid contact details" }
  }

  const { supabase, user, tenantId } = await requireTenantContext()
  if (!user) return { ok: false as const, error: "Unauthorized" }
  if (!tenantId) return { ok: false as const, error: "Missing tenant context" }

  const { memberId, ...updates } = parsed.data

  const { data: membership, error: membershipError } = await supabase
    .from("tenant_users")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("user_id", memberId)
    .maybeSingle()

  if (membershipError) {
    return { ok: false as const, error: "Failed to validate member access" }
  }
  if (!membership) return { ok: false as const, error: "Member not found" }

  const { error: updateError } = await supabase
    .from("users")
    .update(updates)
    .eq("id", memberId)

  if (updateError) return { ok: false as const, error: "Failed to update member" }

  revalidatePath(`/members/${memberId}`)
  revalidatePath("/members")

  return { ok: true as const }
}

export async function updateMemberPilotAction(input: UpdateMemberPilotInput) {
  const parsed = updatePilotSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false as const, error: "Invalid pilot details" }
  }

  const { supabase, user, tenantId } = await requireTenantContext()
  if (!user) return { ok: false as const, error: "Unauthorized" }
  if (!tenantId) return { ok: false as const, error: "Missing tenant context" }

  const { memberId, ...updates } = parsed.data
  const hasAccess = await verifyMemberInTenant(memberId, tenantId)
  if (!hasAccess) return { ok: false as const, error: "Member not found" }

  const { error } = await supabase
    .from("users")
    .update(updates)
    .eq("id", memberId)

  if (error) return { ok: false as const, error: "Failed to update pilot details" }

  revalidatePath(`/members/${memberId}`)
  revalidatePath("/members")

  return { ok: true as const }
}

export async function addMemberEndorsementAction(input: AddMemberEndorsementInput) {
  const parsed = addEndorsementSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false as const, error: "Invalid endorsement payload" }
  }

  const { supabase, user, tenantId } = await requireTenantContext()
  if (!user) return { ok: false as const, error: "Unauthorized" }
  if (!tenantId) return { ok: false as const, error: "Missing tenant context" }

  const { memberId, endorsementId, issuedDate, expiryDate, notes } = parsed.data
  const hasAccess = await verifyMemberInTenant(memberId, tenantId)
  if (!hasAccess) return { ok: false as const, error: "Member not found" }

  const { error } = await supabase.from("users_endorsements").insert({
    tenant_id: tenantId,
    user_id: memberId,
    endorsement_id: endorsementId,
    issued_date: issuedDate,
    expiry_date: expiryDate,
    notes,
  })

  if (error) return { ok: false as const, error: "Failed to add endorsement" }

  revalidatePath(`/members/${memberId}`)
  return { ok: true as const }
}

export async function removeMemberEndorsementAction(input: RemoveMemberEndorsementInput) {
  const parsed = removeEndorsementSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false as const, error: "Invalid endorsement remove payload" }
  }

  const { supabase, user, tenantId } = await requireTenantContext()
  if (!user) return { ok: false as const, error: "Unauthorized" }
  if (!tenantId) return { ok: false as const, error: "Missing tenant context" }

  const { memberId, userEndorsementId } = parsed.data
  const hasAccess = await verifyMemberInTenant(memberId, tenantId)
  if (!hasAccess) return { ok: false as const, error: "Member not found" }

  const { error } = await supabase
    .from("users_endorsements")
    .update({ voided_at: new Date().toISOString() })
    .eq("id", userEndorsementId)
    .eq("tenant_id", tenantId)
    .eq("user_id", memberId)

  if (error) return { ok: false as const, error: "Failed to remove endorsement" }

  revalidatePath(`/members/${memberId}`)
  return { ok: true as const }
}

function addMonths(dateValue: Date, months: number) {
  const next = new Date(dateValue)
  next.setMonth(next.getMonth() + months)
  return next
}

export async function renewMemberMembershipAction(input: RenewMemberMembershipInput) {
  const parsed = renewMembershipSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false as const, error: "Invalid renewal payload" }
  }

  const { supabase, user, tenantId } = await requireTenantContext()
  if (!user) return { ok: false as const, error: "Unauthorized" }
  if (!tenantId) return { ok: false as const, error: "Missing tenant context" }

  const { memberId, currentMembershipId, membership_type_id, notes } = parsed.data
  const hasAccess = await verifyMemberInTenant(memberId, tenantId)
  if (!hasAccess) return { ok: false as const, error: "Member not found" }

  const { data: currentMembership, error: currentError } = await supabase
    .from("memberships")
    .select("id, membership_type_id, expiry_date, grace_period_days")
    .eq("tenant_id", tenantId)
    .eq("user_id", memberId)
    .eq("id", currentMembershipId)
    .maybeSingle()

  if (currentError || !currentMembership) {
    return { ok: false as const, error: "Current membership not found" }
  }

  const nextTypeId = membership_type_id ?? currentMembership.membership_type_id

  const { data: nextType, error: typeError } = await supabase
    .from("membership_types")
    .select("id, duration_months")
    .eq("tenant_id", tenantId)
    .eq("id", nextTypeId)
    .eq("is_active", true)
    .maybeSingle()
  if (typeError || !nextType) {
    return { ok: false as const, error: "Membership type not found" }
  }

  const startDate = new Date()
  const expiryDate = addMonths(startDate, nextType.duration_months)

  const { error: deactivateError } = await supabase
    .from("memberships")
    .update({
      is_active: false,
      end_date: new Date().toISOString().slice(0, 10),
      updated_by: user.id,
    })
    .eq("tenant_id", tenantId)
    .eq("id", currentMembershipId)
  if (deactivateError) return { ok: false as const, error: "Failed to close previous membership" }

  const { error: createError } = await supabase.from("memberships").insert({
    tenant_id: tenantId,
    user_id: memberId,
    membership_type_id: nextType.id,
    is_active: true,
    start_date: startDate.toISOString().slice(0, 10),
    purchased_date: startDate.toISOString().slice(0, 10),
    expiry_date: expiryDate.toISOString().slice(0, 10),
    grace_period_days: currentMembership.grace_period_days ?? 14,
    notes: notes ?? null,
    updated_by: user.id,
  })
  if (createError) return { ok: false as const, error: "Failed to renew membership" }

  revalidatePath(`/members/${memberId}`)
  revalidatePath("/members")

  const updated = await fetchMemberMembershipsData(supabase, tenantId, memberId)
  return { ok: true as const, summary: updated.summary }
}

export async function createMemberMembershipAction(input: CreateMemberMembershipInput) {
  const parsed = createMembershipSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false as const, error: "Invalid create membership payload" }
  }

  const { supabase, user, tenantId } = await requireTenantContext()
  if (!user) return { ok: false as const, error: "Unauthorized" }
  if (!tenantId) return { ok: false as const, error: "Missing tenant context" }

  const { memberId, membership_type_id, custom_expiry_date, notes } = parsed.data
  const hasAccess = await verifyMemberInTenant(memberId, tenantId)
  if (!hasAccess) return { ok: false as const, error: "Member not found" }

  const { data: membershipType, error: typeError } = await supabase
    .from("membership_types")
    .select("id, duration_months")
    .eq("tenant_id", tenantId)
    .eq("id", membership_type_id)
    .eq("is_active", true)
    .maybeSingle()
  if (typeError || !membershipType) {
    return { ok: false as const, error: "Membership type not found" }
  }

  const startDate = new Date()
  const defaultExpiry = addMonths(startDate, membershipType.duration_months)
  const finalExpiry = custom_expiry_date
    ? new Date(custom_expiry_date)
    : defaultExpiry

  const { error: deactivateError } = await supabase
    .from("memberships")
    .update({
      is_active: false,
      end_date: new Date().toISOString().slice(0, 10),
      updated_by: user.id,
    })
    .eq("tenant_id", tenantId)
    .eq("user_id", memberId)
    .eq("is_active", true)
  if (deactivateError) return { ok: false as const, error: "Failed to close existing membership" }

  const { error: createError } = await supabase.from("memberships").insert({
    tenant_id: tenantId,
    user_id: memberId,
    membership_type_id: membershipType.id,
    is_active: true,
    start_date: startDate.toISOString().slice(0, 10),
    purchased_date: startDate.toISOString().slice(0, 10),
    expiry_date: finalExpiry.toISOString().slice(0, 10),
    grace_period_days: 14,
    notes: notes ?? null,
    updated_by: user.id,
  })
  if (createError) return { ok: false as const, error: "Failed to create membership" }

  revalidatePath(`/members/${memberId}`)
  revalidatePath("/members")

  const updated = await fetchMemberMembershipsData(supabase, tenantId, memberId)
  return { ok: true as const, summary: updated.summary }
}
