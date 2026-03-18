"use client"

import * as React from "react"
import {
  CheckCircle2,
  Clock,
  Loader2,
  RefreshCw,
  UserPlus,
  XCircle,
} from "lucide-react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
export type MemberAccountAccessTabProps = {
  memberId: string
}

export type MemberAccessResponse = {
  portal_status: "active" | "pending_invite" | "not_invited"
  invite_status: "none" | "pending" | "accepted"
  account_created: boolean
  roles: { id: string; name: string }[]
  current_role: { id: string; name: string } | null
  email: string | null
  invited_at: string | null
}

async function fetchMemberAccess(memberId: string): Promise<MemberAccessResponse> {
  const response = await fetch(`/api/members/${memberId}/access`, {
    method: "GET",
    cache: "no-store",
  })
  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(payload?.error ?? "Failed to load access status")
  }

  return payload as MemberAccessResponse
}

async function inviteMember(memberId: string): Promise<{ sent: boolean }> {
  const response = await fetch(`/api/members/${memberId}/access/invite`, {
    method: "POST",
  })
  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(payload?.error ?? "Failed to send invitation")
  }

  return payload
}

async function resendInvite(memberId: string): Promise<{ sent: boolean }> {
  const response = await fetch(`/api/members/${memberId}/access/resend-invite`, {
    method: "POST",
  })
  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(payload?.error ?? "Failed to resend invitation")
  }

  return payload
}

async function cancelInvite(memberId: string): Promise<{ cancelled: boolean }> {
  const response = await fetch(`/api/members/${memberId}/access/cancel-invite`, {
    method: "POST",
  })
  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(payload?.error ?? "Failed to cancel invitation")
  }

  return payload
}

async function updateMemberRole(
  memberId: string,
  roleId: string
): Promise<{ updated: boolean }> {
  const response = await fetch(`/api/members/${memberId}/access`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role_id: roleId }),
  })
  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(payload?.error ?? "Failed to update role")
  }

  return payload
}

export function MemberAccountAccessTab({ memberId }: MemberAccountAccessTabProps) {
  const queryClient = useQueryClient()

  const {
    data: access,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["member-access", memberId],
    queryFn: () => fetchMemberAccess(memberId),
    enabled: Boolean(memberId),
  })

  const inviteMutation = useMutation({
    mutationFn: () => inviteMember(memberId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["member-access", memberId] })
      toast.success("Invitation sent successfully")
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to send invitation")
    },
  })

  const resendMutation = useMutation({
    mutationFn: () => resendInvite(memberId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["member-access", memberId] })
      toast.success("Invitation resent")
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to resend invitation")
    },
  })

  const cancelMutation = useMutation({
    mutationFn: () => cancelInvite(memberId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["member-access", memberId] })
      toast.success("Invitation cancelled")
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to cancel invitation")
    },
  })

  const roleMutation = useMutation({
    mutationFn: (roleId: string) => updateMemberRole(memberId, roleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["member-access", memberId] })
      toast.success("Role updated")
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to update role")
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

  const statusLabel =
    access.portal_status === "active"
      ? "Active"
      : access.portal_status === "pending_invite"
        ? "Pending invite"
        : "Not invited"

  const StatusIcon =
    access.portal_status === "active"
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

  const InviteIcon =
    access.invite_status === "accepted"
      ? CheckCircle2
      : access.invite_status === "pending"
        ? Clock
        : XCircle

  const AccountIcon = access.account_created ? CheckCircle2 : XCircle

  return (
    <div className="rounded-md border border-slate-200 bg-white p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="flex items-center gap-2 font-medium text-slate-900">
            <StatusIcon
              className={
                access.portal_status === "active"
                  ? "h-4 w-4 text-slate-600"
                  : access.portal_status === "pending_invite"
                    ? "h-4 w-4 text-slate-500"
                    : "h-4 w-4 text-slate-400"
              }
            />
            {statusLabel}
          </p>
          <p className="text-sm text-slate-500">
            {access.portal_status === "active"
              ? "Member has access to the portal."
              : access.portal_status === "pending_invite"
                ? "Invitation sent — awaiting acceptance."
                : "No portal access yet."}
          </p>
          <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <div className="flex items-center gap-1.5">
              <InviteIcon
                className={
                  access.invite_status === "accepted"
                    ? "h-4 w-4 text-slate-600"
                    : access.invite_status === "pending"
                      ? "h-4 w-4 text-slate-500"
                      : "h-4 w-4 text-slate-400"
                }
              />
              <dt className="font-medium text-slate-600">Invited:</dt>{" "}
              <dd className="text-slate-700">{inviteLabel}</dd>
            </div>
            <div className="flex items-center gap-1.5">
              <AccountIcon
                className={
                  access.account_created
                    ? "h-4 w-4 text-slate-600"
                    : "h-4 w-4 text-slate-400"
                }
              />
              <dt className="font-medium text-slate-600">Account:</dt>{" "}
              <dd className="text-slate-700">
                {access.account_created ? "Yes" : "No"}
              </dd>
            </div>
          </dl>
        </div>

        {access.portal_status === "not_invited" && (
          <Button
            onClick={() => inviteMutation.mutate()}
            disabled={isInviting || !access.email}
            size="sm"
          >
            {inviteMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <UserPlus className="mr-2 h-4 w-4" />
            )}
            Invite
          </Button>
        )}

        {access.portal_status === "pending_invite" && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => resendMutation.mutate()}
              disabled={isInviting}
            >
              {resendMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Resend
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => cancelMutation.mutate()}
              disabled={isInviting}
            >
              {cancelMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <XCircle className="mr-2 h-4 w-4" />
              )}
              Cancel
            </Button>
          </div>
        )}
      </div>

      {access.roles.length > 0 && (
        <div className="mt-4 flex items-center gap-3 border-t border-slate-200 pt-4">
          <span className="text-sm text-slate-600">Role</span>
          <Select
            value={access.current_role?.id ?? ""}
            onValueChange={(value) => roleMutation.mutate(value)}
            disabled={roleMutation.isPending}
          >
            <SelectTrigger className="h-9 w-[140px]">
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              {access.roles.map((role) => (
                <SelectItem key={role.id} value={role.id}>
                  {role.name.charAt(0).toUpperCase() + role.name.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {roleMutation.isPending && (
            <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
          )}
        </div>
      )}
    </div>
  )
}
