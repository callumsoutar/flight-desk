import Link from "next/link"
import { redirect } from "next/navigation"

import { AppRouteListContainer, AppRouteShell } from "@/components/layouts/app-route-shell"
import { RouteNotFoundState } from "@/components/loading/route-not-found-state"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { getAuthSession } from "@/lib/auth/session"
import { EMAIL_TRIGGER_LABELS } from "@/lib/email/trigger-keys"
import { createSupabaseServerClient } from "@/lib/supabase/server"

type SearchParams = {
  page?: string
  limit?: string
  trigger_key?: string
  status?: string
}

export default async function EmailLogsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1)
  const limit = Math.min(100, Math.max(1, Number.parseInt(params.limit ?? "50", 10) || 50))
  const from = (page - 1) * limit
  const to = from + limit - 1

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
        <AppRouteListContainer>
          <RouteNotFoundState heading="Account not set up" message="Your account is not configured yet." />
        </AppRouteListContainer>
      </AppRouteShell>
    )
  }
  if (role !== "owner" && role !== "admin") {
    return (
      <AppRouteShell>
        <AppRouteListContainer>
          <RouteNotFoundState
            heading="Access denied"
            message="Only owners and admins can access email logs."
          />
        </AppRouteListContainer>
      </AppRouteShell>
    )
  }

  let query = supabase
    .from("email_logs")
    .select(
      "id, sent_at, email_type, recipient_email, subject, status, booking_id, invoice_id, error_message",
      { count: "exact" }
    )
    .eq("tenant_id", tenantId)
    .order("sent_at", { ascending: false, nullsFirst: false })
    .range(from, to)

  if (params.trigger_key) query = query.eq("email_type", params.trigger_key)
  if (params.status) query = query.eq("status", params.status)

  const { data: logs, count } = await query
  const total = count ?? 0
  const totalPages = Math.max(1, Math.ceil(total / limit))

  return (
    <AppRouteShell>
      <AppRouteListContainer>
        <div className="space-y-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Email Logs</h1>
            <p className="text-sm text-muted-foreground">
              Tenant-scoped send history for automatic and manual emails.
            </p>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sent</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Recipient</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Links</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(logs ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground">
                    No email logs found for this filter.
                  </TableCell>
                </TableRow>
              ) : (
                (logs ?? []).map((log) => {
                  const label =
                    EMAIL_TRIGGER_LABELS[log.email_type as keyof typeof EMAIL_TRIGGER_LABELS] ??
                    log.email_type
                  const sentAt = log.sent_at
                    ? new Intl.DateTimeFormat("en-NZ", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      }).format(new Date(log.sent_at))
                    : "-"

                  return (
                    <TableRow key={log.id}>
                      <TableCell>{sentAt}</TableCell>
                      <TableCell>{label}</TableCell>
                      <TableCell>{log.recipient_email}</TableCell>
                      <TableCell>{log.subject}</TableCell>
                      <TableCell>
                        <Badge variant={log.status === "sent" ? "default" : "destructive"}>
                          {log.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {log.booking_id ? <Link href={`/bookings/${log.booking_id}`}>Booking</Link> : null}
                        {log.booking_id && log.invoice_id ? " · " : null}
                        {log.invoice_id ? <Link href={`/invoices/${log.invoice_id}`}>Invoice</Link> : null}
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>

          <div className="flex items-center justify-between text-sm">
            <span>
              Page {page} of {totalPages} ({total} records)
            </span>
            <div className="flex gap-2">
              <Link
                href={`/settings/email/logs?page=${Math.max(1, page - 1)}&limit=${limit}`}
                className={`underline ${page <= 1 ? "pointer-events-none opacity-40" : ""}`}
              >
                Previous
              </Link>
              <Link
                href={`/settings/email/logs?page=${Math.min(totalPages, page + 1)}&limit=${limit}`}
                className={`underline ${page >= totalPages ? "pointer-events-none opacity-40" : ""}`}
              >
                Next
              </Link>
            </div>
          </div>
        </div>
      </AppRouteListContainer>
    </AppRouteShell>
  )
}
