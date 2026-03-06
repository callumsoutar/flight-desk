import type { Metadata } from "next";
import "./globals.css";

import { Toaster } from "@/components/ui/sonner"
import { ReactQueryProvider } from "@/components/providers/react-query-provider"
import { AuthProvider } from "@/contexts/auth-context"
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
  const { user, role } = await getAuthSession(supabase, { includeRole: true })

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className="antialiased"
      >
        <AuthProvider
          initialUser={user}
          initialRole={role}
          initialProfile={null}
        >
          <ReactQueryProvider>
            {children}
            <Toaster />
          </ReactQueryProvider>
        </AuthProvider>
        <SpeedInsights />
      </body>
    </html>
  );
}
