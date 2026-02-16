"use client"

import * as React from "react"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { useAuth } from "@/contexts/auth-context"

export function SiteHeader() {
  const { user, profile } = useAuth()
  const metadata = (user?.user_metadata ?? {}) as Record<string, unknown>
  const fullName =
    (typeof profile === "object" && profile
      ? (profile["name"] as string | undefined)
      : undefined) ??
    (metadata["full_name"] as string | undefined) ??
    (metadata["name"] as string | undefined) ??
    user?.email ??
    "User"
  const firstName = fullName.trim().split(/\s+/)[0] || "User"
  const avatar =
    (metadata["avatar_url"] as string | undefined) ?? "/avatars/shadcn.jpg"
  const initials = React.useMemo(() => {
    const parts = fullName.trim().split(/\s+/).slice(0, 2)
    const letters = parts.map((part) => part.slice(0, 1).toUpperCase()).join("")
    return letters || "U"
  }, [fullName])

  return (
    <>
      <header className="bg-sidebar text-sidebar-foreground border-sidebar-border flex h-12 shrink-0 items-center border-b px-2 md:hidden">
        <SidebarTrigger className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" />
        <div className="flex flex-1 justify-center">
          <span className="text-base font-semibold">FlightDesk</span>
        </div>
        <Avatar className="h-8 w-8 rounded-md">
          <AvatarImage src={avatar} alt={fullName} />
          <AvatarFallback className="rounded-md">{initials}</AvatarFallback>
        </Avatar>
      </header>

      <header className="hidden h-12 shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-4 shadow-sm transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 md:flex lg:px-6 dark:border-slate-800 dark:bg-slate-900">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
        <div className="ml-auto flex items-center gap-3">
          <p className="text-sm text-muted-foreground">{`Hello, ${firstName}`}</p>
          <Avatar className="h-8 w-8 rounded-md">
            <AvatarImage src={avatar} alt={fullName} />
            <AvatarFallback className="rounded-md">{initials}</AvatarFallback>
          </Avatar>
        </div>
      </header>
    </>
  )
}
