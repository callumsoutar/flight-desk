"use client"

import * as React from "react"
import { IconPhoto, IconUpload, IconX } from "@tabler/icons-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type DropzoneProps = {
  onFileSelect: (file: File | null) => void | Promise<void>
  onError?: (message: string) => void
  accept?: string
  maxSize?: number
  currentFile?: string | null
  disabled?: boolean
  label?: string
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B"
  const units = ["B", "KB", "MB", "GB"]
  const exp = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / 1024 ** exp
  return `${value.toFixed(value >= 10 || exp === 0 ? 0 : 1)} ${units[exp]}`
}

export function Dropzone({
  onFileSelect,
  onError,
  accept = "image/*",
  maxSize = 5 * 1024 * 1024,
  currentFile,
  disabled = false,
  label = "Drop files here or click to upload",
}: DropzoneProps) {
  const inputRef = React.useRef<HTMLInputElement | null>(null)
  const [isDragging, setIsDragging] = React.useState(false)
  const [previewFailed, setPreviewFailed] = React.useState(false)

  const openPicker = () => {
    if (disabled) return
    inputRef.current?.click()
  }

  const validateAndSelect = async (file: File | null) => {
    if (disabled) return
    if (!file) return

    if (accept === "image/*" && !file.type.startsWith("image/")) {
      onError?.("Only image uploads are supported")
      return
    }

    if (maxSize && file.size > maxSize) {
      onError?.(`File is too large (max ${formatBytes(maxSize)})`)
      return
    }

    await onFileSelect(file)
  }

  React.useEffect(() => {
    setPreviewFailed(false)
  }, [currentFile])

  const hasFile = Boolean(currentFile)

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="sr-only"
        disabled={disabled}
        onChange={async (event) => {
          const file = event.currentTarget.files?.[0] ?? null
          event.currentTarget.value = ""
          await validateAndSelect(file)
        }}
      />

      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        onClick={openPicker}
        onKeyDown={(event) => {
          if (disabled) return
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault()
            openPicker()
          }
        }}
        onDragEnter={(event) => {
          event.preventDefault()
          event.stopPropagation()
          if (disabled) return
          setIsDragging(true)
        }}
        onDragOver={(event) => {
          event.preventDefault()
          event.stopPropagation()
          if (disabled) return
          setIsDragging(true)
        }}
        onDragLeave={(event) => {
          event.preventDefault()
          event.stopPropagation()
          setIsDragging(false)
        }}
        onDrop={async (event) => {
          event.preventDefault()
          event.stopPropagation()
          setIsDragging(false)
          if (disabled) return
          const file = event.dataTransfer.files?.[0] ?? null
          await validateAndSelect(file)
        }}
        aria-disabled={disabled}
        className={cn(
          "group relative rounded-2xl border bg-white p-5 transition-colors",
          disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-slate-50/50",
          isDragging ? "border-indigo-400 bg-indigo-50/40" : "border-slate-200",
          hasFile ? "border-solid" : "border-dashed"
        )}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 sm:h-28 sm:w-28">
              {hasFile && !previewFailed ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={currentFile as string}
                  alt="Logo preview"
                  className="h-full w-full object-contain bg-white"
                  onError={() => setPreviewFailed(true)}
                />
              ) : (
                <IconPhoto className="h-7 w-7 text-slate-500" />
              )}
            </div>
            <div className="space-y-1">
              <p className="text-base font-semibold text-slate-900">
                {hasFile ? "Company logo" : label}
              </p>
              <p className="text-sm text-muted-foreground">
                {hasFile
                  ? "Shown on invoices and selected customer touchpoints."
                  : `${accept === "image/*" ? "PNG, JPG, GIF, WEBP" : accept} • up to ${formatBytes(maxSize)}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" className="h-10" disabled={disabled}>
              <IconUpload className="mr-2 h-4 w-4" />
              {currentFile ? "Change" : "Upload"}
            </Button>
            {currentFile ? (
              <Button
                type="button"
                variant="outline"
                className="h-10"
                disabled={disabled}
                onClick={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  void onFileSelect(null)
                }}
              >
                <IconX className="mr-2 h-4 w-4" />
                Remove
              </Button>
            ) : null}
          </div>
        </div>

        {!hasFile ? (
          <div className="mt-4 rounded-xl border border-slate-200/70 bg-slate-50 px-3 py-2 text-[11px] font-medium text-slate-600">
            Tip: use a square logo with a transparent background for best results.
          </div>
        ) : null}
      </div>
    </div>
  )
}
