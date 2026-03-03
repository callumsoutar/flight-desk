"use client"

import * as React from "react"
import { IconBold, IconItalic, IconList, IconListNumbers } from "@tabler/icons-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

function extractPlainText(html: string) {
  try {
    const doc = new DOMParser().parseFromString(html, "text/html")
    return doc.body.textContent ?? ""
  } catch {
    return html
  }
}

function isEditorEmpty(html: string) {
  return extractPlainText(html).trim().length === 0
}

type Command = "bold" | "italic" | "insertUnorderedList" | "insertOrderedList"

const COMMANDS: Array<{
  id: string
  label: string
  icon: React.ReactNode
  command: Command
}> = [
  { id: "bold", label: "Bold", icon: <IconBold className="h-4 w-4" />, command: "bold" },
  { id: "italic", label: "Italic", icon: <IconItalic className="h-4 w-4" />, command: "italic" },
  { id: "bullets", label: "Bullets", icon: <IconList className="h-4 w-4" />, command: "insertUnorderedList" },
  { id: "numbers", label: "Numbered list", icon: <IconListNumbers className="h-4 w-4" />, command: "insertOrderedList" },
]

export function RichTextEditor({
  value,
  onChange,
  placeholder,
  className,
  editorClassName,
  disabled,
}: {
  value: string
  onChange: (nextHtml: string) => void
  placeholder?: string
  className?: string
  editorClassName?: string
  disabled?: boolean
}) {
  const editorRef = React.useRef<HTMLDivElement | null>(null)
  const lastAppliedValue = React.useRef<string | null>(null)

  React.useEffect(() => {
    const el = editorRef.current
    if (!el) return
    if (lastAppliedValue.current === value) return
    if (el.innerHTML !== value) el.innerHTML = value
    lastAppliedValue.current = value
  }, [value])

  const run = React.useCallback((command: Command) => {
    if (disabled) return
    const el = editorRef.current
    if (!el) return
    el.focus()
    document.execCommand(command)
    onChange(el.innerHTML)
  }, [disabled, onChange])

  const empty = !value.trim() || isEditorEmpty(value)

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap items-center gap-1 rounded-lg border border-border/60 bg-muted/20 p-1">
        {COMMANDS.map((item) => (
          <Button
            key={item.id}
            type="button"
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground hover:text-foreground"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => run(item.command)}
            disabled={disabled}
            aria-label={item.label}
            title={item.label}
          >
            {item.icon}
          </Button>
        ))}

        <div className="ml-auto pr-2 text-[10px] font-medium text-muted-foreground">
          Ctrl/Cmd + B · I
        </div>
      </div>

      <div className="relative">
        {placeholder && empty ? (
          <div className="pointer-events-none absolute left-3 top-3 select-none text-sm text-muted-foreground/60">
            {placeholder}
          </div>
        ) : null}

        <div
          ref={editorRef}
          contentEditable={!disabled}
          suppressContentEditableWarning
          onInput={(e) => {
            const html = (e.currentTarget as HTMLDivElement).innerHTML
            lastAppliedValue.current = html
            onChange(html)
          }}
          className={cn(
            "min-h-[140px] w-full resize-y rounded-lg border border-border/80 bg-muted/30 px-3 py-2 text-sm leading-relaxed",
            "outline-none focus:bg-background focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
            "whitespace-pre-wrap",
            "[&_p:not(:first-child)]:mt-3 [&_div:not(:first-child)]:mt-3",
            "[&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5",
            "[&_ol]:mt-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1.5",
            "[&_li]:leading-relaxed",
            "[&_b]:font-semibold [&_strong]:font-semibold",
            "[&_i]:italic [&_em]:italic",
            disabled && "pointer-events-none opacity-60",
            editorClassName
          )}
        />
      </div>
    </div>
  )
}

