"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { type Icon } from "@tabler/icons-react"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

export function NavMain({
  sections,
}: {
  sections: {
    label?: string
    items: {
      title: string
      url: string
      icon?: Icon
    }[]
  }[]
}) {
  const pathname = usePathname()
  const activeItemUrl = (() => {
    const matches: string[] = []
    for (const section of sections) {
      for (const item of section.items) {
        if (pathname === item.url || pathname.startsWith(`${item.url}/`)) {
          matches.push(item.url)
        }
      }
    }
    if (matches.length === 0) return null
    return matches.sort((a, b) => b.length - a.length)[0] ?? null
  })()

  return (
    <>
      {sections.map((section) => (
        <SidebarGroup key={section.label ?? section.items.map((item) => item.title).join("-")}>
          {section.label ? <SidebarGroupLabel>{section.label}</SidebarGroupLabel> : null}
          <SidebarGroupContent>
            <SidebarMenu>
              {section.items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    tooltip={item.title}
                    isActive={activeItemUrl === item.url}
                  >
                    <Link href={item.url}>
                      {item.icon ? <item.icon /> : null}
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
    </>
  )
}
