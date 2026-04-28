import { AppRouteShell } from "@/components/layouts/app-route-shell"

export default function AppShellLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return <AppRouteShell>{children}</AppRouteShell>
}
