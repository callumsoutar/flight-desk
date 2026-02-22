"use client"

import * as React from "react"
import { IconCalendar, IconChevronRight, IconCircleCheck } from "@tabler/icons-react"

import { Badge } from "@/components/ui/badge"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import type { Equipment, EquipmentIssuance } from "@/lib/types/equipment"

interface EquipmentIssuanceTableProps {
  issuances: EquipmentIssuance[]
  userMap: Record<string, string>
  loading?: boolean
  error?: string | null
  equipment?: Equipment
  refresh?: () => void
}

function formatShortDate(value: string | null) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

export function EquipmentIssuanceTable({
  issuances,
  userMap,
  loading,
  error,
}: EquipmentIssuanceTableProps) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="text-2xl font-bold tracking-tight text-slate-900">Issuance History</h3>
        <p className="mt-1 text-slate-600">Track equipment loans and returns.</p>
      </div>

      <div className="hidden overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm md:block">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/50">
              <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-slate-600 uppercase">
                Issued To
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-slate-600 uppercase">
                Issued By
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-slate-600 uppercase">
                Issued Date
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-slate-600 uppercase">
                Expected Return
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold tracking-wide text-slate-600 uppercase">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-slate-600 uppercase">
                Notes
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={6} className="h-24 text-center font-medium text-slate-500">
                  Loading...
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={6} className="h-24 text-center font-medium text-red-500">
                  {error}
                </td>
              </tr>
            ) : issuances.length === 0 ? (
              <tr>
                <td colSpan={6} className="h-24 text-center font-medium text-slate-500">
                  No issuance records found.
                </td>
              </tr>
            ) : (
              issuances.map((row) => {
                const issuedDate = formatShortDate(row.issued_at)
                const expectedReturn = formatShortDate(row.expected_return)
                const returnedDate = formatShortDate(row.returned_at)
                const notesTruncated =
                  row.notes && row.notes.length > 50 ? `${row.notes.slice(0, 50)}...` : row.notes

                return (
                  <tr key={row.id} className="group transition-colors hover:bg-slate-50/50">
                    <td className="px-4 py-3.5 align-middle">
                      <span className="font-semibold text-slate-900">{userMap[row.user_id] || row.user_id}</span>
                    </td>
                    <td className="px-4 py-3.5 align-middle">
                      <span className="font-medium text-slate-600">
                        {userMap[row.issued_by] || row.issued_by}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 align-middle">
                      {issuedDate ? (
                        <span className="font-medium text-slate-700">{issuedDate}</span>
                      ) : (
                        <span className="text-slate-500">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 align-middle">
                      {expectedReturn ? (
                        <span className="font-medium text-slate-700">{expectedReturn}</span>
                      ) : (
                        <span className="text-slate-500">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-center align-middle">
                      {returnedDate ? (
                        <Badge
                          variant="outline"
                          className="border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700"
                        >
                          Returned {returnedDate}
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700"
                        >
                          Out
                        </Badge>
                      )}
                    </td>
                    <td className="max-w-[200px] px-4 py-3.5 align-middle">
                      {row.notes && row.notes.length > 50 ? (
                        <Popover>
                          <PopoverTrigger asChild>
                            <span
                              className="cursor-pointer text-sm text-slate-600 underline decoration-dotted hover:text-slate-900"
                              tabIndex={0}
                              aria-label="Show full notes"
                            >
                              {notesTruncated}
                            </span>
                          </PopoverTrigger>
                          <PopoverContent side="top" className="max-w-xs whitespace-pre-line text-sm">
                            {row.notes}
                          </PopoverContent>
                        </Popover>
                      ) : (
                        <span className="text-sm text-slate-600">{row.notes || "-"}</span>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 md:hidden">
        {loading ? (
          <div className="rounded-lg border border-dashed border-slate-200 bg-white py-12 text-center font-medium text-slate-500">
            Loading...
          </div>
        ) : error ? (
          <div className="rounded-lg border border-dashed border-slate-200 bg-white py-12 text-center font-medium text-red-500">
            {error}
          </div>
        ) : issuances.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 bg-white py-12 text-center font-medium text-slate-500">
            No issuance records found.
          </div>
        ) : (
          issuances.map((row) => {
            const issuedDate = formatShortDate(row.issued_at)
            const expectedReturn = formatShortDate(row.expected_return)
            const returnedDate = formatShortDate(row.returned_at)

            return (
              <div
                key={row.id}
                className="relative overflow-hidden rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition-colors active:bg-slate-50"
              >
                <div className="absolute top-0 bottom-0 left-0 w-1 rounded-l-lg bg-slate-900" />

                <div className="mb-3 flex items-start justify-between pl-2">
                  <div className="flex flex-col">
                    <h3 className="font-semibold text-slate-900">{userMap[row.user_id] || row.user_id}</h3>
                    <span className="text-xs text-slate-600">
                      Issued by {userMap[row.issued_by] || row.issued_by}
                    </span>
                  </div>
                  {returnedDate ? (
                    <Badge
                      variant="outline"
                      className="border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700"
                    >
                      Returned
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700"
                    >
                      Out
                    </Badge>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4 pl-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase">
                      <IconCalendar className="h-3 w-3" /> Issued
                    </div>
                    <div className="text-sm font-semibold text-slate-700">{issuedDate || "-"}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase">
                      <IconCircleCheck className="h-3 w-3" /> Expected
                    </div>
                    <div className="text-sm font-semibold text-slate-700">{expectedReturn || "-"}</div>
                  </div>
                  {returnedDate ? (
                    <div className="col-span-2 space-y-1">
                      <div className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase">
                        <IconCircleCheck className="h-3 w-3 text-emerald-600" /> Returned
                      </div>
                      <div className="text-sm font-semibold text-emerald-700">{returnedDate}</div>
                    </div>
                  ) : null}
                </div>

                {row.notes ? (
                  <div className="mt-3 border-t border-slate-100 pt-3 pl-2">
                    <p className="text-xs leading-relaxed text-slate-600">{row.notes}</p>
                  </div>
                ) : null}

                <div className="absolute right-4 bottom-4">
                  <IconChevronRight className="h-4 w-4 text-slate-400" />
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
