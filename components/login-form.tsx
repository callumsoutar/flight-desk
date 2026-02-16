"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { signInWithEmail } from "@/app/actions/auth"
import { createSupabaseBrowserClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const AUTH_BROADCAST_CHANNEL = "aerosafety-auth"

export function LoginForm({ nextUrl }: { nextUrl?: string }) {
  const router = useRouter()

  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [pending, startTransition] = React.useTransition()

  const broadcastAuthChanged = React.useCallback(() => {
    try {
      if ("BroadcastChannel" in window) {
        const bc = new BroadcastChannel(AUTH_BROADCAST_CHANNEL)
        bc.postMessage("auth-changed")
        bc.close()
      }
    } catch {
      // ignore
    }
  }, [])

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()

    startTransition(async () => {
      const result = await signInWithEmail(email, password)
      if (result.error) {
        toast.error(result.error)
        return
      }

      broadcastAuthChanged()
      router.refresh()
      window.location.assign(nextUrl || "/")
    })
  }

  async function onGoogle() {
    const supabase = createSupabaseBrowserClient()

    const callbackUrl = new URL("/auth/callback", window.location.origin)
    if (nextUrl) callbackUrl.searchParams.set("next", nextUrl)

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: callbackUrl.toString(),
      },
    })

    if (error) toast.error(error.message)
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-xl">Sign in</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4" onSubmit={onSubmit}>
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={pending}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={pending}
            />
          </div>
          <Button type="submit" className="w-full" disabled={pending}>
            Sign in
          </Button>
        </form>
        <div className="mt-4">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={onGoogle}
            disabled={pending}
          >
            Continue with Google
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
