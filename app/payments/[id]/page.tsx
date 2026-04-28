import * as React from "react"
import { notFound, redirect } from "next/navigation"

import { PaymentDetailClient } from "@/components/payments/payment-detail-client"
import {
  AppRouteNarrowDetailContainer,
  AppRouteShell,
} from "@/components/layouts/app-route-shell"
import { InvoiceDetailSkeleton } from "@/components/loading/page-skeletons"
import { RouteNotFoundState } from "@/components/loading/route-not-found-state"
import { getAuthSession } from "@/lib/auth/session"
import { fetchPaymentDetailById } from "@/lib/payments/fetch-payment-detail"
import { createSupabaseServerClient } from "@/lib/supabase/server"

type PageProps = {
  params: Promise<{ id: string }>
}

async function PaymentDetailInner({
  tenantId,
  paymentId,
  canManageFinance,
}: {
  tenantId: string
  paymentId: string
  canManageFinance: boolean
}) {
  const supabase = await createSupabaseServerClient()

  let detailResult: Awaited<ReturnType<typeof fetchPaymentDetailById>>

  try {
    detailResult = await fetchPaymentDetailById(supabase, tenantId, paymentId)
  } catch {
    return (
      <PaymentDetailClient
        variant="failed"
        failedMessage="Something went wrong while loading this payment."
      />
    )
  }

  if (!detailResult) {
    notFound()
  }

  return (
    <PaymentDetailClient
      variant="detail"
      detail={detailResult}
      canManageFinance={canManageFinance}
    />
  )
}

export default async function PaymentDetailPage({ params }: PageProps) {
  const { id } = await params

  const supabase = await createSupabaseServerClient()
  const { user, tenantId, role } = await getAuthSession(supabase, {
    includeTenant: true,
    includeRole: true,
    authoritativeTenant: true,
    authoritativeRole: true,
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

  if (!role || !["owner", "admin", "instructor"].includes(role)) {
    redirect("/dashboard")
  }

  const canManageFinance = role === "owner" || role === "admin"

  return (
    <AppRouteShell>
      <React.Suspense fallback={<InvoiceDetailSkeleton />}>
        <PaymentDetailInner tenantId={tenantId} paymentId={id} canManageFinance={canManageFinance} />
      </React.Suspense>
    </AppRouteShell>
  )
}
