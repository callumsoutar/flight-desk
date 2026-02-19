import * as React from "react"
import { redirect } from "next/navigation"

import { MemberDetailClient } from "@/components/members/member-detail-client"
import { MemberDetailSkeleton } from "@/components/loading/page-skeletons"
import {
  AppRouteDetailContainer,
  AppRouteShell,
} from "@/components/layouts/app-route-shell"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getAuthSession } from "@/lib/auth/session"
import { fetchMemberDetail } from "@/lib/members/fetch-member-detail"
import { fetchMemberMembershipsData } from "@/lib/members/fetch-member-memberships-data"
import { fetchMemberPilotData } from "@/lib/members/fetch-member-pilot-data"
import { createSupabaseServerClient } from "@/lib/supabase/server"

type PageProps = {
  params: Promise<{ id: string }>
}

function MessageCard({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <AppRouteShell>
      <AppRouteDetailContainer>
        <Card>
          <CardHeader>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
        </Card>
      </AppRouteDetailContainer>
    </AppRouteShell>
  )
}

async function MemberDetailContent({
  tenantId,
  memberId,
}: {
  tenantId: string
  memberId: string
}) {
  const supabase = await createSupabaseServerClient()

  let member: Awaited<ReturnType<typeof fetchMemberDetail>>
  let pilotData: Awaited<ReturnType<typeof fetchMemberPilotData>>
  let membershipsData: Awaited<ReturnType<typeof fetchMemberMembershipsData>>
  try {
    ;[member, pilotData, membershipsData] = await Promise.all([
      fetchMemberDetail(supabase, tenantId, memberId),
      fetchMemberPilotData(supabase, tenantId, memberId),
      fetchMemberMembershipsData(supabase, tenantId, memberId),
    ])
  } catch {
    return (
      <AppRouteDetailContainer>
        <Card>
          <CardHeader>
            <CardTitle>Member</CardTitle>
            <CardDescription>Failed to load member. Please try again.</CardDescription>
          </CardHeader>
        </Card>
      </AppRouteDetailContainer>
    )
  }

  if (!member) {
    return (
      <AppRouteDetailContainer>
        <Card>
          <CardHeader>
            <CardTitle>Member Not Found</CardTitle>
            <CardDescription>This member does not exist in your tenant.</CardDescription>
          </CardHeader>
        </Card>
      </AppRouteDetailContainer>
    )
  }

  return (
    <AppRouteDetailContainer>
      <MemberDetailClient
        member={member}
        availableLicenses={pilotData.availableLicenses}
        availableEndorsements={pilotData.availableEndorsements}
        initialUserEndorsements={pilotData.userEndorsements}
        initialMembershipSummary={membershipsData.summary}
        membershipTypes={membershipsData.membershipTypes}
        defaultTaxRate={membershipsData.defaultTaxRate}
      />
    </AppRouteDetailContainer>
  )
}

export default async function MemberDetailPage({ params }: PageProps) {
  const { id } = await params

  const supabase = await createSupabaseServerClient()
  const { user, tenantId } = await getAuthSession(supabase, { includeTenant: true })

  if (!user) redirect("/login")
  if (!tenantId) {
    return (
      <MessageCard
        title="Member"
        description="Your account isn&apos;t linked to a tenant yet."
      />
    )
  }

  return (
    <AppRouteShell>
      <React.Suspense
        fallback={
          <AppRouteDetailContainer>
            <MemberDetailSkeleton />
          </AppRouteDetailContainer>
        }
      >
        <MemberDetailContent tenantId={tenantId} memberId={id} />
      </React.Suspense>
    </AppRouteShell>
  )
}
