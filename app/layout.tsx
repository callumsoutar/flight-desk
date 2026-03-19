import type { Metadata } from "next";
import "./globals.css";

import { Toaster } from "@/components/ui/sonner"
import { ReactQueryProvider } from "@/components/providers/react-query-provider"
import { AuthProvider } from "@/contexts/auth-context"
import { fetchUserProfile } from "@/lib/auth/user-profile"
import { TimezoneProvider } from "@/contexts/timezone-context"
import { getAuthSession } from "@/lib/auth/session"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { SpeedInsights } from "@vercel/speed-insights/next"

export const metadata: Metadata = {
  title: "Flight Desk",
  description: "Flight Desk is a platform for managing flights and bookings",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createSupabaseServerClient()
  const { user, role, tenantId } = await getAuthSession(supabase, {
    includeRole: true,
    includeTenant: true,
  })
  const profile = user ? await fetchUserProfile(supabase, user) : null

  let tenantTimezone = "Pacific/Auckland"
  if (tenantId) {
    const { data: tenant } = await supabase
      .from("tenants")
      .select("timezone")
      .eq("id", tenantId)
      .maybeSingle()
    if (tenant?.timezone) tenantTimezone = tenant.timezone
  }

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className="antialiased"
      >
        <AuthProvider
          initialUser={user}
          initialRole={role}
          initialProfile={profile}
        >
          <TimezoneProvider timeZone={tenantTimezone}>
            <ReactQueryProvider>
              {children}
              <Toaster />
            </ReactQueryProvider>
          </TimezoneProvider>
        </AuthProvider>
        <SpeedInsights />
      </body>
    </html>
  );
}
