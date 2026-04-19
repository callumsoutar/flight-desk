"use client"

import * as React from "react"
import { Copy, Mail, MapPin, Phone, User, X } from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { fetchMemberContactDetails, type MemberContactDetailsDto } from "@/hooks/use-member-contact-details-query"
import { cn, getUserInitials } from "@/lib/utils"

function formatFullName(details: MemberContactDetailsDto) {
  const name = [details.first_name, details.last_name].filter(Boolean).join(" ").trim()
  return name || details.email || "Member"
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

  const fullName = details ? formatFullName(details) : title
  const initials = details ? getUserInitials(details.first_name, details.last_name, details.email) : "?"
  const email = details?.email ?? null
  const phone = details?.phone ?? null
  const rawAddress = details?.street_address ?? null
  const address = typeof rawAddress === "string" ? rawAddress.trim() : ""
  const hasAddress = Boolean(address)

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
    if (hasAddress) parts.push(`Address: ${address}`)
    await copyToClipboard(parts.join("\n"), "Contact details")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          "p-0 border-none shadow-2xl rounded-[24px] overflow-hidden flex flex-col",
          "[&_button]:cursor-pointer [&_button:disabled]:cursor-not-allowed",
          "w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] sm:w-full sm:max-w-[560px]"
        )}
      >
        <div className="flex flex-1 min-h-0 flex-col overflow-hidden bg-white">
          <DialogHeader className="px-6 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-5 text-left sm:pt-6 shrink-0">
            <div className="flex items-start gap-4">
              <Avatar className="h-12 w-12 shrink-0 rounded-full border border-slate-200 bg-slate-50">
                <AvatarFallback className="bg-slate-100 text-sm font-semibold text-slate-700">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <DialogTitle className="truncate text-xl font-bold tracking-tight text-slate-900">
                  {loading ? <Skeleton className="h-6 w-40" /> : fullName}
                </DialogTitle>
                <DialogDescription
                  className={cn(
                    "mt-0.5 truncate text-sm",
                    error ? "text-destructive" : "text-slate-500"
                  )}
                >
                  {error
                    ? error
                    : loading
                      ? "Loading contact details…"
                      : email ?? "No email on file"}
                </DialogDescription>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => onOpenChange(false)}
                aria-label="Close"
                className="shrink-0 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {!error && (loading || email || phone) ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {email ? (
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="h-9 rounded-xl border-slate-200 bg-white text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                  >
                    <a href={`mailto:${email}`}>
                      <Mail className="h-3.5 w-3.5" />
                      Email
                    </a>
                  </Button>
                ) : null}
                {phone ? (
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="h-9 rounded-xl border-slate-200 bg-white text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                  >
                    <a href={`tel:${phone}`}>
                      <Phone className="h-3.5 w-3.5" />
                      Call
                    </a>
                  </Button>
                ) : null}
                {details ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={copyAll}
                    className="h-9 rounded-xl border-slate-200 bg-white text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Copy all
                  </Button>
                ) : null}
              </div>
            ) : null}
          </DialogHeader>

          <div className="flex-1 space-y-3 overflow-y-auto px-6 pb-6">
            <div className="mb-3 flex items-center gap-2 border-b border-slate-100 pb-3">
              <User className="h-4 w-4 text-slate-500" />
              <span className="text-[13px] font-semibold text-slate-900">Contact details</span>
            </div>

            <ContactRow
              icon={<Mail className="h-4 w-4" />}
              label="Email"
              value={email}
              loading={loading}
              copyLabel="Email"
              loadingWidth="w-44"
            />

            <ContactRow
              icon={<Phone className="h-4 w-4" />}
              label="Phone"
              value={phone}
              loading={loading}
              copyLabel="Phone"
              loadingWidth="w-28"
            />

            <ContactRow
              icon={<MapPin className="h-4 w-4" />}
              label="Address"
              value={hasAddress ? address : null}
              loading={loading}
              copyLabel="Address"
              multiline
              loadingWidth="w-56"
            />
          </div>

          <div className="border-t border-slate-100 bg-white px-6 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pb-4 shrink-0">
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                className="h-11 rounded-xl px-5 text-sm font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              >
                Close
              </Button>
              <div className="flex flex-1 justify-end">
                <Button
                  type="button"
                  onClick={openProfile}
                  disabled={!details?.id}
                  className="h-11 rounded-xl bg-slate-900 px-6 text-sm font-semibold text-white shadow-lg shadow-slate-900/10 transition-shadow hover:bg-slate-900 hover:text-white hover:shadow-xl hover:shadow-slate-900/20 disabled:bg-slate-300 disabled:text-white disabled:shadow-none"
                >
                  Open member profile
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function ContactRow({
  icon,
  label,
  value,
  loading,
  copyLabel,
  multiline = false,
  loadingWidth = "w-40",
}: {
  icon: React.ReactNode
  label: string
  value: string | null
  loading: boolean
  copyLabel: string
  multiline?: boolean
  loadingWidth?: string
}) {
  const hasValue = Boolean(value)

  return (
    <div
      className={cn(
        "group rounded-xl border border-slate-200 bg-white p-4 transition-colors",
        hasValue && "hover:border-slate-300 hover:bg-slate-50/60"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div
            className={cn(
              "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
              hasValue ? "bg-slate-100 text-slate-600" : "bg-slate-50 text-slate-400"
            )}
          >
            {icon}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              {label}
            </div>
            <div className="mt-1 text-sm font-medium text-slate-900">
              {loading ? (
                multiline ? (
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-56" />
                    <Skeleton className="h-4 w-44" />
                  </div>
                ) : (
                  <Skeleton className={cn("h-4", loadingWidth)} />
                )
              ) : hasValue ? (
                <div
                  className={cn(
                    "text-slate-900",
                    multiline ? "whitespace-pre-wrap break-words" : "truncate"
                  )}
                >
                  {value}
                </div>
              ) : (
                <span className="text-sm font-normal italic text-slate-400">Not provided</span>
              )}
            </div>
          </div>
        </div>
        {hasValue && value ? (
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label={`Copy ${copyLabel.toLowerCase()}`}
            onClick={() => copyToClipboard(value, copyLabel)}
            className="shrink-0 rounded-lg border-slate-200 bg-white text-slate-500 opacity-100 transition-all hover:bg-slate-100 hover:text-slate-700 sm:opacity-60 sm:group-hover:opacity-100"
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
        ) : null}
      </div>
    </div>
  )
}
