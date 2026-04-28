"use client"

import * as React from "react"
import { useQueryClient } from "@tanstack/react-query"
import {
  AlertTriangle,
  CalendarCheck2,
  CheckCircle,
  Pencil,
  RefreshCw,
  Users,
  XCircle,
} from "lucide-react"
import { CreateMembershipModal } from "@/components/members/create-membership-modal"
import { EditActiveMembershipModal } from "@/components/members/edit-active-membership-modal"
import { RenewMembershipModal } from "@/components/members/renew-membership-modal"
import { memberMembershipsQueryKey, useMemberMembershipsQuery } from "@/hooks/use-member-memberships-query"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import type {
  MembershipYearSettings,
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
  isMembershipEligibleForRenewal,
  isMembershipExpiringSoon,
} from "@/lib/utils/membership-utils"
import { useTimezone } from "@/contexts/timezone-context"
import { formatDate } from "@/lib/utils/date-format"

export function MemberMemberships({
  memberId,
  initialSummary,
  membershipTypes,
  defaultTaxRate,
  membershipYear,
}: {
  memberId: string
  initialSummary: MembershipSummary
  membershipTypes: MembershipTypeWithChargeable[]
  defaultTaxRate: TenantDefaultTaxRate
  membershipYear: MembershipYearSettings | null
}) {
  const queryClient = useQueryClient()
  const { timeZone } = useTimezone()
  const { data: membershipsData } = useMemberMembershipsQuery(memberId, {
    summary: initialSummary,
    membershipTypes,
    defaultTaxRate,
    membershipYear,
  })
  const membershipSummary = membershipsData.summary
  const currentMembershipTypes = membershipsData.membershipTypes
  const currentDefaultTaxRate = membershipsData.defaultTaxRate
  const currentMembershipYear = membershipsData.membershipYear
  const [showRenewalModal, setShowRenewalModal] = React.useState(false)
  const [showCreateModal, setShowCreateModal] = React.useState(false)
  const [showEditModal, setShowEditModal] = React.useState(false)

  const currentMembership = membershipSummary?.current_membership
  const status = membershipSummary?.status ?? "none"
  const canRenewMembership = currentMembership
    ? isMembershipEligibleForRenewal(currentMembership, timeZone)
    : false
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
                            currentDefaultTaxRate?.rate,
                            currentDefaultTaxRate?.tax_name
                  )}
                </p>
              </div>
              <div className="space-y-0.5">
                <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
                  Started
                </p>
                <p className="text-sm font-semibold text-slate-900">
                  {formatDate(currentMembership.start_date, timeZone)}
                </p>
              </div>
              <div className="space-y-0.5">
                <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
                  Expires
                </p>
                <p
                  className={
                    isMembershipExpiringSoon(currentMembership, timeZone)
                      ? "text-sm font-semibold text-orange-600"
                      : "text-sm font-semibold text-slate-900"
                  }
                >
                  {formatDate(currentMembership.expiry_date, timeZone)}
                </p>
                {status === "active" ? (
                  <p className="text-xs text-slate-500">
                    {getDaysUntilExpiry(currentMembership, timeZone)} days remaining
                  </p>
                ) : null}
                {status === "grace" ? (
                  <p className="text-xs text-orange-600">
                    Grace period: {getGracePeriodRemaining(currentMembership, timeZone)} days left
                  </p>
                ) : null}
              </div>
            </div>

            {isMembershipExpiringSoon(currentMembership, timeZone) ? (
              <div className="rounded-md border border-orange-200 bg-orange-50 p-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-orange-600" />
                  <span className="text-sm text-orange-800">
                    Membership expires soon. Renew now to avoid interruption.
                  </span>
                </div>
              </div>
            ) : null}

            {currentMembership.is_active || canRenewMembership ? (
              <div className="flex flex-col gap-2 border-t border-slate-100 pt-3 sm:flex-row sm:flex-wrap">
                {currentMembership.is_active ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowEditModal(true)}
                    className="w-full sm:w-auto"
                    size="sm"
                  >
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit membership
                  </Button>
                ) : null}
                {canRenewMembership ? (
                  <Button
                    type="button"
                    onClick={() => setShowRenewalModal(true)}
                    className="w-full bg-slate-900 text-white hover:bg-slate-800 sm:w-auto"
                    size="sm"
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Renew Membership
                  </Button>
                ) : null}
              </div>
            ) : null}
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
                    <th className="py-3 text-left font-medium text-slate-900">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {membershipSummary.membership_history.map((membership) => {
                    const rowStatus = calculateMembershipStatus(membership, timeZone)
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
                            <span>{formatDate(membership.start_date, timeZone)}</span>
                            <span className="text-xs text-slate-500">
                              to {formatDate(membership.expiry_date, timeZone)}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 pr-4 text-sm font-medium text-slate-900">
                          {calculateMembershipFee(
                            membership.membership_types?.chargeables?.rate,
                            membership.membership_types?.chargeables?.is_taxable,
                            currentDefaultTaxRate?.rate,
                            currentDefaultTaxRate?.tax_name
                          )}
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
                const rowStatus = calculateMembershipStatus(membership, timeZone)
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
                            currentDefaultTaxRate?.rate,
                            currentDefaultTaxRate?.tax_name
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Period:</span>
                        <span className="font-medium text-slate-900">
                          {formatDate(membership.start_date, timeZone)} - {formatDate(membership.expiry_date, timeZone)}
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

      {currentMembership?.is_active ? (
        <EditActiveMembershipModal
          open={showEditModal}
          onClose={() => setShowEditModal(false)}
          onSuccess={async () => {
            await queryClient.invalidateQueries({ queryKey: memberMembershipsQueryKey(memberId) })
          }}
          memberId={memberId}
          membership={currentMembership}
          defaultTaxRate={currentDefaultTaxRate}
        />
      ) : null}

      {currentMembership ? (
        <RenewMembershipModal
          open={showRenewalModal}
          onClose={() => setShowRenewalModal(false)}
          onSuccess={async () => {
            await queryClient.invalidateQueries({ queryKey: memberMembershipsQueryKey(memberId) })
          }}
          memberId={memberId}
          currentMembership={currentMembership}
          membershipTypes={currentMembershipTypes}
          defaultTaxRate={currentDefaultTaxRate}
          membershipYear={currentMembershipYear}
        />
      ) : null}

      {currentMembershipTypes.length ? (
        <CreateMembershipModal
          open={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSuccess={async () => {
            await queryClient.invalidateQueries({ queryKey: memberMembershipsQueryKey(memberId) })
          }}
          memberId={memberId}
          membershipTypes={currentMembershipTypes}
          defaultTaxRate={currentDefaultTaxRate}
          membershipYear={currentMembershipYear}
        />
      ) : null}
    </div>
  )
}
