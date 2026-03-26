"use client"

/**
 * @deprecated Use `<XeroAccountSelect />` from `@/components/settings/xero-account-select` instead.
 * This component fetches accounts from the local cache only.
 * The new component fetches live from Xero with automatic cache write-through.
 */

import * as React from "react"

import { useXeroActiveAccountsQuery } from "@/hooks/use-xero-accounts-query"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export function GlCodeSelect({
  value,
  onValueChange,
  disabled = false,
}: {
  value: string
  onValueChange: (value: string) => void
  disabled?: boolean
}) {
  const { data: accounts = [] } = useXeroActiveAccountsQuery()

  return (
    <Select value={value || "__none__"} onValueChange={(next) => onValueChange(next === "__none__" ? "" : next)} disabled={disabled}>
      <SelectTrigger>
        <SelectValue placeholder="Select GL code" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__none__">None</SelectItem>
        {accounts.map((account) => (
          <SelectItem key={account.id} value={account.code ?? account.name}>
            {account.code ? `${account.code} - ${account.name}` : account.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
