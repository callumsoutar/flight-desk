"use client"

import * as React from "react"
import Link from "next/link"
import {
  IconCalendarEvent,
  IconDashboard,
  IconFileInvoice,
  IconPlane,
  IconInnerShadowTop,
  IconReceipt,
  IconReport,
  IconRosetteDiscountCheck,
  IconSchool,
  IconSettings2,
  IconTool,
  IconUsers,
  IconUser,
} from "@tabler/icons-react"

import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { useAuth } from "@/contexts/auth-context"

const data = {
  navMainSections: [
    {
      items: [
        { title: "Dashboard", url: "/dashboard", icon: IconDashboard },
        { title: "Scheduler", url: "/scheduler", icon: IconCalendarEvent },
        { title: "Bookings", url: "/bookings", icon: IconReceipt },
      ],
    },
    {
      label: "Resources",
      items: [
        { title: "Aircraft", url: "/aircraft", icon: IconPlane },
        { title: "Members", url: "/members", icon: IconUser },
        { title: "Instructors", url: "/instructors", icon: IconUsers },
        { title: "Staff", url: "/staff", icon: IconUsers },
      ],
    },
    {
      label: "Operations",
      items: [
        { title: "Invoicing", url: "/invoices", icon: IconFileInvoice },
        { title: "Training", url: "/training", icon: IconSchool },
        { title: "Equipment", url: "/equipment", icon: IconTool },
        { title: "Rosters", url: "/rosters", icon: IconRosetteDiscountCheck },
      ],
    },
    {
      label: "Management",
      items: [
        { title: "Reports", url: "/reports", icon: IconReport },
      ],
    },
  ],
  navSecondary: [
    {
      title: "Settings",
      url: "/settings",
      icon: IconSettings2,
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { user, profile } = useAuth()
  const metadata = (user?.user_metadata ?? {}) as Record<string, unknown>
  const name =
    (typeof profile === "object" && profile
      ? (profile["name"] as string | undefined)
      : undefined) ??
    (metadata["full_name"] as string | undefined) ??
    (metadata["name"] as string | undefined) ??
    user?.email ??
    "User"

  const email = user?.email ?? ""
  const avatar =
    (metadata["avatar_url"] as string | undefined) ?? "/avatars/shadcn.jpg"

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <Link href="/dashboard">
                <IconInnerShadowTop className="!size-5" />
                <span className="text-base font-semibold">FlightDesk</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain sections={data.navMainSections} />
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={{ name, email, avatar }} />
      </SidebarFooter>
    </Sidebar>
  )
}
