"use client"

import { useState } from "react"
import { addMonths, format } from "date-fns"

import { createSupabaseBrowserClient } from "@/lib/supabase/client"

type MembershipMode = "create" | "renew"

type MembershipTypeInput = {
  id: string
  name: string
  duration_months: number
  chargeable_id: string | null
}

type ChargeableInput = {
  id: string
  name: string
  rate: number
  is_taxable: boolean
} | null

function toInvoiceReadyChargeable(
  chargeable: {
    id: string
    name: string
    rate: number | null
    is_taxable: boolean | null
  } | null
): ChargeableInput {
  if (!chargeable) return null
  if (chargeable.rate === null || chargeable.is_taxable === null) return null

  return {
    id: chargeable.id,
    name: chargeable.name,
    rate: chargeable.rate,
    is_taxable: chargeable.is_taxable,
  }
}

export interface MembershipFormPayload {
  userId: string
  membershipTypeId: string
  membershipType: MembershipTypeInput
  chargeable?: ChargeableInput
  startDate: Date
  expiryDate: Date
  notes?: string
  autoRenew?: boolean
  gracePeriodDays?: number
  mode: MembershipMode
}

interface UseMembershipSubmitOptions {
  onSuccess?: (result: { membershipId: string; invoiceId?: string }) => void
  onError?: (error: Error) => void
}

type CreateInvoiceResult = {
  success: boolean
  invoice_id?: string
  error?: string
  message?: string
}

export function useMembershipSubmit(options?: UseMembershipSubmitOptions) {
  const supabase = createSupabaseBrowserClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const submit = async (payload: MembershipFormPayload, createInvoice: boolean) => {
    setLoading(true)
    setError(null)

    try {
      if (!payload.expiryDate) {
        throw new Error("Expiry date is required.")
      }

      if (payload.expiryDate <= payload.startDate) {
        throw new Error("Expiry date must be after the start date.")
      }

      if (payload.expiryDate < addMonths(payload.startDate, 1)) {
        throw new Error("Expiry date must be at least 1 month after the start date.")
      }

      let invoiceId: string | null = null

      if (createInvoice) {
        if (!payload.membershipType.chargeable_id) {
          throw new Error(
            `Membership type "${payload.membershipType.name}" does not have a linked chargeable. Please set one up in Settings before creating a membership invoice.`
          )
        }

        let chargeable = payload.chargeable

        if (!chargeable) {
          const { data: chargeableData, error: chargeableError } = await supabase
            .from("chargeables")
            .select("id, name, rate, is_taxable")
            .eq("id", payload.membershipType.chargeable_id)
            .single()

          if (chargeableError || !chargeableData) {
            throw new Error("Failed to load chargeable for this membership type.")
          }

          chargeable = toInvoiceReadyChargeable(chargeableData)
          if (!chargeable) {
            throw new Error(
              `Chargeable "${chargeableData.name}" is missing a rate or tax setting. Please complete it in Settings before creating a membership invoice.`
            )
          }
        }

        const invoiceReference =
          payload.mode === "renew" ? "MEMBERSHIP-RENEWAL" : "MEMBERSHIP"

        const itemDescription = `${payload.membershipType.name} - ${
          payload.mode === "renew" ? "Renewal" : "New Membership"
        }`

        const { data: invoiceResult, error: invoiceError } = await supabase.rpc(
          "create_invoice_atomic",
          {
            p_user_id: payload.userId,
            p_booking_id: undefined,
            p_status: "draft",
            p_invoice_number: undefined,
            p_issue_date: undefined,
            p_due_date: undefined,
            p_reference: invoiceReference,
            p_notes: payload.notes ?? undefined,
            p_tax_rate: undefined,
            p_items: [
              {
                chargeable_id: chargeable.id,
                description: itemDescription,
                quantity: 1,
                unit_price: chargeable.rate,
                tax_rate: chargeable.is_taxable ? 0.15 : 0,
              },
            ],
          }
        )

        if (invoiceError) {
          throw new Error(invoiceError.message)
        }

        const typedInvoiceResult = invoiceResult as CreateInvoiceResult | null
        if (!typedInvoiceResult?.success) {
          throw new Error(
            typedInvoiceResult?.error ?? typedInvoiceResult?.message ?? "Invoice creation failed."
          )
        }

        invoiceId = typedInvoiceResult.invoice_id ?? null
      }

      const { data: membership, error: membershipError } = await supabase
        .from("memberships")
        .insert({
          user_id: payload.userId,
          membership_type_id: payload.membershipTypeId,
          start_date: payload.startDate.toISOString(),
          expiry_date: format(payload.expiryDate, "yyyy-MM-dd"),
          purchased_date: new Date().toISOString(),
          is_active: true,
          auto_renew: payload.autoRenew ?? false,
          grace_period_days: payload.gracePeriodDays ?? 30,
          notes: payload.notes ?? null,
          invoice_id: invoiceId,
        })
        .select("id")
        .single()

      if (membershipError || !membership) {
        throw new Error(
          `Membership record failed to save: ${membershipError?.message ?? "Unknown error"}${
            invoiceId
              ? ` (Invoice ${invoiceId} was created but not linked — please check.)`
              : ""
          }`
        )
      }

      const result = { membershipId: membership.id, invoiceId: invoiceId ?? undefined }
      options?.onSuccess?.(result)
      return result
    } catch (err) {
      const parsedError = err instanceof Error ? err : new Error(String(err))
      setError(parsedError)
      options?.onError?.(parsedError)
      throw parsedError
    } finally {
      setLoading(false)
    }
  }

  return { submit, loading, error }
}
