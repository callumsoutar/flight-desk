"use client"

import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

export type UserResult = {
  id: string
  first_name: string | null
  last_name: string | null
  email: string
}

export default function MemberSelect({
  members,
  value,
  onSelect,
  disabled,
}: {
  members: UserResult[]
  value: UserResult | null
  onSelect: (user: UserResult | null) => void
  disabled?: boolean
}) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")

  const displayName = value
    ? [value.first_name, value.last_name].filter(Boolean).join(" ") || value.email
    : "Select member"

  const filteredMembers = React.useMemo(() => {
    const normalized = search.trim().toLowerCase()
    if (!normalized) return members

    return members.filter((member) => {
      const fullName = `${member.first_name ?? ""} ${member.last_name ?? ""}`.trim().toLowerCase()
      return fullName.includes(normalized) || member.email.toLowerCase().includes(normalized)
    })
  }, [members, search])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="h-10 w-full justify-between"
        >
          <span className="truncate text-left">{displayName}</span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-2">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search members..."
          className="mb-2 h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none ring-0 placeholder:text-muted-foreground focus:border-ring"
        />
        <div className="max-h-64 overflow-y-auto rounded-md border border-border/60">
          <button
            type="button"
            className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted/60"
            onClick={() => {
              onSelect(null)
              setOpen(false)
              setSearch("")
            }}
          >
            <span className="truncate text-muted-foreground">No member selected</span>
            {!value ? <Check className="h-4 w-4" /> : null}
          </button>
          {filteredMembers.length === 0 ? (
            <div className="px-3 py-3 text-sm text-muted-foreground">No members found.</div>
          ) : (
            filteredMembers.map((member) => {
              const memberName =
                [member.first_name, member.last_name].filter(Boolean).join(" ") || member.email
              const isSelected = value?.id === member.id

              return (
                <button
                  type="button"
                  key={member.id}
                  className={cn(
                    "flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted/60",
                    isSelected && "bg-muted/40"
                  )}
                  onClick={() => {
                    onSelect(member)
                    setOpen(false)
                    setSearch("")
                  }}
                >
                  <span className="truncate">{memberName}</span>
                  {isSelected ? <Check className="h-4 w-4" /> : null}
                </button>
              )
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
