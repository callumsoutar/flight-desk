"use client"

import * as React from "react"
import { Copy, Mail, MapPin, Phone } from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { fetchMemberContactDetails, type MemberContactDetailsDto } from "@/hooks/use-member-contact-details-query"
import { cn, getUserInitials } from "@/lib/utils"

function formatFullName(details: MemberContactDetailsDto) {
  const name = [details.first_name, details.last_name].filter(Boolean).join(" ").trim()
  return name || details.email || "Member"
}

function labelOrDash(value: string | null | undefined) {
  const trimmed = typeof value === "string" ? value.trim() : ""
  return trimmed ? trimmed : "—"
}

function labelOrUnavailable(value: string | null | undefined) {
  const trimmed = typeof value === "string" ? value.trim() : ""
  return trimmed ? trimmed : "Not provided"
}

async function copyToClipboard(value: string, label: string) {
  try {
    await navigator.clipboard.writeText(value)
    toast.success(`${label} copied`)
  } catch {
    toast.error("Copy failed")
  }
}

export function ContactDetailsModal({
  open,
  onOpenChange,
  memberId,
  title = "Contact details",
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  memberId: string | null
  title?: string
}) {
  const router = useRouter()
  const [details, setDetails] = React.useState<MemberContactDetailsDto | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!open) {
      setError(null)
      setLoading(false)
      return
    }
    if (!memberId) {
      setDetails(null)
      setError("No member selected.")
      return
    }

    const controller = new AbortController()
    setLoading(true)
    setError(null)
    setDetails(null)

    void fetchMemberContactDetails(memberId, controller.signal)
      .then((payload) => {
        setDetails(payload)
      })
      .catch((err) => {
        if (controller.signal.aborted) return
        setDetails(null)
        setError(err instanceof Error ? err.message : "Failed to load contact details")
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [open, memberId])

  const fullName = details ? formatFullName(details) : "Member"
  const initials = details ? getUserInitials(details.first_name, details.last_name, details.email) : "?"
  const email = details?.email ?? null
  const phone = details?.phone ?? null
  const address = details?.street_address ?? null
  const normalizedAddress = typeof address === "string" ? address.trim() : ""
  const hasAddress = Boolean(normalizedAddress)
  const showAddress = loading || hasAddress

  const openProfile = () => {
    if (!details?.id) return
    onOpenChange(false)
    router.push(`/members/${details.id}`)
  }

  const copyAll = async () => {
    if (!details) return
    const parts = [`Name: ${formatFullName(details)}`]
    if (details.email) parts.push(`Email: ${details.email}`)
    if (details.phone) parts.push(`Phone: ${details.phone}`)
    if (hasAddress) parts.push(`Address: ${normalizedAddress}`)
    await copyToClipboard(parts.join("\n"), "Contact details")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0 sm:max-w-[560px]">
        <div className="bg-background">
          <DialogHeader className="border-b px-6 py-5 text-left">
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-start gap-4">
                <Avatar className="h-11 w-11 rounded-full border bg-muted/20">
                  <AvatarFallback className="bg-muted/30 text-sm font-semibold text-foreground/80">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <DialogTitle className="truncate text-lg font-bold text-foreground">
                    {details ? fullName : title}
                  </DialogTitle>
                  <DialogDescription
                    className={cn("mt-1 truncate", error ? "text-destructive" : "text-muted-foreground")}
                  >
                    {error
                      ? error
                      : loading
                        ? "Loading contact details…"
                        : details
                          ? labelOrUnavailable(details.email)
                          : "—"}
                  </DialogDescription>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {details ? (
                  <Button
                    variant="outline"
                    size="icon-sm"
                    aria-label="Copy all contact details"
                    onClick={copyAll}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                ) : null}
                {email ? (
                  <Button asChild variant="outline" size="sm">
                    <a href={`mailto:${email}`}>
                      <Mail className="h-4 w-4" />
                      Email
                    </a>
                  </Button>
                ) : null}
                {phone ? (
                  <Button asChild variant="outline" size="sm">
                    <a href={`tel:${phone}`}>
                      <Phone className="h-4 w-4" />
                      Call
                    </a>
                  </Button>
                ) : null}
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-3 px-6 py-5">
            <div className="rounded-xl border border-border/60 bg-background/60 p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg bg-muted/50 text-muted-foreground">
                    <Mail className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Email</div>
                    <div className="truncate text-sm font-medium text-foreground">
                      {loading ? <Skeleton className="mt-1 h-4 w-44" /> : labelOrDash(email)}
                    </div>
                  </div>
                </div>
                {email ? (
                  <Button
                    variant="outline"
                    size="icon-sm"
                    aria-label="Copy email"
                    className="shrink-0"
                    onClick={() => copyToClipboard(email, "Email")}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                ) : null}
              </div>
            </div>

            <div className="rounded-xl border border-border/60 bg-background/60 p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg bg-muted/50 text-muted-foreground">
                    <Phone className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Phone</div>
                    <div className="truncate text-sm font-medium text-foreground">
                      {loading ? <Skeleton className="mt-1 h-4 w-28" /> : labelOrDash(phone)}
                    </div>
                  </div>
                </div>
                {phone ? (
                  <Button
                    variant="outline"
                    size="icon-sm"
                    aria-label="Copy phone"
                    className="shrink-0"
                    onClick={() => copyToClipboard(phone, "Phone")}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                ) : null}
              </div>
            </div>

            {showAddress ? (
              <div className="rounded-xl border border-border/60 bg-background/60 p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg bg-muted/50 text-muted-foreground">
                      <MapPin className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Address</div>
                      <div className="text-sm font-medium text-foreground">
                        {loading ? (
                          <div className="space-y-2 pt-1">
                            <Skeleton className="h-4 w-56" />
                            <Skeleton className="h-4 w-44" />
                          </div>
                        ) : (
                          <div className="whitespace-pre-wrap break-words">{normalizedAddress}</div>
                        )}
                      </div>
                    </div>
                  </div>
                  {hasAddress ? (
                    <Button
                      variant="outline"
                      size="icon-sm"
                      aria-label="Copy address"
                      className="shrink-0"
                      onClick={() => copyToClipboard(normalizedAddress, "Address")}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>

          <DialogFooter className="border-t px-6 py-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button onClick={openProfile} disabled={!details?.id}>
              Open member profile
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}
