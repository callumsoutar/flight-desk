"use client"

import * as React from "react"
import Link from "next/link"
import { AlertCircle, Loader2, MessageSquare } from "lucide-react"

import { Button } from "@/components/ui/button"
import type {
  MemberTrainingComment,
  MemberTrainingCommentsResponse,
} from "@/lib/types/member-training"

type MemberTrainingTabProps = {
  memberId: string
}

const PAGE_SIZE = 5

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return date.toLocaleDateString("en-NZ", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

function sanitizeHTML(html: string | null): string {
  if (!html) return "-"
  let sanitized = html
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
  sanitized = sanitized.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "")
  sanitized = sanitized.replace(
    /<(object|embed)\b[^<]*(?:(?!<\/(object|embed)>)<[^<]*)*<\/(object|embed)>/gi,
    ""
  )
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, "")
  return sanitized
}

function instructorName(comment: MemberTrainingComment): string {
  const first = comment.instructor?.user?.first_name ?? ""
  const last = comment.instructor?.user?.last_name ?? ""
  const full = `${first} ${last}`.trim()
  return full || "-"
}

async function fetchComments(
  memberId: string,
  offset: number,
  limit: number
): Promise<MemberTrainingCommentsResponse> {
  const response = await fetch(
    `/api/members/${memberId}/training/comments?offset=${offset}&limit=${limit}`,
    {
      method: "GET",
      cache: "no-store",
    }
  )

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(payload?.error || "Failed to load training comments")
  }

  return payload as MemberTrainingCommentsResponse
}

export function MemberTrainingTab({ memberId }: MemberTrainingTabProps) {
  const [comments, setComments] = React.useState<MemberTrainingComment[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [isFetchingMore, setIsFetchingMore] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [nextOffset, setNextOffset] = React.useState<number | null>(0)

  const loadMoreRef = React.useRef<HTMLDivElement | null>(null)

  const loadPage = React.useCallback(
    async (offset: number, replace: boolean) => {
      if (!memberId) return

      if (replace) {
        setIsLoading(true)
      } else {
        setIsFetchingMore(true)
      }

      try {
        const result = await fetchComments(memberId, offset, PAGE_SIZE)

        setComments((prev) => {
          if (replace) return result.comments
          const existingIds = new Set(prev.map((item) => item.id))
          const merged = [...prev]
          for (const item of result.comments) {
            if (!existingIds.has(item.id)) merged.push(item)
          }
          return merged
        })

        setNextOffset(result.next_offset)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load training comments")
      } finally {
        if (replace) {
          setIsLoading(false)
        } else {
          setIsFetchingMore(false)
        }
      }
    },
    [memberId]
  )

  React.useEffect(() => {
    setComments([])
    setNextOffset(0)
    setError(null)
    if (!memberId) {
      setIsLoading(false)
      return
    }
    void loadPage(0, true)
  }, [memberId, loadPage])

  React.useEffect(() => {
    const node = loadMoreRef.current
    if (!node) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return
        if (isLoading || isFetchingMore) return
        if (nextOffset == null) return
        void loadPage(nextOffset, false)
      },
      { threshold: 0.1 }
    )

    observer.observe(node)
    return () => {
      observer.disconnect()
    }
  }, [isLoading, isFetchingMore, nextOffset, loadPage])

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/30 py-20">
        <Loader2 className="mb-4 h-6 w-6 animate-spin text-slate-400" />
        <p className="text-sm text-slate-500">Loading instructor comments...</p>
      </div>
    )
  }

  if (error && comments.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-8 text-center">
        <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100">
          <AlertCircle className="h-5 w-5 text-slate-400" />
        </div>
        <h4 className="mb-1 text-sm font-semibold text-slate-900">Unable to load comments</h4>
        <p className="mx-auto mb-6 max-w-[300px] text-xs text-slate-500">
          {error}
        </p>
        <button
          onClick={() => {
            setComments([])
            setNextOffset(0)
            setError(null)
            void loadPage(0, true)
          }}
          className="rounded-md border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
        >
          Try Again
        </button>
      </div>
    )
  }

  if (comments.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/30 p-16 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
          <MessageSquare className="h-6 w-6 text-slate-300" />
        </div>
        <h3 className="text-sm font-semibold text-slate-900">No instructor comments found</h3>
        <p className="mx-auto mt-2 max-w-[280px] text-xs leading-relaxed text-slate-500">
          Instructor comments recorded during flight lessons will appear here automatically.
        </p>
      </div>
    )
  }

  return (
    <div className="animate-in fade-in space-y-4 duration-500">
      <div className="mb-2 flex items-center justify-between px-1">
        <h3 className="text-sm font-semibold text-slate-900">Instructor Feedback</h3>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
          {comments.length} Records
        </span>
      </div>

      <div className="hidden overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm md:block">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/50">
              <th className="w-[160px] px-6 py-3 text-left text-xs font-semibold text-slate-500">Date</th>
              <th className="w-[140px] px-6 py-3 text-left text-xs font-semibold text-slate-500">Aircraft</th>
              <th className="w-[200px] px-6 py-3 text-left text-xs font-semibold text-slate-500">Instructor</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500">Comments</th>
              <th className="w-[120px] px-6 py-3 text-right text-xs font-semibold text-slate-500">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {comments.map((comment) => (
              <tr key={comment.id} className="transition-colors hover:bg-slate-50/50">
                <td className="px-6 py-4 align-middle whitespace-nowrap text-slate-700">
                  {formatDateTime(comment.date)}
                </td>
                <td className="px-6 py-4 align-middle font-medium text-slate-900">
                  {comment.booking?.aircraft?.registration || "-"}
                </td>
                <td className="px-6 py-4 align-middle text-slate-700">{instructorName(comment)}</td>
                <td className="px-6 py-4 align-middle">
                  <div
                    className="line-clamp-2 leading-normal text-slate-600"
                    dangerouslySetInnerHTML={{ __html: sanitizeHTML(comment.instructor_comments) }}
                  />
                </td>
                <td className="px-6 py-4 text-right align-middle">
                  {comment.booking_id ? (
                    <Button variant="ghost" size="sm" asChild className="h-8 px-2 hover:bg-primary/10">
                      <Link href={`/bookings/${comment.booking_id}`}>View Booking</Link>
                    </Button>
                  ) : (
                    <span className="text-xs text-slate-400">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 md:hidden">
        {comments.map((comment) => (
          <div key={comment.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-2 flex items-start justify-between">
              <span className="text-xs font-semibold text-slate-900">{formatDateTime(comment.date)}</span>
              <span className="text-[10px] font-semibold text-slate-600">
                {comment.booking?.aircraft?.registration || "-"}
              </span>
            </div>

            <div className="mb-2">
              <div className="mb-0.5 text-[10px] text-slate-500">Instructor</div>
              <div className="text-xs font-medium text-slate-900">{instructorName(comment)}</div>
            </div>

            <div>
              <div className="mb-1 text-[10px] text-slate-500">Comments</div>
              <div
                className="line-clamp-3 text-sm leading-normal text-slate-600"
                dangerouslySetInnerHTML={{ __html: sanitizeHTML(comment.instructor_comments) }}
              />
            </div>

            <div className="mt-4 border-t border-slate-100 pt-3">
              {comment.booking_id ? (
                <Button variant="outline" size="sm" className="h-9 w-full text-xs font-semibold" asChild>
                  <Link href={`/bookings/${comment.booking_id}`}>View Booking</Link>
                </Button>
              ) : (
                <Button variant="outline" size="sm" className="h-9 w-full text-xs font-semibold" disabled>
                  No booking linked
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div ref={loadMoreRef} className="flex h-12 w-full items-center justify-center pt-4">
        {isFetchingMore ? (
          <div className="flex items-center gap-2 text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-[10px] font-medium tracking-widest uppercase">Loading more...</span>
          </div>
        ) : nextOffset != null ? (
          <div className="h-1 w-full overflow-hidden rounded-full bg-slate-100">
            <div className="h-full w-full animate-pulse bg-slate-200" />
          </div>
        ) : comments.length > 0 ? (
          <p className="text-[10px] font-medium tracking-widest text-slate-300 uppercase">End of records</p>
        ) : null}
      </div>
    </div>
  )
}
