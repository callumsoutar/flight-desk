import { noStoreJson, getTenantAdminRouteContext } from "@/lib/api/tenant-route"

import { TENANT_LOGO_BUCKET, isProbablyUrl } from "@/lib/settings/logo-storage"
import { createPrivilegedSupabaseClient } from "@/lib/supabase/privileged"

export const dynamic = "force-dynamic"

function fileExtensionFromMime(mime: string) {
  const normalized = mime.toLowerCase().trim()
  if (normalized === "image/png") return "png"
  if (normalized === "image/jpeg") return "jpg"
  if (normalized === "image/webp") return "webp"
  if (normalized === "image/gif") return "gif"
  if (normalized === "image/svg+xml") return "svg"
  return null
}

async function createSignedLogoUrl(path: string) {
  const supabaseAdmin = createPrivilegedSupabaseClient("tenant logo signed URL generation")
  const { data, error } = await supabaseAdmin.storage
    .from(TENANT_LOGO_BUCKET)
    .createSignedUrl(path, 60 * 60 * 24 * 30)
  if (error) return null
  return data?.signedUrl ?? null
}

export async function POST(request: Request) {
  const session = await getTenantAdminRouteContext()
  if (session.response) return session.response
  const { tenantId } = session.context

  const formData = await request.formData().catch(() => null)
  const file = formData?.get("file")
  if (!(file instanceof File)) {
    return noStoreJson({ error: "Missing file" }, { status: 400 })
  }

  if (!file.type.startsWith("image/")) {
    return noStoreJson({ error: "Only image uploads are supported" }, { status: 400 })
  }

  const MAX_SIZE = 5 * 1024 * 1024
  if (file.size > MAX_SIZE) {
    return noStoreJson({ error: "File is too large (max 5MB)" }, { status: 400 })
  }

  const ext = fileExtensionFromMime(file.type)
  if (!ext) {
    return noStoreJson({ error: "Unsupported image type" }, { status: 400 })
  }

  const supabaseAdmin = createPrivilegedSupabaseClient("tenant logo upload and tenant logo persistence")
  const objectPath = `tenants/${tenantId}/logo.${ext}`

  const { data: currentTenant, error: currentTenantError } = await supabaseAdmin
    .from("tenants")
    .select("logo_url")
    .eq("id", tenantId)
    .maybeSingle()

  if (currentTenantError) {
    return noStoreJson({ error: "Failed to load tenant" }, { status: 500 })
  }

  const previousPath =
    typeof currentTenant?.logo_url === "string" && currentTenant.logo_url && !isProbablyUrl(currentTenant.logo_url)
      ? currentTenant.logo_url
      : null

  const buffer = Buffer.from(await file.arrayBuffer())
  const { error: uploadError } = await supabaseAdmin.storage
    .from(TENANT_LOGO_BUCKET)
    .upload(objectPath, buffer, {
      contentType: file.type,
      upsert: true,
    })

  if (uploadError) {
    return noStoreJson({ error: "Failed to upload logo" }, { status: 500 })
  }

  if (previousPath && previousPath !== objectPath) {
    await supabaseAdmin.storage.from(TENANT_LOGO_BUCKET).remove([previousPath]).catch(() => null)
  }

  const { error: updateError } = await supabaseAdmin
    .from("tenants")
    .update({ logo_url: objectPath })
    .eq("id", tenantId)

  if (updateError) {
    return noStoreJson({ error: "Failed to save logo" }, { status: 500 })
  }

  const signedUrl = await createSignedLogoUrl(objectPath)
  if (!signedUrl) {
    return noStoreJson({ error: "Failed to generate logo URL" }, { status: 500 })
  }

  return noStoreJson({ url: signedUrl })
}

export async function DELETE() {
  const session = await getTenantAdminRouteContext()
  if (session.response) return session.response
  const { tenantId } = session.context

  const supabaseAdmin = createPrivilegedSupabaseClient("tenant logo removal and tenant logo persistence")
  const { data: tenant, error: tenantError } = await supabaseAdmin
    .from("tenants")
    .select("logo_url")
    .eq("id", tenantId)
    .maybeSingle()

  if (tenantError) {
    return noStoreJson({ error: "Failed to load tenant" }, { status: 500 })
  }

  const stored = typeof tenant?.logo_url === "string" ? tenant.logo_url : null
  const objectPath = stored && !isProbablyUrl(stored) ? stored : null

  if (objectPath) {
    await supabaseAdmin.storage.from(TENANT_LOGO_BUCKET).remove([objectPath]).catch(() => null)
  }

  const { error: updateError } = await supabaseAdmin
    .from("tenants")
    .update({ logo_url: null })
    .eq("id", tenantId)

  if (updateError) {
    return noStoreJson({ error: "Failed to remove logo" }, { status: 500 })
  }

  return noStoreJson({ ok: true })
}
