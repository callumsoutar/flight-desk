"use client"

import * as React from "react"
import { AlertTriangle, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

interface VoidAndReissueModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  invoiceId: string
  invoiceNumber?: string | null
  onSuccess?: () => void
}

export function VoidAndReissueModal({
  open,
  onOpenChange,
  invoiceId,
  invoiceNumber,
  onSuccess,
}: VoidAndReissueModalProps) {
  const [reason, setReason] = React.useState("")
  const [loading, setLoading] = React.useState(false)

  const handleVoid = async () => {
    if (!reason.trim()) {
      toast.error("A reason is required")
      return
    }

    setLoading(true)
    try {
      const response = await fetch("/api/xero/void-invoice", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ invoiceId, reason: reason.trim() }),
      })

      if (!response.ok) {
        const body = await response.json().catch(() => null)
        toast.error(body?.error || "Failed to void invoice")
        return
      }

      toast.success("Xero invoice voided — you can now edit and re-export")
      setReason("")
      onOpenChange(false)
      onSuccess?.()
    } catch {
      toast.error("Network error — please try again")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Void & Reissue Invoice
          </DialogTitle>
          <DialogDescription>
            This will void the Xero export for invoice{" "}
            <strong>{invoiceNumber || invoiceId.slice(0, 8)}</strong> and unlock
            it for editing. After making changes you can re-export to Xero.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <Label htmlFor="void-reason">Reason for voiding</Label>
          <Textarea
            id="void-reason"
            placeholder="e.g. Incorrect line items, wrong customer, pricing error..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={loading}
            className="min-h-[80px]"
          />
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleVoid}
            disabled={loading || !reason.trim()}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Voiding...
              </>
            ) : (
              "Void Xero Invoice"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
