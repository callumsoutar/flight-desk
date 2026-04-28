import type { Metadata } from "next";
import "./globals.css";

import { Toaster } from "@/components/ui/sonner"
import { ReactQueryProvider } from "@/components/providers/react-query-provider"
import { AuthProvider } from "@/contexts/auth-context"
import { TimezoneProvider } from "@/contexts/timezone-context"
import { loadRootLayoutAuthSession } from "@/lib/auth/session"
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
  const { user, role, tenantId } = await loadRootLayoutAuthSession()

  const tenantTimezone = tenantId
    ? await supabase
        .from("tenants")
        .select("timezone")
        .eq("id", tenantId)
        .maybeSingle()
        .then(({ data }) => data?.timezone ?? "Pacific/Auckland")
    : "Pacific/Auckland"

  return (
    <html lang="en" suppressHydrationWarning data-scroll-behavior="smooth">
      <body
        suppressHydrationWarning
        className="antialiased"
      >
        <ReactQueryProvider>
          <AuthProvider initialUser={user} initialRole={role} initialProfile={null}>
            <TimezoneProvider timeZone={tenantTimezone}>
              {children}
              <Toaster />
            </TimezoneProvider>
          </AuthProvider>
        </ReactQueryProvider>
        <SpeedInsights />
      </body>
    </html>
  );
}
