"use client"

import * as React from "react"
import Link from "next/link"

import { signOut } from "@/app/actions/auth"
import { Button } from "@/components/ui/button"

export function PortalAccessSuspendedClient() {
  const [signingOut, setSigningOut] = React.useState(true)

  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        await signOut()
      } finally {
        if (!cancelled) setSigningOut(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="mx-auto max-w-md space-y-4 px-4 py-16 text-center">
      <h1 className="text-lg font-semibold text-slate-900">Portal access disabled</h1>
      <p className="text-sm text-slate-600">
        Your account does not have access to the member portal. If you think this is a mistake, contact
        your school or club.
      </p>
      {signingOut ? (
        <p className="text-sm text-slate-500">Signing you out…</p>
      ) : (
        <Button asChild variant="default">
          <Link href="/login">Sign in</Link>
        </Button>
      )}
    </div>
  )
}
