import { NextResponse } from "next/server"

import { getAuthSession } from "@/lib/auth/session"
import { TENANT_LOGO_BUCKET, isProbablyUrl } from "@/lib/settings/logo-storage"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

function isSettingsAdmin(role: string | null) {
  return role === "owner" || role === "admin"
}

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
  const supabaseAdmin = createSupabaseAdminClient()
  const { data, error } = await supabaseAdmin.storage
    .from(TENANT_LOGO_BUCKET)
    .createSignedUrl(path, 60 * 60 * 24 * 30)
  if (error) return null
  return data?.signedUrl ?? null
}

export async function POST(request: Request) {
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
  if (!isSettingsAdmin(role)) {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403, headers: { "cache-control": "no-store" } }
    )
  }

  const formData = await request.formData().catch(() => null)
  const file = formData?.get("file")
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "Missing file" },
      { status: 400, headers: { "cache-control": "no-store" } }
    )
  }

  if (!file.type.startsWith("image/")) {
    return NextResponse.json(
      { error: "Only image uploads are supported" },
      { status: 400, headers: { "cache-control": "no-store" } }
    )
  }

  const MAX_SIZE = 5 * 1024 * 1024
  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: "File is too large (max 5MB)" },
      { status: 400, headers: { "cache-control": "no-store" } }
    )
  }

  const ext = fileExtensionFromMime(file.type)
  if (!ext) {
    return NextResponse.json(
      { error: "Unsupported image type" },
      { status: 400, headers: { "cache-control": "no-store" } }
    )
  }

  const supabaseAdmin = createSupabaseAdminClient()
  const objectPath = `tenants/${tenantId}/logo.${ext}`

  const { data: currentTenant, error: currentTenantError } = await supabaseAdmin
    .from("tenants")
    .select("logo_url")
    .eq("id", tenantId)
    .maybeSingle()

  if (currentTenantError) {
    return NextResponse.json(
      { error: "Failed to load tenant" },
      { status: 500, headers: { "cache-control": "no-store" } }
    )
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
    return NextResponse.json(
      { error: "Failed to upload logo" },
      { status: 500, headers: { "cache-control": "no-store" } }
    )
  }

  if (previousPath && previousPath !== objectPath) {
    await supabaseAdmin.storage.from(TENANT_LOGO_BUCKET).remove([previousPath]).catch(() => null)
  }

  const { error: updateError } = await supabaseAdmin
    .from("tenants")
    .update({ logo_url: objectPath })
    .eq("id", tenantId)

  if (updateError) {
    return NextResponse.json(
      { error: "Failed to save logo" },
      { status: 500, headers: { "cache-control": "no-store" } }
    )
  }

  const signedUrl = await createSignedLogoUrl(objectPath)
  if (!signedUrl) {
    return NextResponse.json(
      { error: "Failed to generate logo URL" },
      { status: 500, headers: { "cache-control": "no-store" } }
    )
  }

  return NextResponse.json(
    { url: signedUrl },
    { headers: { "cache-control": "no-store" } }
  )
}

export async function DELETE() {
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
  if (!isSettingsAdmin(role)) {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403, headers: { "cache-control": "no-store" } }
    )
  }

  const supabaseAdmin = createSupabaseAdminClient()
  const { data: tenant, error: tenantError } = await supabaseAdmin
    .from("tenants")
    .select("logo_url")
    .eq("id", tenantId)
    .maybeSingle()

  if (tenantError) {
    return NextResponse.json(
      { error: "Failed to load tenant" },
      { status: 500, headers: { "cache-control": "no-store" } }
    )
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
    return NextResponse.json(
      { error: "Failed to remove logo" },
      { status: 500, headers: { "cache-control": "no-store" } }
    )
  }

  return NextResponse.json(
    { ok: true },
    { headers: { "cache-control": "no-store" } }
  )
}

