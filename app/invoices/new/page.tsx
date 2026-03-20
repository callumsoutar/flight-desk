import * as React from "react"
import { redirect } from "next/navigation"

import { InvoiceCreateClient } from "@/components/invoices/invoice-create-client"
import { InvoiceDetailSkeleton } from "@/components/loading/page-skeletons"
import { AppRouteNarrowDetailContainer, AppRouteShell } from "@/components/layouts/app-route-shell"
import { RouteNotFoundState } from "@/components/loading/route-not-found-state"
import { isStaffRole } from "@/lib/auth/roles"
import { getAuthSession } from "@/lib/auth/session"
import { fetchInvoiceCreateData } from "@/lib/invoices/fetch-invoice-create-data"
import { createSupabaseServerClient } from "@/lib/supabase/server"

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function pickSearchParam(
  value: string | string[] | undefined
): string | null {
  if (typeof value === "string") return value
  if (Array.isArray(value)) return value[0] ?? null
  return null
}

async function NewInvoiceContent({
  tenantId,
  defaultUserId,
}: {
  tenantId: string
  defaultUserId: string | null
}) {
  const supabase = await createSupabaseServerClient()
  const createData = await fetchInvoiceCreateData(supabase, tenantId)

  return (
    <InvoiceCreateClient
      members={createData.members}
      chargeables={createData.chargeables}
      defaultTaxRate={createData.defaultTaxRate}
      defaultUserId={defaultUserId}
    />
  )
}

export default async function NewInvoicePage({ searchParams }: PageProps) {
  const supabase = await createSupabaseServerClient()
  const { user, role, tenantId } = await getAuthSession(supabase, {
    includeRole: true,
    includeTenant: true,
    requireUser: true,
    authoritativeRole: true,
    authoritativeTenant: true,
  })

  if (!user) redirect("/login")
  if (!tenantId) {
    return (
      <AppRouteShell>
        <AppRouteNarrowDetailContainer>
          <RouteNotFoundState
            heading="Account not set up"
            message="Your account hasn't been fully set up yet. Please contact your administrator."
          />
        </AppRouteNarrowDetailContainer>
      </AppRouteShell>
    )
  }

  const isStaff = isStaffRole(role)
  if (!isStaff) {
    return (
      <AppRouteShell>
        <AppRouteNarrowDetailContainer>
          <RouteNotFoundState
            heading="Access denied"
            message="You don't have permission to access this page."
            backHref="/invoices"
            backLabel="Back to invoices"
          />
        </AppRouteNarrowDetailContainer>
      </AppRouteShell>
    )
  }

  const resolvedSearch = await searchParams
  const defaultUserId = pickSearchParam(resolvedSearch.user_id)

  return (
    <AppRouteShell>
      <React.Suspense fallback={<InvoiceDetailSkeleton />}>
        <NewInvoiceContent tenantId={tenantId} defaultUserId={defaultUserId} />
      </React.Suspense>
    </AppRouteShell>
  )
}

