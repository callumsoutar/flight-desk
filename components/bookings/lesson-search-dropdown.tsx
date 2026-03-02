"use client"

import * as React from "react"
import { Check, ChevronDown, ChevronRight, ChevronsUpDown } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

type LessonLite = {
  id: string
  name: string
  syllabus_id: string | null
}

type SyllabusLite = {
  id: string
  name: string
}

export function LessonSearchDropdown({
  lessons,
  syllabi,
  value,
  onSelect,
  disabled,
  placeholder = "Select lesson...",
  triggerClassName,
}: {
  lessons: LessonLite[]
  syllabi: SyllabusLite[]
  value: string | null
  onSelect: (lessonId: string | null) => void
  disabled?: boolean
  placeholder?: string
  triggerClassName?: string
}) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")
  const [expanded, setExpanded] = React.useState<Set<string>>(() => new Set())

  const selectedLesson = React.useMemo(() => {
    if (!value) return null
    return lessons.find((lesson) => lesson.id === value) ?? null
  }, [lessons, value])

  const groups = React.useMemo(() => {
    const syllabusNameById = new Map(syllabi.map((syllabus) => [syllabus.id, syllabus.name] as const))
    const bySyllabus = new Map<
      string,
      {
        key: string
        name: string
        lessons: LessonLite[]
      }
    >()

    for (const lesson of lessons) {
      const key = lesson.syllabus_id ?? "__unassigned__"
      const name = lesson.syllabus_id ? (syllabusNameById.get(lesson.syllabus_id) ?? "Unknown syllabus") : "Unassigned"
      const existing = bySyllabus.get(key) ?? { key, name, lessons: [] }
      existing.lessons.push(lesson)
      bySyllabus.set(key, existing)
    }

    const result = Array.from(bySyllabus.values())
    result.sort((a, b) => {
      if (a.key === "__unassigned__" && b.key !== "__unassigned__") return 1
      if (b.key === "__unassigned__" && a.key !== "__unassigned__") return -1
      return a.name.localeCompare(b.name)
    })
    return result
  }, [lessons, syllabi])

  const useGrouping = groups.length > 1

  const filteredLessons = React.useMemo(() => {
    if (useGrouping) return []
    const normalized = search.trim().toLowerCase()
    if (!normalized) return lessons
    return lessons.filter((lesson) => lesson.name.toLowerCase().includes(normalized))
  }, [lessons, search, useGrouping])

  const filteredGroups = React.useMemo(() => {
    if (!useGrouping) return []
    const normalized = search.trim().toLowerCase()
    if (!normalized) return groups

    return groups
      .map((group) => ({
        ...group,
        lessons: group.lessons.filter((lesson) => lesson.name.toLowerCase().includes(normalized)),
      }))
      .filter((group) => group.lessons.length > 0)
  }, [groups, search, useGrouping])

  React.useEffect(() => {
    if (!useGrouping) return
    if (!search.trim()) return
    setExpanded(new Set(filteredGroups.map((g) => g.key)))
  }, [filteredGroups, search, useGrouping])

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) {
          setSearch("")
          setExpanded(new Set())
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "justify-between px-3 font-normal",
            !selectedLesson && "text-muted-foreground",
            triggerClassName
          )}
        >
          <span className="truncate">{selectedLesson?.name ?? placeholder}</span>
          <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[var(--radix-popover-trigger-width)] min-w-[240px] max-w-md p-2"
      >
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search lessons..."
          className="mb-2 h-8"
        />

        <div className="max-h-64 overflow-y-auto">
          <button
            type="button"
            className={cn(
              "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted",
              !selectedLesson && "bg-muted"
            )}
            onClick={() => {
              onSelect(null)
              setOpen(false)
            }}
          >
            <span className="text-muted-foreground">No lesson</span>
            {!selectedLesson ? <Check className="h-4 w-4 text-primary" /> : null}
          </button>

          {useGrouping ? (
            filteredGroups.length === 0 ? (
              <div className="px-2 py-3 text-center text-sm text-muted-foreground">No lessons found.</div>
            ) : (
              filteredGroups.map((group) => {
                const isExpanded = expanded.has(group.key)
                return (
                  <div key={group.key} className="mt-2">
                    <button
                      type="button"
                      className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm font-medium hover:bg-muted"
                      aria-expanded={isExpanded}
                      onClick={() => {
                        setExpanded((prev) => {
                          const next = new Set(prev)
                          if (next.has(group.key)) next.delete(group.key)
                          else next.add(group.key)
                          return next
                        })
                      }}
                    >
                      <span className="truncate">{group.name}</span>
                      <span className="ml-2 flex shrink-0 items-center gap-2 text-muted-foreground">
                        <span className="text-xs tabular-nums">{group.lessons.length}</span>
                        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </span>
                    </button>

                    {isExpanded ? (
                      <div className="mt-1 space-y-1 pl-2">
                        {group.lessons.map((lesson) => {
                          const isSelected = selectedLesson?.id === lesson.id
                          return (
                            <button
                              type="button"
                              key={lesson.id}
                              className={cn(
                                "flex w-full items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted",
                                isSelected && "bg-muted"
                              )}
                              onClick={() => {
                                onSelect(lesson.id)
                                setOpen(false)
                              }}
                            >
                              <span className="truncate">{lesson.name}</span>
                              {isSelected ? <Check className="h-4 w-4 text-primary" /> : null}
                            </button>
                          )
                        })}
                      </div>
                    ) : null}
                  </div>
                )
              })
            )
          ) : filteredLessons.length === 0 ? (
            <div className="px-2 py-3 text-center text-sm text-muted-foreground">No lessons found.</div>
          ) : (
            filteredLessons.map((lesson) => {
              const isSelected = selectedLesson?.id === lesson.id
              return (
                <button
                  type="button"
                  key={lesson.id}
                  className={cn(
                    "mt-1 flex w-full items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted",
                    isSelected && "bg-muted"
                  )}
                  onClick={() => {
                    onSelect(lesson.id)
                    setOpen(false)
                  }}
                >
                  <span className="truncate">{lesson.name}</span>
                  {isSelected ? <Check className="h-4 w-4 text-primary" /> : null}
                </button>
              )
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
