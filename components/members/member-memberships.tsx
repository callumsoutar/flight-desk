"use client"

import * as React from "react"
import {
  AlertTriangle,
  CalendarCheck2,
  CheckCircle,
  RefreshCw,
  Users,
  XCircle,
} from "lucide-react"
import { toast } from "sonner"

import {
  createMemberMembershipAction,
  renewMemberMembershipAction,
} from "@/app/members/actions"
import { CreateMembershipModal } from "@/components/members/create-membership-modal"
import { RenewMembershipModal } from "@/components/members/renew-membership-modal"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import type {
  MembershipSummary,
  TenantDefaultTaxRate,
  MembershipTypeWithChargeable,
} from "@/lib/types/memberships"
import {
  calculateMembershipFee,
  calculateMembershipStatus,
  getDaysUntilExpiry,
  getGracePeriodRemaining,
  getMembershipCardBorderClass,
  getStatusBadgeClasses,
  getStatusText,
  isMembershipExpiringSoon,
} from "@/lib/utils/membership-utils"

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Invalid date"
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  })
}

export function MemberMemberships({
  memberId,
  initialSummary,
  membershipTypes,
  defaultTaxRate,
}: {
  memberId: string
  initialSummary: MembershipSummary
  membershipTypes: MembershipTypeWithChargeable[]
  defaultTaxRate: TenantDefaultTaxRate
}) {
  const [membershipSummary, setMembershipSummary] =
    React.useState<MembershipSummary | null>(initialSummary)
  const [error, setError] = React.useState<string | null>(null)
  const [isRenewing, setIsRenewing] = React.useState(false)
  const [showRenewalModal, setShowRenewalModal] = React.useState(false)
  const [showCreateModal, setShowCreateModal] = React.useState(false)

  const currentMembership = membershipSummary?.current_membership
  const status = membershipSummary?.status ?? "none"
  const borderClass = getMembershipCardBorderClass(status)
  const IconComponent =
    status === "active"
      ? CheckCircle
      : status === "expired"
        ? XCircle
        : AlertTriangle
  const iconColor =
    status === "active"
      ? "text-green-600"
      : status === "expired"
        ? "text-red-600"
        : "text-amber-600"

  const handleRenewMembership = async (renewalData: {
    membership_type_id?: string
    notes?: string
    create_invoice: boolean
  }) => {
    if (!membershipSummary?.current_membership?.id) {
      toast.error("No active membership to renew")
      return
    }

    setIsRenewing(true)
    setError(null)
    try {
      const result = await renewMemberMembershipAction({
        memberId,
        currentMembershipId: membershipSummary.current_membership.id,
        ...renewalData,
      })
      if (!result.ok) {
        setError(result.error)
        toast.error(result.error)
        return
      }
      setMembershipSummary(result.summary)
      setShowRenewalModal(false)
      toast.success("Membership renewed successfully")
    } finally {
      setIsRenewing(false)
    }
  }

  const handleCreateMembership = async (membershipData: {
    user_id: string
    membership_type_id: string
    custom_expiry_date?: string
    notes?: string
    create_invoice: boolean
  }) => {
    setIsRenewing(true)
    setError(null)
    try {
      const result = await createMemberMembershipAction({
        memberId: membershipData.user_id,
        membership_type_id: membershipData.membership_type_id,
        custom_expiry_date: membershipData.custom_expiry_date ?? null,
        notes: membershipData.notes ?? null,
        create_invoice: membershipData.create_invoice,
      })
      if (!result.ok) {
        setError(result.error)
        toast.error(result.error)
        return
      }
      setMembershipSummary(result.summary)
      setShowCreateModal(false)
      toast.success("Membership created successfully")
    } finally {
      setIsRenewing(false)
    }
  }

  return (
    <div className="w-full space-y-6">
      {currentMembership ? (
        <Card
          className={`border-l-4 ${borderClass} rounded-xl border border-slate-200/80 bg-gradient-to-br from-white to-slate-50/30 shadow-sm`}
        >
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <IconComponent className={`h-5 w-5 ${iconColor}`} />
                <h3 className="text-lg font-semibold text-slate-900">
                  Current Membership
                </h3>
              </div>
              <Badge className={getStatusBadgeClasses(status)}>
                {getStatusText(status)}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-x-8 gap-y-3.5 sm:grid-cols-2">
              <div className="space-y-0.5">
                <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
                  Type
                </p>
                <p className="text-sm font-semibold text-slate-900">
                  {currentMembership.membership_types?.name || "Unknown"}
                </p>
              </div>
              <div className="space-y-0.5">
                <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
                  Annual Fee
                </p>
                <p className="text-sm font-semibold text-slate-900">
                  {calculateMembershipFee(
                    currentMembership.membership_types?.chargeables?.rate,
                    currentMembership.membership_types?.chargeables?.is_taxable,
                    defaultTaxRate?.rate,
                    defaultTaxRate?.tax_name
                  )}
                </p>
              </div>
              <div className="space-y-0.5">
                <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
                  Started
                </p>
                <p className="text-sm font-semibold text-slate-900">
                  {formatDate(currentMembership.start_date)}
                </p>
              </div>
              <div className="space-y-0.5">
                <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
                  Expires
                </p>
                <p
                  className={
                    isMembershipExpiringSoon(currentMembership)
                      ? "text-sm font-semibold text-orange-600"
                      : "text-sm font-semibold text-slate-900"
                  }
                >
                  {formatDate(currentMembership.expiry_date)}
                </p>
                {status === "active" ? (
                  <p className="text-xs text-slate-500">
                    {getDaysUntilExpiry(currentMembership)} days remaining
                  </p>
                ) : null}
                {status === "grace" ? (
                  <p className="text-xs text-orange-600">
                    Grace period: {getGracePeriodRemaining(currentMembership)} days left
                  </p>
                ) : null}
              </div>
            </div>

            {status === "unpaid" ? (
              <div className="rounded-md border border-red-200 bg-red-50 p-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  <span className="text-sm text-red-800">
                    Payment required. Membership benefits are suspended until payment is received.
                  </span>
                </div>
              </div>
            ) : null}

            {status !== "unpaid" && isMembershipExpiringSoon(currentMembership) ? (
              <div className="rounded-md border border-orange-200 bg-orange-50 p-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-orange-600" />
                  <span className="text-sm text-orange-800">
                    Membership expires soon. Renew now to avoid interruption.
                  </span>
                </div>
              </div>
            ) : null}

            <div className="flex flex-col gap-2 border-t border-slate-100 pt-3 sm:flex-row">
              <Button
                onClick={() => setShowRenewalModal(true)}
                disabled={isRenewing}
                className="w-full bg-slate-900 text-white hover:bg-slate-800 sm:w-auto"
                size="sm"
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${isRenewing ? "animate-spin" : ""}`} />
                {isRenewing
                  ? "Processing..."
                  : status === "unpaid"
                    ? "Pay / Renew Membership"
                    : "Renew Membership"}
              </Button>
              {currentMembership.invoice_id ? (
                <Button
                  variant="outline"
                  onClick={() =>
                    window.open(`/invoices/${currentMembership.invoice_id}`, "_blank")
                  }
                  size="sm"
                  className="w-full sm:w-auto"
                >
                  View Invoice
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="rounded-xl border border-slate-200 shadow-sm">
          <CardContent className="py-12 text-center">
            <Users className="mx-auto mb-4 h-12 w-12 text-slate-400" />
            <h3 className="mb-2 text-lg font-medium text-slate-900">
              No Active Membership
            </h3>
            <p className="mb-6 text-slate-600">
              This member doesn&apos;t currently have an active membership.
            </p>
            <Button
              onClick={() => setShowCreateModal(true)}
              className="bg-slate-900 text-white hover:bg-slate-800"
            >
              Create Membership
            </Button>
          </CardContent>
        </Card>
      )}

      {membershipSummary?.membership_history?.length ? (
        <Card className="rounded-xl border border-slate-200 shadow-sm">
          <CardHeader>
            <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
              <CalendarCheck2 className="h-5 w-5 text-slate-500" />
              Membership History
            </h3>
          </CardHeader>
          <CardContent>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="py-3 pr-4 text-left font-medium text-slate-900">Type</th>
                    <th className="py-3 pr-4 text-left font-medium text-slate-900">Status</th>
                    <th className="py-3 pr-4 text-left font-medium text-slate-900">Period</th>
                    <th className="py-3 pr-4 text-left font-medium text-slate-900">Fee</th>
                    <th className="py-3 pr-4 text-left font-medium text-slate-900">Payment</th>
                    <th className="py-3 text-left font-medium text-slate-900">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {membershipSummary.membership_history.map((membership) => {
                    const rowStatus = calculateMembershipStatus(membership)
                    return (
                      <tr
                        key={membership.id}
                        className="border-b border-slate-100 transition-colors hover:bg-slate-50"
                      >
                        <td className="py-3 pr-4 text-sm font-medium text-slate-900">
                          {membership.membership_types?.name || "Unknown"}
                        </td>
                        <td className="py-3 pr-4">
                          <Badge className={getStatusBadgeClasses(rowStatus)}>
                            {getStatusText(rowStatus)}
                          </Badge>
                        </td>
                        <td className="py-3 pr-4 text-sm text-slate-600">
                          <div className="flex flex-col">
                            <span>{formatDate(membership.start_date)}</span>
                            <span className="text-xs text-slate-500">
                              to {formatDate(membership.expiry_date)}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 pr-4 text-sm font-medium text-slate-900">
                          {calculateMembershipFee(
                            membership.membership_types?.chargeables?.rate,
                            membership.membership_types?.chargeables?.is_taxable,
                            defaultTaxRate?.rate,
                            defaultTaxRate?.tax_name
                          )}
                        </td>
                        <td className="py-3 pr-4">
                          <Badge
                            variant={membership.invoices?.status === "paid" ? "default" : "secondary"}
                            className="text-xs"
                          >
                            {membership.invoices?.status === "paid" ? "Paid" : "Unpaid"}
                          </Badge>
                        </td>
                        <td className="max-w-xs py-3 text-sm text-slate-600">
                          {membership.notes ? (
                            <span className="block truncate" title={membership.notes}>
                              {membership.notes}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="space-y-3 md:hidden">
              {membershipSummary.membership_history.map((membership) => {
                const rowStatus = calculateMembershipStatus(membership)
                return (
                  <div
                    key={membership.id}
                    className="space-y-3 rounded-lg border border-slate-200 bg-white p-4"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="text-sm font-semibold text-slate-900">
                          {membership.membership_types?.name || "Unknown"}
                        </h4>
                        <Badge className={`mt-1 ${getStatusBadgeClasses(rowStatus)}`}>
                          {getStatusText(rowStatus)}
                        </Badge>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-slate-900">
                          {calculateMembershipFee(
                            membership.membership_types?.chargeables?.rate,
                            membership.membership_types?.chargeables?.is_taxable,
                            defaultTaxRate?.rate,
                            defaultTaxRate?.tax_name
                          )}
                        </p>
                        <Badge
                          variant={membership.invoices?.status === "paid" ? "default" : "secondary"}
                          className="mt-1 text-xs"
                        >
                          {membership.invoices?.status === "paid" ? "Paid" : "Unpaid"}
                        </Badge>
                      </div>
                    </div>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Period:</span>
                        <span className="font-medium text-slate-900">
                          {formatDate(membership.start_date)} - {formatDate(membership.expiry_date)}
                        </span>
                      </div>
                      {membership.notes ? (
                        <div className="border-t border-slate-100 pt-2">
                          <span className="text-xs text-slate-500">Notes: </span>
                          <span className="text-xs text-slate-700">{membership.notes}</span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {currentMembership ? (
        <RenewMembershipModal
          open={showRenewalModal}
          onClose={() => setShowRenewalModal(false)}
          currentMembership={currentMembership}
          membershipTypes={membershipTypes}
          defaultTaxRate={defaultTaxRate}
          onRenew={handleRenewMembership}
        />
      ) : null}

      {membershipTypes.length ? (
        <CreateMembershipModal
          open={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          memberId={memberId}
          membershipTypes={membershipTypes}
          defaultTaxRate={defaultTaxRate}
          onCreateMembership={handleCreateMembership}
        />
      ) : null}
    </div>
  )
}
