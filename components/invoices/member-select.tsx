"use client"

import * as React from "react"

export type UserResult = {
  id: string
  first_name: string | null
  last_name: string | null
  email: string
}

export default function MemberSelect({
  value,
  onSelect,
  disabled,
}: {
  value: UserResult | null
  onSelect: (user: UserResult | null) => void
  disabled?: boolean
}) {
  void onSelect

  return (
    <button
      type="button"
      disabled={disabled}
      className="h-10 w-full rounded-md border border-input bg-background px-3 text-left text-sm text-muted-foreground"
    >
      {value
        ? [value.first_name, value.last_name].filter(Boolean).join(" ") || value.email
        : "Member selection unavailable"}
    </button>
  )
}
