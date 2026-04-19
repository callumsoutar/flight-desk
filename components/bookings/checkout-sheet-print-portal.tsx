"use client"

import * as React from "react"
import { createPortal } from "react-dom"

/** Renders children at document.body for reliable print isolation (single #checkout-sheet-print-root). */
export function CheckoutSheetPrintPortal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted || typeof document === "undefined") return null

  return createPortal(children, document.body)
}
