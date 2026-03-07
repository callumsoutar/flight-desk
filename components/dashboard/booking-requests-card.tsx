"use client"

import * as React from "react"
import Link from "next/link"
import { IconChevronRight, IconClipboardList } from "@tabler/icons-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { updateBookingStatusAction } from "@/app/bookings/actions"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { DashboardBookingLite } from "@/lib/types/dashboard"

function formatUser(user: DashboardBookingLite["student"]) {
  if (!user) return "—"
  const name = [user.first_name, user.last_name].filter(Boolean).join(" ").trim()
  return name || user.email || "—"
}

function formatTime(value: string, timeZone: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date)
}

export function BookingRequestsCard({
  bookings,
  timeZone,
}: {
  bookings: DashboardBookingLite[]
  timeZone: string
}) {
  const router = useRouter()
  const [pending, startTransition] = React.useTransition()
  const [pendingId, setPendingId] = React.useState<string | null>(null)

  const count = bookings.length

  const approve = (bookingId: string) => {
    startTransition(async () => {
      setPendingId(bookingId)
      const result = await updateBookingStatusAction(bookingId, "confirmed")
      setPendingId(null)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success("Booking confirmed")
      router.refresh()
    })
  }

  return (
    <Card className="border border-border/50 shadow-sm">
      <CardHeader className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-lg font-semibold">
              <span className="bg-muted/50 flex h-8 w-8 items-center justify-center rounded-lg">
                <IconClipboardList className="h-4 w-4 text-muted-foreground" />
              </span>
              Booking requests
              {count ? (
                <Badge variant="secondary" className="ml-1 h-6 rounded-full px-2 text-xs">
                  {count}
                </Badge>
              ) : null}
            </CardTitle>
            <CardDescription>New requests awaiting confirmation.</CardDescription>
          </div>

          <Button asChild variant="ghost" size="sm" className="h-8 gap-1">
            <Link href="/bookings?tab=unconfirmed">
              View all <IconChevronRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </CardHeader>

      <CardContent className="pb-2">
        {count === 0 ? (
          <div className="rounded-lg border border-dashed border-border/70 bg-muted/20 py-8 text-center">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-muted/40">
              <IconClipboardList className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">No pending requests</p>
            <p className="mt-1 text-xs text-muted-foreground">You&apos;re all caught up.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border/60 bg-background">
            <div className="grid grid-cols-[1fr_auto_auto] gap-4 border-b border-border/60 bg-muted/30 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <div>Flight</div>
              <div className="text-right">Time</div>
              <div className="text-right">Actions</div>
            </div>

            {bookings.map((booking) => {
              const studentName = formatUser(booking.student)
              const aircraft = booking.aircraft?.registration ?? "No aircraft"
              const disabled = pending && pendingId === booking.id

              return (
                <div
                  key={booking.id}
                  className="grid grid-cols-[1fr_auto_auto] gap-4 border-b border-border/50 px-4 py-2 last:border-0 hover:bg-muted/20"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <p className="truncate text-sm font-medium text-foreground">
                      {studentName}
                      <span className="ml-1.5 text-muted-foreground">·</span>
                      <span className="ml-1 truncate text-xs text-muted-foreground">{aircraft}</span>
                    </p>
                  </div>

                  <div className="flex items-center justify-end">
                    <span className="text-xs tabular-nums text-foreground">
                      {formatTime(booking.start_time, timeZone)}–{formatTime(booking.end_time, timeZone)}
                    </span>
                  </div>

                  <div className="flex items-center justify-end gap-1.5">
                    <Button
                      size="sm"
                      className="h-6 px-2 text-[11px]"
                      disabled={disabled}
                      onClick={() => approve(booking.id)}
                    >
                      {disabled ? "…" : "Approve"}
                    </Button>
                    <Button asChild variant="ghost" size="sm" className="h-6 px-2 text-[11px] text-blue-600 hover:text-blue-700">
                      <Link href={`/bookings/${booking.id}`}>Review</Link>
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {pending ? (
          <p className={cn("mt-3 text-xs text-muted-foreground", pendingId ? "" : "opacity-0")}>
            Updating booking…
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}
