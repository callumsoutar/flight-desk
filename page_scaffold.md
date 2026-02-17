# FlightDesk Page Scaffold (AI Builder Reference)

Use this as the default blueprint for every new page in this repo.
It reflects the current patterns in `app/`, `lib/auth/`, `lib/*/fetch-*`, and `components/*`.

## Core Rules

1. Default to Server Components for routes and data loading.
2. Only use `"use client"` in focused UI islands (tables, forms, modals, interactive tabs).
3. Always resolve auth and tenant on the server.
4. Never trust client-provided `tenant_id`; derive it with `getUserTenantId`.
5. Every DB query must be tenant-scoped (`.eq("tenant_id", tenantId)`), plus RLS remains the final gate.
6. Add route-level loading and error boundaries (`loading.tsx`, `error.tsx`).
7. Use `React.Suspense` in page routes with project skeleton fallbacks.

## Canonical Route Structure

For a list page:

```text
app/<feature>/page.tsx
app/<feature>/loading.tsx
app/<feature>/error.tsx
components/<feature>/<feature>-page-client.tsx   (only if needed)
lib/<feature>/fetch-<feature>.ts
```

For a detail page:

```text
app/<feature>/[id]/page.tsx
app/<feature>/[id]/loading.tsx
app/<feature>/[id]/error.tsx
components/<feature>/<feature>-detail-client.tsx (only if needed)
lib/<feature>/fetch-<feature>-detail.ts
```

## Page Template (Server Component)

```tsx
import * as React from "react"
import { redirect } from "next/navigation"

import { FeaturePageClient } from "@/components/feature/feature-page-client"
import { ListPageSkeleton } from "@/components/loading/page-skeletons"
import { AppRouteListContainer, AppRouteShell } from "@/components/layouts/app-route-shell"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getAuthSession } from "@/lib/auth/session"
import { getUserTenantId } from "@/lib/auth/tenant"
import { fetchFeature } from "@/lib/feature/fetch-feature"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import type { FeatureRow } from "@/lib/types/feature"

function MessageCard({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <AppRouteShell>
      <AppRouteListContainer>
        <Card>
          <CardHeader>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
        </Card>
      </AppRouteListContainer>
    </AppRouteShell>
  )
}

async function FeatureContent({ tenantId }: { tenantId: string }) {
  const supabase = await createSupabaseServerClient()

  let rows: FeatureRow[] = []
  let loadError: string | null = null

  try {
    rows = await fetchFeature(supabase, tenantId)
  } catch {
    rows = []
    loadError = "Failed to load data."
  }

  return (
    <div className="flex flex-col gap-4">
      {loadError ? <div className="text-sm text-muted-foreground">{loadError}</div> : null}
      <FeaturePageClient rows={rows} />
    </div>
  )
}

export default async function FeaturePage() {
  const supabase = await createSupabaseServerClient()
  const { user } = await getAuthSession(supabase)

  if (!user) redirect("/login")

  const tenantId = await getUserTenantId(supabase, user.id)
  if (!tenantId) {
    return (
      <MessageCard
        title="Feature"
        description="Your account isn&apos;t linked to a tenant yet."
      />
    )
  }

  return (
    <AppRouteShell>
      <AppRouteListContainer>
        <React.Suspense fallback={<ListPageSkeleton />}>
          <FeatureContent tenantId={tenantId} />
        </React.Suspense>
      </AppRouteListContainer>
    </AppRouteShell>
  )
}
```

## Loading and Error Templates

`app/<feature>/loading.tsx`

```tsx
import { ListPageSkeleton } from "@/components/loading/page-skeletons"
import { AppRouteListContainer, AppRouteShell } from "@/components/layouts/app-route-shell"

export default function Loading() {
  return (
    <AppRouteShell>
      <AppRouteListContainer>
        <ListPageSkeleton />
      </AppRouteListContainer>
    </AppRouteShell>
  )
}
```

`app/<feature>/error.tsx`

```tsx
"use client"

import { AppRouteListContainer, AppRouteShell } from "@/components/layouts/app-route-shell"
import { RouteErrorState } from "@/components/loading/route-error-state"

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <AppRouteShell>
      <AppRouteListContainer>
        <RouteErrorState
          title="Unable to load feature"
          message="Something went wrong while loading feature data."
          reset={reset}
        />
      </AppRouteListContainer>
    </AppRouteShell>
  )
}
```

## Data Loader Template (`lib/<feature>/fetch-*.ts`)

```ts
import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/types"
import type { FeatureRow } from "@/lib/types/feature"

export async function fetchFeature(
  supabase: SupabaseClient<Database>,
  tenantId: string
): Promise<FeatureRow[]> {
  const { data, error } = await supabase
    .from("feature_table")
    .select("*")
    .eq("tenant_id", tenantId)

  if (error) throw error
  return (data ?? []) as FeatureRow[]
}
```

## Client Component Template (`components/<feature>/*`)

```tsx
"use client"

import * as React from "react"
import { useAuth } from "@/contexts/auth-context"
import type { FeatureRow } from "@/lib/types/feature"

export function FeaturePageClient({ rows }: { rows: FeatureRow[] }) {
  const { role } = useAuth()
  const canEdit = role === "owner" || role === "admin" || role === "instructor"

  return (
    <div>
      {/* interactive UI only */}
      {/* role gating here is UX only; server + RLS are authoritative */}
      <pre>{JSON.stringify({ canEdit, count: rows.length }, null, 2)}</pre>
    </div>
  )
}
```

## Server Action Template (`app/<feature>/actions.ts`)

```ts
"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { getAuthSession } from "@/lib/auth/session"
import { getUserTenantId } from "@/lib/auth/tenant"
import { createSupabaseServerClient } from "@/lib/supabase/server"

const inputSchema = z.object({
  id: z.string().uuid(),
})

async function getTenantContext() {
  const supabase = await createSupabaseServerClient()
  const { user } = await getAuthSession(supabase)
  if (!user) return { supabase, user: null, tenantId: null }
  const tenantId = await getUserTenantId(supabase, user.id)
  return { supabase, user, tenantId }
}

export async function updateFeatureAction(input: unknown) {
  const parsed = inputSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "Invalid input" }

  const { supabase, user, tenantId } = await getTenantContext()
  if (!user) return { ok: false, error: "Unauthorized" }
  if (!tenantId) return { ok: false, error: "Missing tenant context" }

  const { error } = await supabase
    .from("feature_table")
    .update({ updated_at: new Date().toISOString() })
    .eq("tenant_id", tenantId)
    .eq("id", parsed.data.id)

  if (error) return { ok: false, error: "Update failed" }

  revalidatePath("/feature")
  return { ok: true as const }
}
```

## API Route Template (`app/api/<feature>/route.ts`)

```ts
import { NextResponse } from "next/server"

import { getAuthSession } from "@/lib/auth/session"
import { getUserTenantId } from "@/lib/auth/tenant"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export async function GET() {
  const supabase = await createSupabaseServerClient()
  const { user } = await getAuthSession(supabase)

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const tenantId = await getUserTenantId(supabase, user.id)
  if (!tenantId) {
    return NextResponse.json(
      { error: "Forbidden: Missing tenant context" },
      { status: 403 }
    )
  }

  try {
    const { data, error } = await supabase
      .from("feature_table")
      .select("*")
      .eq("tenant_id", tenantId)

    if (error) throw error
    return NextResponse.json(
      { data },
      { headers: { "cache-control": "no-store" } }
    )
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch feature data" },
      { status: 500, headers: { "cache-control": "no-store" } }
    )
  }
}
```

## Auth, Roles, Authorization (Current Implementation)

1. Auth verification entrypoint is `getAuthSession` in `lib/auth/session.ts`.
2. `getAuthSession` uses:
   - `supabase.auth.getClaims()`
   - `supabase.auth.getUser()`
   - claim subject match check (`claims.sub === user.id`)
3. Role is resolved from JWT `claims.role` (`app_*`) and falls back to `rpc("get_tenant_user_role")`.
4. Role type is `UserRole` in `lib/types/roles.ts`:
   - `owner | admin | instructor | member | student`
5. Route middleware (`middleware.ts`) enforces authenticated access and login redirect behavior.
6. Tenant resolution is server-only via `getUserTenantId` in `lib/auth/tenant.ts`.
7. Client-side role checks (`useAuth`) are UX-only; server checks + RLS are mandatory security controls.
8. Optional server-side role gate is `components/auth/role-guard.tsx`.

## Server/Client Boundary Checklist

1. `page.tsx` is server (no `"use client"`).
2. All DB reads in server component or `lib/*` server-only loader.
3. Interactive UI moved into `components/<feature>/*` with `"use client"`.
4. Client component receives typed props from server parent.
5. No direct tenant ID from URL, query, or form body for authorization.
6. All writes enforce auth + tenant context before update/insert/delete.
7. `loading.tsx` and `error.tsx` exist for each route segment.

## AI Builder Prompt Snippet

Use this prompt when generating a new page:

```text
Build this route using the FlightDesk page scaffold:
- Server-first page in app router (`page.tsx`) with `createSupabaseServerClient`, `getAuthSession`, and `getUserTenantId`
- Redirect unauthenticated users to `/login`
- If no tenant context, render the standard message card
- Fetch data in a server-only loader in `lib/<feature>/fetch-*.ts` and tenant-scope every query
- Wrap content in `AppRouteShell` + route container and `React.Suspense` with project skeleton fallback
- Put interactive UI in a dedicated `"use client"` component under `components/<feature>/...`
- Add `loading.tsx` and `error.tsx` using existing skeleton + `RouteErrorState`
- For mutations, use server actions with zod validation, tenant checks, and `revalidatePath`
- Keep role gating UX in client (`useAuth`) but enforce true authorization on server/RLS
```

