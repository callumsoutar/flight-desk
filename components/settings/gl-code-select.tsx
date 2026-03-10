"use client"

import * as React from "react"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type XeroAccount = {
  id: string
  code: string | null
  name: string
  status: string | null
}

export function GlCodeSelect({
  value,
  onValueChange,
  disabled = false,
}: {
  value: string
  onValueChange: (value: string) => void
  disabled?: boolean
}) {
  const [accounts, setAccounts] = React.useState<XeroAccount[]>([])

  React.useEffect(() => {
    void (async () => {
      const response = await fetch("/api/xero/accounts", { cache: "no-store" })
      if (!response.ok) return
      const body = (await response.json().catch(() => null)) as { accounts?: XeroAccount[] } | null
      setAccounts((body?.accounts ?? []).filter((account) => account.status === "ACTIVE"))
    })()
  }, [])

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
