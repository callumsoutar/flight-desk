"use client"

import * as React from "react"
import Link from "next/link"
import {
  IconCalendarEvent,
  IconDashboard,
  IconFileInvoice,
  IconPlane,
  IconPlaneDeparture,
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
import { getUserDisplayName } from "@/lib/auth/display-name"
import { isAdminRole, isStaffRole } from "@/lib/auth/roles"

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
        { title: "Financial Reports", url: "/reports/financial", icon: IconReport },
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
  const { user, role, profile } = useAuth()
  const metadata = (user?.user_metadata ?? {}) as Record<string, unknown>
  const name = getUserDisplayName(user, profile)

  const email = user?.email ?? ""
  const avatar =
    (metadata["avatar_url"] as string | undefined) ?? "/avatars/shadcn.jpg"

  const canAccessTraining = role === "owner" || role === "admin" || role === "instructor"
  const canAccessFinancialReports = role === "owner" || role === "admin"
  const isPrivilegedNav = isStaffRole(role)
  const canOpenSettings = isAdminRole(role)
  const navMainSections = React.useMemo(() => {
    if (!isPrivilegedNav) {
      return [
        {
          items: [
            { title: "Dashboard", url: "/dashboard", icon: IconDashboard },
            { title: "Scheduler", url: "/scheduler", icon: IconCalendarEvent },
            { title: "Bookings", url: "/bookings", icon: IconReceipt },
          ],
        },
      ]
    }
    return data.navMainSections.map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        if (!canAccessTraining && item.url === "/training") return false
        if (!canAccessFinancialReports && item.url === "/reports/financial") return false
        return true
      }),
    }))
  }, [canAccessFinancialReports, canAccessTraining, isPrivilegedNav])

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
                <IconPlaneDeparture className="!size-5" aria-hidden />
                <span className="text-base font-semibold">FlightDesk</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain sections={navMainSections} />
        <NavSecondary
          items={canOpenSettings ? data.navSecondary : []}
          className="mt-auto"
        />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={{ id: user?.id ?? "guest", name, email, avatar }} />
      </SidebarFooter>
    </Sidebar>
  )
}
