"use client"

import * as React from "react"
import { IconCalendar, IconChevronRight, IconPlus } from "@tabler/icons-react"

import { UpdateEquipmentModal } from "@/components/equipment/update-equipment-modal"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import type { Equipment, EquipmentUpdate } from "@/lib/types/equipment"

interface EquipmentUpdatesTableProps {
  updates: EquipmentUpdate[]
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

export function EquipmentUpdatesTable({
  updates,
  userMap,
  loading,
  error,
  equipment,
  refresh,
}: EquipmentUpdatesTableProps) {
  const [modalOpen, setModalOpen] = React.useState(false)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h3 className="text-2xl font-bold tracking-tight text-slate-900">Update History</h3>
          <p className="mt-1 text-slate-600">Track maintenance and inspection records.</p>
        </div>
        {equipment ? (
          <Button
            onClick={() => setModalOpen(true)}
            className="h-10 bg-slate-900 px-5 font-semibold text-white hover:bg-slate-800"
          >
            <IconPlus className="mr-2 h-4 w-4" />
            Log Update
          </Button>
        ) : null}
      </div>

      {equipment ? (
        <UpdateEquipmentModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          equipment={equipment}
          onSuccess={refresh}
        />
      ) : null}

      <div className="hidden overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm md:block">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/50">
              <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-slate-600 uppercase">
                Updated By
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-slate-600 uppercase">
                Update Date
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-slate-600 uppercase">
                Next Due At
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-slate-600 uppercase">
                Notes
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={4} className="h-24 text-center font-medium text-slate-500">
                  Loading...
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={4} className="h-24 text-center font-medium text-red-500">
                  {error}
                </td>
              </tr>
            ) : updates.length === 0 ? (
              <tr>
                <td colSpan={4} className="h-24 text-center font-medium text-slate-500">
                  No update records found.
                </td>
              </tr>
            ) : (
              updates.map((row) => {
                const updateDate = formatShortDate(row.updated_at)
                const nextDueAt = formatShortDate(row.next_due_at)
                const notesTruncated =
                  row.notes && row.notes.length > 50 ? `${row.notes.slice(0, 50)}...` : row.notes

                return (
                  <tr key={row.id} className="group transition-colors hover:bg-slate-50/50">
                    <td className="px-4 py-3.5 align-middle">
                      <span className="font-semibold text-slate-900">
                        {userMap[row.updated_by] || row.updated_by}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 align-middle">
                      {updateDate ? (
                        <span className="font-medium text-slate-700">{updateDate}</span>
                      ) : (
                        <span className="text-slate-500">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 align-middle">
                      {nextDueAt ? (
                        <span className="font-medium text-slate-700">{nextDueAt}</span>
                      ) : (
                        <span className="text-slate-500">-</span>
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
        ) : updates.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 bg-white py-12 text-center font-medium text-slate-500">
            No update records found.
          </div>
        ) : (
          updates.map((row) => {
            const updateDate = formatShortDate(row.updated_at)
            const nextDueAt = formatShortDate(row.next_due_at)

            return (
              <div
                key={row.id}
                className="relative overflow-hidden rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition-colors active:bg-slate-50"
              >
                <div className="absolute top-0 bottom-0 left-0 w-1 rounded-l-lg bg-slate-900" />

                <div className="mb-3 flex items-start justify-between pl-2">
                  <div className="flex flex-col">
                    <h3 className="font-semibold text-slate-900">{userMap[row.updated_by] || row.updated_by}</h3>
                    <span className="text-xs text-slate-600">{updateDate || "-"}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pl-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase">
                      <IconCalendar className="h-3 w-3" /> Updated
                    </div>
                    <div className="text-sm font-semibold text-slate-700">{updateDate || "-"}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase">
                      <IconCalendar className="h-3 w-3" /> Next Due
                    </div>
                    <div className="text-sm font-semibold text-slate-700">{nextDueAt || "-"}</div>
                  </div>
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
