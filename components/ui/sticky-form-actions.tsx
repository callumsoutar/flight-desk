"use client"

import * as React from "react"
import { IconDeviceFloppy, IconRotateClockwise } from "@tabler/icons-react"

import { useIsMobile } from "@/hooks/use-mobile"
import { Button } from "@/components/ui/button"

interface StickyFormActionsProps {
  formId?: string
  isDirty: boolean
  isSaving?: boolean
  isSaveDisabled?: boolean
  onUndo: () => void
  onSave?: () => void
  message: string
  undoLabel?: string
  saveLabel?: string
}

export function StickyFormActions({
  formId,
  isDirty,
  isSaving,
  isSaveDisabled,
  onUndo,
  onSave,
  message,
  undoLabel = "Undo changes",
  saveLabel = "Save",
}: StickyFormActionsProps) {
  const isMobile = useIsMobile()
  const [sidebarLeft, setSidebarLeft] = React.useState(0)

  React.useEffect(() => {
    if (isMobile) {
      setSidebarLeft(0)
      return
    }

    const updateSidebarPosition = () => {
      if (isMobile) {
        setSidebarLeft(0)
        return
      }

      const sidebarGap = document.querySelector('[data-slot="sidebar-gap"]')
      if (sidebarGap) {
        const computedWidth = window.getComputedStyle(sidebarGap).width
        const width = parseFloat(computedWidth) || 0
        if (width > 0) {
          setSidebarLeft(width)
          return
        }
      }

      const sidebar = document.querySelector('[data-slot="sidebar"]')
      if (sidebar) {
        const state = sidebar.getAttribute("data-state")
        const collapsible = sidebar.getAttribute("data-collapsible")
        const variant = sidebar.getAttribute("data-variant")

        if (state === "collapsed") {
          if (collapsible === "icon") {
            setSidebarLeft(variant === "inset" ? 64 : 48)
          } else {
            setSidebarLeft(0)
          }
          return
        }

        const sidebarContainer = sidebar.querySelector('[data-slot="sidebar-container"]')
        if (sidebarContainer) {
          const computedWidth = window.getComputedStyle(sidebarContainer).width
          const width = parseFloat(computedWidth) || 256
          setSidebarLeft(width)
          return
        }
      }

      const sidebarWrapper = document.querySelector('[data-slot="sidebar-wrapper"]')
      const sidebarWidthVar = sidebarWrapper
        ? window.getComputedStyle(sidebarWrapper).getPropertyValue("--sidebar-width")
        : window.getComputedStyle(document.documentElement).getPropertyValue("--sidebar-width")

      if (sidebarWidthVar) {
        const match = sidebarWidthVar.match(/calc\(var\(--spacing\)\s*\*\s*(\d+)\)/)
        if (match) {
          const multiplier = parseInt(match[1], 10)
          setSidebarLeft(multiplier * 4)
        } else if (sidebarWidthVar.includes("rem")) {
          setSidebarLeft(parseFloat(sidebarWidthVar) * 16)
        } else if (sidebarWidthVar.includes("px")) {
          setSidebarLeft(parseFloat(sidebarWidthVar))
        } else {
          setSidebarLeft(256)
        }
      } else {
        setSidebarLeft(256)
      }
    }

    updateSidebarPosition()
    const timer = setTimeout(updateSidebarPosition, 100)

    window.addEventListener("resize", updateSidebarPosition)
    window.addEventListener("transitionend", updateSidebarPosition)

    const observer = new MutationObserver(updateSidebarPosition)
    const sidebarWrapper = document.querySelector('[data-slot="sidebar-wrapper"]')
    if (sidebarWrapper) {
      observer.observe(sidebarWrapper, {
        attributes: true,
        attributeFilter: ["data-state", "data-collapsible"],
        subtree: true,
      })
    }

    return () => {
      clearTimeout(timer)
      window.removeEventListener("resize", updateSidebarPosition)
      window.removeEventListener("transitionend", updateSidebarPosition)
      observer.disconnect()
    }
  }, [isMobile])

  if (!isDirty) return null

  const finalSaveLabel = isSaving ? "Saving..." : saveLabel

  return (
    <div
      className="fixed right-0 bottom-0 z-50 border-t border-gray-200 bg-white shadow-xl dark:border-gray-800 dark:bg-gray-900"
      style={{
        left: isMobile ? 0 : `${sidebarLeft}px`,
      }}
    >
      <div
        className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">{message}</p>
          <div className="flex items-center justify-end gap-4">
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={onUndo}
              disabled={isSaving}
              className={`h-12 border-gray-300 font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800 ${
                isMobile ? "max-w-[200px] flex-1" : "min-w-[160px] px-8"
              }`}
            >
              <IconRotateClockwise className="mr-2 h-4 w-4" />
              {undoLabel}
            </Button>
            <Button
              type={formId ? "submit" : "button"}
              form={formId}
              onClick={onSave}
              size="lg"
              disabled={isSaving || isSaveDisabled}
              className={`h-12 bg-slate-700 font-semibold text-white shadow-lg transition-all hover:bg-slate-800 hover:shadow-xl ${
                isMobile ? "max-w-[200px] flex-1" : "min-w-[160px] px-8"
              }`}
            >
              <IconDeviceFloppy className="mr-2 h-4 w-4" />
              {finalSaveLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
