"use client"

import * as React from "react"
import {
  BookOpen,
  Check,
  CheckCircle2,
  Clock,
  GraduationCap,
  Loader2,
  Mail,
  MailCheck,
  MailX,
  RefreshCw,
  Shield,
  ShieldCheck,
  User,
  UserCheck,
  UserPlus,
  UserX,
  Users,
  XCircle,
} from "lucide-react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Select as SelectPrimitive } from "radix-ui"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  cancelMemberInvite,
  inviteMemberAccess,
  memberAccessQueryKey,
  resendMemberInvite,
  updateMemberPortalRestricted,
  updateMemberRoleAccess,
  useMemberAccessQuery,
  type MemberAccessResponse,
} from "@/hooks/use-member-access-query"
import {
  Select,
  SelectContent,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"

export type MemberAccountAccessTabProps = {
  memberId: string
}

function EmailInviteStatusIcon({
  status,
}: {
  status: MemberAccessResponse["invite_status"]
}) {
  const iconClass = "h-3.5 w-3.5 shrink-0"
  if (status === "accepted") {
    return <MailCheck className={cn(iconClass, "text-emerald-600")} aria-hidden />
  }
  if (status === "pending") {
    return <Mail className={cn(iconClass, "text-amber-600")} aria-hidden />
  }
  return <MailX className={cn(iconClass, "text-slate-400")} aria-hidden />
}

function AppAccountStatusIcon({ created }: { created: boolean }) {
  const iconClass = "h-3.5 w-3.5 shrink-0"
  if (created) {
    return <UserCheck className={cn(iconClass, "text-emerald-600")} aria-hidden />
  }
  return <UserX className={cn(iconClass, "text-slate-400")} aria-hidden />
}

function RoleIcon({
  roleName,
  className,
}: {
  roleName: string
  className?: string
}) {
  const n = roleName.toLowerCase()
  const iconClass = cn("size-4 shrink-0", className)
  if (n === "owner") return <Shield className={iconClass} aria-hidden />
  if (n === "admin") return <ShieldCheck className={iconClass} aria-hidden />
  if (n === "instructor") return <GraduationCap className={iconClass} aria-hidden />
  if (n === "student") return <BookOpen className={iconClass} aria-hidden />
  if (n === "member") return <User className={iconClass} aria-hidden />
  return <Users className={iconClass} aria-hidden />
}

/** Icon stays outside `ItemText` so the trigger only mirrors the label, not a duplicate icon. */
function RoleSelectItem({
  value,
  label,
  roleName,
}: {
  value: string
  label: string
  roleName: string
}) {
  return (
    <SelectPrimitive.Item
      value={value}
      textValue={label}
      className="focus:bg-accent focus:text-accent-foreground relative w-full cursor-default select-none rounded-md py-0 pr-8 pl-2 text-sm text-slate-900 outline-none data-[highlighted]:bg-slate-100 data-[state=checked]:bg-slate-100/80 data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
    >
      <div className="flex items-center gap-2.5 py-2.5">
        <RoleIcon roleName={roleName} className="text-slate-500" />
        <SelectPrimitive.ItemText asChild>
          <span className="font-medium leading-none">{label}</span>
        </SelectPrimitive.ItemText>
      </div>
      <span className="pointer-events-none absolute right-2 top-1/2 flex -translate-y-1/2">
        <SelectPrimitive.ItemIndicator>
          <Check className="size-4 text-slate-600" strokeWidth={2.5} aria-hidden />
        </SelectPrimitive.ItemIndicator>
      </span>
    </SelectPrimitive.Item>
  )
}

export function MemberAccountAccessTab({ memberId }: MemberAccountAccessTabProps) {
  const queryClient = useQueryClient()

  const {
    data: access,
    isLoading,
    error,
    refetch,
  } = useMemberAccessQuery(memberId)

  const inviteMutation = useMutation({
    mutationFn: () => inviteMemberAccess(memberId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: memberAccessQueryKey(memberId) })
      toast.success("Invitation sent successfully")
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to send invitation")
    },
  })

  const resendMutation = useMutation({
    mutationFn: () => resendMemberInvite(memberId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: memberAccessQueryKey(memberId) })
      toast.success("Invitation resent")
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to resend invitation")
    },
  })

  const cancelMutation = useMutation({
    mutationFn: () => cancelMemberInvite(memberId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: memberAccessQueryKey(memberId) })
      toast.success("Invitation cancelled")
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to cancel invitation")
    },
  })

  const roleMutation = useMutation({
    mutationFn: (roleId: string) => updateMemberRoleAccess(memberId, roleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: memberAccessQueryKey(memberId) })
      toast.success("Role updated")
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to update role")
    },
  })

  const restrictMutation = useMutation({
    mutationFn: (isRestricted: boolean) =>
      updateMemberPortalRestricted(memberId, isRestricted),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: memberAccessQueryKey(memberId) })
      toast.success("Portal login access updated")
    },
    onError: (err) => {
      toast.error(
        err instanceof Error ? err.message : "Failed to update portal access"
      )
    },
  })

  const isInviting =
    inviteMutation.isPending ||
    resendMutation.isPending ||
    cancelMutation.isPending

  if (isLoading) {
    return (
      <div className="flex h-32 items-center justify-center text-sm text-slate-500">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading...
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-md border border-slate-200 bg-white p-4">
        <p className="mb-2 text-sm text-slate-700">
          {error instanceof Error ? error.message : "Failed to load access status"}
        </p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Retry
        </Button>
      </div>
    )
  }

  if (!access) return null

  const loginDisabled =
    access.is_restricted_login && access.can_toggle_restricted_login

  const statusLabel = loginDisabled
    ? "Login disabled"
    : access.portal_status === "active"
      ? "Active"
      : access.portal_status === "pending_invite"
        ? "Pending invite"
        : "Not invited"

  const StatusIcon = loginDisabled
    ? XCircle
    : access.portal_status === "active"
      ? CheckCircle2
      : access.portal_status === "pending_invite"
        ? Clock
        : XCircle

  const inviteLabel =
    access.invite_status === "accepted"
      ? "Accepted"
      : access.invite_status === "pending"
        ? "Pending"
        : "Not invited"

  const inviteSummary =
    access.invite_status === "none" ? "Not sent" : inviteLabel

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200/90 bg-white shadow-sm">
      {/* Portal & invitation */}
      <div className="p-4 sm:p-5">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          Portal & sign-in
        </h3>
        <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <div className="min-w-0 max-w-lg space-y-2">
            <p className="flex items-center gap-2.5 text-base font-medium text-slate-900">
              <StatusIcon
                className={
                  loginDisabled
                    ? "h-5 w-5 shrink-0 text-amber-600"
                    : access.portal_status === "active"
                      ? "h-5 w-5 shrink-0 text-emerald-600"
                      : access.portal_status === "pending_invite"
                        ? "h-5 w-5 shrink-0 text-slate-500"
                        : "h-5 w-5 shrink-0 text-slate-400"
                }
              />
              {statusLabel}
            </p>
            <p className="text-sm leading-relaxed text-slate-600">
              {loginDisabled
                ? "This account cannot use the member portal until portal login is allowed again."
                : access.portal_status === "active"
                  ? "They can use the member portal with this account."
                  : access.portal_status === "pending_invite"
                    ? "An email invite was sent; they need to accept it to sign in."
                    : "They are not set up to sign in to the member portal yet. Send an invite if they need access."}
            </p>
            <div className="mt-1 rounded-md border border-slate-100 bg-slate-50/80 px-3 py-3">
              <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 sm:gap-x-8">
                <div className="space-y-1">
                  <dt className="text-xs text-slate-500">Email invite</dt>
                  <dd className="flex items-center gap-2 font-medium text-slate-800">
                    <EmailInviteStatusIcon status={access.invite_status} />
                    <span>{inviteSummary}</span>
                  </dd>
                </div>
                <div className="space-y-1">
                  <dt className="text-xs text-slate-500">App account</dt>
                  <dd className="flex items-center gap-2 font-medium text-slate-800">
                    <AppAccountStatusIcon created={access.account_created} />
                    <span>
                      {access.account_created ? "Created" : "Not created"}
                    </span>
                  </dd>
                </div>
              </dl>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2 sm:pt-0.5">
            {access.portal_status === "not_invited" && (
              <Button
                type="button"
                onClick={() => inviteMutation.mutate()}
                disabled={isInviting || !access.email}
                className="h-10 bg-slate-900 px-4 font-semibold text-white shadow-sm hover:bg-slate-800"
              >
                {inviteMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <UserPlus className="mr-2 h-4 w-4" />
                )}
                Send invite
              </Button>
            )}

            {access.portal_status === "pending_invite" && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => resendMutation.mutate()}
                  disabled={isInviting}
                  className="h-10 border-slate-200 bg-white font-semibold text-slate-800 hover:bg-slate-50"
                >
                  {resendMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-4 w-4" />
                  )}
                  Resend
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => cancelMutation.mutate()}
                  disabled={isInviting}
                  className="h-10 border-slate-200 bg-white font-semibold text-slate-800 hover:bg-slate-50"
                >
                  {cancelMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <XCircle className="mr-2 h-4 w-4" />
                  )}
                  Cancel
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {access.can_toggle_restricted_login && (
        <div className="border-t border-slate-100 px-4 py-4 sm:px-5">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Access control
          </h3>
          <div className="mt-3 flex max-w-md items-center justify-between gap-4">
            <p className="text-sm text-slate-800">Block portal login</p>
            <div className="flex items-center gap-2">
              {restrictMutation.isPending && (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-slate-400" />
              )}
              <Switch
                checked={access.is_restricted_login}
                onCheckedChange={(v) => restrictMutation.mutate(v)}
                disabled={restrictMutation.isPending}
                aria-label="Block portal login"
              />
            </div>
          </div>
        </div>
      )}

      {access.roles.length > 0 && (
        <div className="border-t border-slate-100 px-4 py-4 sm:px-5">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Role in organization
          </h3>
          <div className="mt-3 max-w-sm space-y-2">
            <p className="text-sm text-slate-600">App role</p>
            <div className="flex items-center gap-2.5">
              <Select
                value={access.current_role?.id ?? ""}
                onValueChange={(value) => roleMutation.mutate(value)}
                disabled={roleMutation.isPending}
              >
                <SelectTrigger
                  className={cn(
                    "h-11 w-full min-w-0 border-slate-200/90 bg-white pl-3 pr-2 shadow-sm",
                    "hover:bg-slate-50/90 data-[state=open]:bg-slate-50/90",
                    "data-[state=open]:ring-2 data-[state=open]:ring-slate-200/80",
                    "focus-visible:ring-2 focus-visible:ring-slate-300/60",
                    // Single left-aligned row + chevron; do not space inner content to center
                    "gap-0 !justify-between *:data-[slot=select-value]:!block *:data-[slot=select-value]:text-left *:data-[slot=select-value]:!font-medium"
                  )}
                >
                  <div className="flex min-w-0 flex-1 items-center justify-start gap-2.5 text-left">
                    {access.current_role ? (
                      <RoleIcon
                        roleName={access.current_role.name}
                        className="shrink-0 text-slate-600"
                      />
                    ) : (
                      <Users
                        className="size-4 shrink-0 text-slate-500"
                        aria-hidden
                      />
                    )}
                    <SelectValue
                      placeholder="Select a role"
                      className="!block min-w-0 flex-1 truncate text-left"
                    />
                  </div>
                </SelectTrigger>
                <SelectContent
                  position="popper"
                  sideOffset={4}
                  align="start"
                  className={cn(
                    "w-[var(--radix-select-trigger-width)] min-w-[var(--radix-select-trigger-width)] rounded-lg border-slate-200/90 p-1 shadow-md"
                  )}
                >
                  {access.roles.map((role) => {
                    const label =
                      role.name.charAt(0).toUpperCase() + role.name.slice(1)
                    return (
                      <RoleSelectItem
                        key={role.id}
                        value={role.id}
                        label={label}
                        roleName={role.name}
                      />
                    )
                  })}
                </SelectContent>
              </Select>
              {roleMutation.isPending && (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-slate-400" />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
