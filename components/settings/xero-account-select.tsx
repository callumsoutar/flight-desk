"use client"

import * as React from "react"
import { Command } from "cmdk"
import { Check, ChevronsUpDown, Loader2, Search } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  cacheSelectedXeroAccount,
  useXeroChartOfAccountsQuery,
  type XeroAccountOption,
} from "@/hooks/use-xero-accounts-query"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

function formatAccountLabel(account: XeroAccountOption) {
  return account.code ? `${account.code} — ${account.name}` : account.name
}

export function XeroAccountSelect({
  value,
  onChange,
  accountTypes,
  disabled = false,
  placeholder = "Select account…",
  className,
}: {
  value: string
  onChange: (code: string) => void
  accountTypes?: string[]
  disabled?: boolean
  placeholder?: string
  className?: string
}) {
  const [open, setOpen] = React.useState(false)

  const {
    data: accounts = [],
    isLoading,
    error,
  } = useXeroChartOfAccountsQuery(accountTypes, open)

  const selectedAccount = accounts.find((account) => account.code === value)
  const displayValue = selectedAccount
    ? formatAccountLabel(selectedAccount)
    : value || null

  const handleSelect = React.useCallback(
    (account: XeroAccountOption) => {
      onChange(account.code ?? "")
      setOpen(false)
      cacheSelectedXeroAccount(account).catch(() => {
        // best-effort cache — dropdown still works if this fails
      })
    },
    [onChange]
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "h-11 w-full justify-between rounded-xl border-slate-200 bg-white font-normal hover:bg-slate-50",
            !displayValue && "text-muted-foreground",
            className
          )}
        >
          <span className="truncate">
            {displayValue || placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
      >
        <Command className="overflow-hidden rounded-xl">
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <Command.Input
              placeholder="Search accounts…"
              className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          <Command.List className="max-h-[300px] overflow-y-auto p-1">
            {isLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">
                  Loading accounts…
                </span>
              </div>
            ) : error ? (
              <div className="py-6 text-center text-sm text-destructive">
                Failed to load accounts
              </div>
            ) : (
              <>
                <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
                  No accounts found.
                </Command.Empty>
                <Command.Item
                  value="__none__"
                  onSelect={() => {
                    onChange("")
                    setOpen(false)
                  }}
                  className="relative flex cursor-pointer select-none items-center rounded-lg px-3 py-2 text-sm outline-none data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground"
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      !value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="text-muted-foreground">None</span>
                </Command.Item>
                {accounts.map((account) => (
                  <Command.Item
                    key={account.xero_account_id}
                    value={`${account.code ?? ""} ${account.name}`}
                    onSelect={() => handleSelect(account)}
                    className="relative flex cursor-pointer select-none items-center rounded-lg px-3 py-2 text-sm outline-none data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground"
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === account.code ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span>{formatAccountLabel(account)}</span>
                  </Command.Item>
                ))}
              </>
            )}
          </Command.List>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
