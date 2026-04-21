"use client"

import * as React from "react"
import { Check, ChevronDown, ChevronRight, ChevronsUpDown, Loader2 } from "lucide-react"

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
  nextLessonId = null,
  nextLessonName = null,
  nextLessonLoading = false,
  nextLessonAlreadyBooked = false,
  triggerClassName,
}: {
  lessons: LessonLite[]
  syllabi: SyllabusLite[]
  value: string | null
  onSelect: (lessonId: string | null) => void
  disabled?: boolean
  placeholder?: string
  nextLessonId?: string | null
  nextLessonName?: string | null
  nextLessonLoading?: boolean
  /** True when the syllabus next lesson already has a future booking (from training peek). */
  nextLessonAlreadyBooked?: boolean
  triggerClassName?: string
}) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")
  const [expanded, setExpanded] = React.useState<Set<string>>(() => new Set())

  const selectedLesson = React.useMemo(() => {
    if (!value) return null
    return lessons.find((lesson) => lesson.id === value) ?? null
  }, [lessons, value])

  const nextLesson = React.useMemo(() => {
    if (!nextLessonId) return null
    return lessons.find((lesson) => lesson.id === nextLessonId) ?? null
  }, [lessons, nextLessonId])

  const nextLessonDisplayName = nextLesson?.name ?? nextLessonName ?? null

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

  React.useEffect(() => {
    if (!open || !useGrouping || search.trim()) return

    const nextExpanded = new Set<string>()
    if (selectedLesson) nextExpanded.add(selectedLesson.syllabus_id ?? "__unassigned__")
    if (nextLesson) nextExpanded.add(nextLesson.syllabus_id ?? "__unassigned__")
    if (nextExpanded.size > 0) setExpanded(nextExpanded)
  }, [nextLesson, open, search, selectedLesson, useGrouping])

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
            !selectedLesson && !nextLessonDisplayName && !nextLessonLoading && "text-muted-foreground",
            triggerClassName
          )}
        >
          <span className="truncate">
            {selectedLesson?.name
              ? selectedLesson.name
              : nextLessonLoading
                ? "Loading next lesson..."
                : nextLessonDisplayName
                  ? nextLessonAlreadyBooked
                    ? `Next lesson: ${nextLessonDisplayName} (booked)`
                    : `Next lesson: ${nextLessonDisplayName}`
                  : placeholder}
          </span>
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
          className="mb-2 h-8 text-base md:text-sm"
        />

        {nextLessonLoading ? (
          <div className="mb-2 flex items-center gap-2 rounded-md border border-border bg-muted/40 px-2.5 py-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
            Finding next lesson…
          </div>
        ) : nextLessonDisplayName ? (
          <div className="mb-2 rounded-md border border-border bg-muted/30 px-2.5 py-2">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-medium text-muted-foreground">Next in syllabus</p>
                <p className="truncate text-sm font-medium leading-snug">{nextLessonDisplayName}</p>
              </div>
              {nextLessonAlreadyBooked ? (
                <span className="shrink-0 rounded-md border border-border bg-background px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                  Booked
                </span>
              ) : selectedLesson?.id === nextLessonId && nextLesson ? (
                <span className="inline-flex h-7 shrink-0 items-center text-primary" title="Selected">
                  <Check className="h-4 w-4" />
                </span>
              ) : nextLesson ? (
                <button
                  type="button"
                  className="inline-flex h-7 shrink-0 items-center rounded-md border border-border bg-background px-2 text-xs font-medium text-foreground shadow-xs transition-colors hover:bg-muted"
                  onClick={() => {
                    onSelect(nextLesson.id)
                    setOpen(false)
                  }}
                >
                  Select
                </button>
              ) : (
                <span className="shrink-0 text-[11px] text-muted-foreground">Unavailable</span>
              )}
            </div>
          </div>
        ) : null}

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
                          const isNextLesson = lesson.id === nextLessonId
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
                              <span className="ml-2 flex shrink-0 items-center gap-1.5">
                                {isNextLesson ? (
                                  nextLessonAlreadyBooked ? (
                                    <span className="rounded-full border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                                      Booked
                                    </span>
                                  ) : (
                                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-700">
                                      Next
                                    </span>
                                  )
                                ) : null}
                                {isSelected ? <Check className="h-4 w-4 text-primary" /> : null}
                              </span>
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
              const isNextLesson = lesson.id === nextLessonId
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
                  <span className="ml-2 flex shrink-0 items-center gap-1.5">
                    {isNextLesson ? (
                      nextLessonAlreadyBooked ? (
                        <span className="rounded-full border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                          Booked
                        </span>
                      ) : (
                        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-700">
                          Next
                        </span>
                      )
                    ) : null}
                    {isSelected ? <Check className="h-4 w-4 text-primary" /> : null}
                  </span>
                </button>
              )
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
