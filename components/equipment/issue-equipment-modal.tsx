"use client"

import * as React from "react"
import { Calendar, FileText, LogOut, User } from "lucide-react"
import { toast } from "sonner"
import { z } from "zod"

import MemberSelect, { type UserResult } from "@/components/invoices/member-select"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import type { EquipmentWithIssuance } from "@/lib/types/equipment"
import { cn } from "@/lib/utils"

interface IssueEquipmentModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  equipment: EquipmentWithIssuance | null
  members: UserResult[]
  onSuccess?: () => void
}

const issueSchema = z.object({
  user_id: z.string().uuid("Please select a user"),
  expected_return: z.string().optional(),
  notes: z.string().optional(),
})

export function IssueEquipmentModal({
  open,
  onOpenChange,
  equipment,
  members,
  onSuccess,
}: IssueEquipmentModalProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [selectedUser, setSelectedUser] = React.useState<UserResult | null>(null)
  const [expectedReturn, setExpectedReturn] = React.useState("")
  const [notes, setNotes] = React.useState("")
  const [userIdError, setUserIdError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (open) {
      setSelectedUser(null)
      setExpectedReturn("")
      setNotes("")
      setUserIdError(null)
    }
  }, [open])

  const onSubmit = async () => {
    if (!equipment) return

    const parsed = issueSchema.safeParse({
      user_id: selectedUser?.id ?? "",
      expected_return: expectedReturn,
      notes,
    })

    if (!parsed.success) {
      const message = parsed.error.flatten().fieldErrors.user_id?.[0] ?? "Please select a user"
      setUserIdError(message)
      return
    }
    setUserIdError(null)

    setIsSubmitting(true)
    try {
      const response = await fetch("/api/equipment-issuance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          equipment_id: equipment.id,
          user_id: parsed.data.user_id,
          expected_return: parsed.data.expected_return || null,
          notes: parsed.data.notes || null,
        }),
      })

      const payload = (await response.json().catch(() => null)) as { error?: string } | null
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to issue equipment")
      }

      toast.success("Equipment issued successfully")
      onOpenChange(false)
      onSuccess?.()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to issue equipment")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!equipment) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "p-0 border-none shadow-2xl rounded-[24px] overflow-hidden flex flex-col",
          "w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] sm:w-full sm:max-w-[500px]",
          "top-[calc(env(safe-area-inset-top)+1rem)] sm:top-[50%] translate-y-0 sm:translate-y-[-50%]",
          "h-[calc(100dvh-2rem)] sm:h-auto sm:max-h-[min(calc(100dvh-4rem),850px)]"
        )}
      >
        <div className="flex h-full min-h-0 flex-col bg-white">
          <DialogHeader className="px-6 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-4 text-left sm:pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                <LogOut className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold tracking-tight text-slate-900">
                  Issue Equipment
                </DialogTitle>
                <DialogDescription className="mt-0.5 text-sm text-slate-500">
                  Issue {equipment.name} to a user. Required fields are marked with{" "}
                  <span className="text-destructive">*</span>.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form
            onSubmit={(event) => {
              event.preventDefault()
              void onSubmit()
            }}
            className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-6 pb-6"
          >
            <div className="space-y-6">
              <section>
                <div className="mb-3 flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                  <span className="text-xs font-semibold tracking-tight text-slate-900">Recipient</span>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                    Issue To <span className="text-destructive">*</span>
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-3.5 w-3.5 text-slate-400 z-10" />
                    <MemberSelect
                      members={members}
                      value={selectedUser}
                      onSelect={(user) => {
                        setSelectedUser(user)
                        setUserIdError(null)
                      }}
                      disabled={isSubmitting || members.length === 0}
                    />
                  </div>
                  {members.length === 0 ? (
                    <p className="text-[10px] font-medium text-destructive">
                      No active members available to issue equipment.
                    </p>
                  ) : null}
                  {userIdError ? (
                    <p className="text-[10px] font-medium text-destructive">
                      {userIdError}
                    </p>
                  ) : null}
                </div>
              </section>

              <section>
                <div className="mb-3 flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                  <span className="text-xs font-semibold tracking-tight text-slate-900">Timeline</span>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                    Expected Return Date
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-3 h-3.5 w-3.5 text-slate-400" />
                    <Input
                      type="date"
                      value={expectedReturn}
                      onChange={(event) => setExpectedReturn(event.target.value)}
                      className="h-10 rounded-xl border-slate-200 bg-white pl-9 text-base font-medium shadow-none hover:bg-slate-50 focus:ring-0"
                    />
                  </div>
                </div>
              </section>

              <section>
                <div className="mb-3 flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                  <span className="text-xs font-semibold tracking-tight text-slate-900">Notes & Remarks</span>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Notes</label>
                  <div className="relative">
                    <FileText className="absolute left-3 top-3 h-3.5 w-3.5 text-slate-400" />
                    <Textarea
                      placeholder="Additional notes..."
                      value={notes}
                      onChange={(event) => setNotes(event.target.value)}
                      className="rounded-xl border-slate-200 bg-white pl-9 text-base font-medium shadow-none hover:bg-slate-50 focus:ring-0 min-h-[100px] resize-none"
                    />
                  </div>
                </div>
              </section>
            </div>
          </form>

          <div className="border-t bg-white px-6 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-[0_-4px_12px_rgba(0,0,0,0.05)] sm:pb-4">
            <div className="flex items-center justify-between gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
                className="h-10 flex-1 rounded-xl border-slate-200 text-sm font-bold shadow-none hover:bg-slate-50"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                onClick={() => void onSubmit()}
                disabled={isSubmitting || members.length === 0}
                className="h-10 flex-[1.4] rounded-xl bg-slate-900 text-sm font-bold text-white shadow-lg shadow-slate-900/10 hover:bg-slate-800"
              >
                {isSubmitting ? "Issuing..." : "Issue Equipment"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
