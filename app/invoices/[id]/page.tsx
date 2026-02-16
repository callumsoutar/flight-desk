import * as React from "react"
import { redirect } from "next/navigation"

import { AppSidebar } from "@/components/app-sidebar"
import { InvoiceDetailClient } from "@/components/invoices/invoice-detail-client"
import { SiteHeader } from "@/components/site-header"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { getAuthSession } from "@/lib/auth/session"
import { getUserTenantId } from "@/lib/auth/tenant"
import { fetchInvoiceDetail } from "@/lib/invoices/fetch-invoice-detail"
import { createSupabaseServerClient } from "@/lib/supabase/server"

type PageProps = {
  params: Promise<{ id: string }>
}

function LayoutShell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "16rem",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}

function MessageCard({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <LayoutShell>
      <div className="flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-5xl">
          <Card>
            <CardHeader>
              <CardTitle>{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    </LayoutShell>
  )
}

export default async function InvoiceDetailPage({ params }: PageProps) {
  const { id } = await params

  const supabase = await createSupabaseServerClient()
  const { user } = await getAuthSession(supabase)

  if (!user) redirect("/login")

  const tenantId = await getUserTenantId(supabase, user.id)
  if (!tenantId) {
    return (
      <MessageCard
        title="Invoice"
        description="Your account isn't linked to a tenant yet."
      />
    )
  }

  if (id === "new") {
    return (
      <MessageCard
        title="New Invoice"
        description="Invoice creation is not available on this route yet."
      />
    )
  }

  let detail: Awaited<ReturnType<typeof fetchInvoiceDetail>>
  try {
    detail = await fetchInvoiceDetail(supabase, tenantId, id)
  } catch {
    return (
      <MessageCard
        title="Invoice"
        description="Failed to load invoice. Please try again."
      />
    )
  }

  if (!detail.invoice) {
    return (
      <MessageCard
        title="Invoice Not Found"
        description="This invoice does not exist in your tenant."
      />
    )
  }

  return (
    <LayoutShell>
      <InvoiceDetailClient invoice={detail.invoice} items={detail.items} />
    </LayoutShell>
  )
}
