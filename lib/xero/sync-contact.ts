import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/types"
import type { createXeroApiClient } from "@/lib/xero/client"
import { XeroApiError } from "@/lib/xero/types"

type AdminClient = SupabaseClient<Database>
type XeroClient = ReturnType<typeof createXeroApiClient>

export async function syncXeroContact(
  admin: AdminClient,
  xeroClient: XeroClient,
  tenantId: string,
  userId: string,
  initiatedBy?: string
) {
  const { data: mapping, error: mappingError } = await admin
    .from("xero_contacts")
    .select("xero_contact_id")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .maybeSingle()

  if (mappingError) throw mappingError
  if (mapping?.xero_contact_id) return mapping.xero_contact_id

  const { data: user, error: userError } = await admin
    .from("user_directory")
    .select("first_name, last_name, email, phone")
    .eq("id", userId)
    .maybeSingle()

  if (userError || !user?.email) {
    throw new Error("Unable to resolve user details for Xero contact sync.")
  }

  let contactId: string | null = null
  let contactName: string | null = null

  try {
    const existingContacts = await xeroClient.searchContactsByEmail(user.email)
    const existing = existingContacts.Contacts?.find((contact) => contact.EmailAddress === user.email) ?? null

    if (existing?.ContactID) {
      contactId = existing.ContactID
      contactName = existing.Name ?? null
    } else {
      const firstName = user.first_name?.trim() ?? ""
      const lastName = user.last_name?.trim() ?? ""
      const fullName = `${firstName} ${lastName}`.trim() || user.email

      const created = await xeroClient.createContact({
        Name: fullName,
        FirstName: firstName || undefined,
        LastName: lastName || undefined,
        EmailAddress: user.email,
        Phones: user.phone
          ? [{ PhoneType: "MOBILE", PhoneNumber: user.phone }]
          : undefined,
      })

      const createdContact = created.Contacts?.[0]
      contactId = createdContact?.ContactID ?? null
      contactName = createdContact?.Name ?? null
    }
  } catch (error) {
    if (error instanceof XeroApiError && error.status === 404) {
      const created = await xeroClient.createContact({
        Name: `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim() || user.email,
        FirstName: user.first_name ?? undefined,
        LastName: user.last_name ?? undefined,
        EmailAddress: user.email,
        Phones: user.phone
          ? [{ PhoneType: "MOBILE", PhoneNumber: user.phone }]
          : undefined,
      })
      const recreated = created.Contacts?.[0]
      contactId = recreated?.ContactID ?? null
      contactName = recreated?.Name ?? null
    } else {
      throw error
    }
  }

  if (!contactId) throw new Error("Xero contact sync failed to resolve a contact ID")

  const { error: upsertError } = await admin.from("xero_contacts").upsert(
    {
      tenant_id: tenantId,
      user_id: userId,
      xero_contact_id: contactId,
      xero_contact_name: contactName,
      last_synced_at: new Date().toISOString(),
    },
    { onConflict: "tenant_id,user_id" }
  )

  if (upsertError) throw upsertError

  await admin.from("xero_export_logs").insert({
    tenant_id: tenantId,
    action: "sync_contact",
    status: "success",
    initiated_by: initiatedBy ?? null,
    request_payload: { user_id: userId, email: user.email },
    response_payload: { xero_contact_id: contactId },
  })

  return contactId
}
