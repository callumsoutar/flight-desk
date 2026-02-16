"use client"

import * as React from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import { Input } from "@/components/ui/input"

export default function RecordPaymentModal({
  open,
  onOpenChange,
  invoiceId,
  invoiceNumber,
  totalAmount,
  totalPaid,
  balanceDue,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  invoiceId: string
  invoiceNumber?: string | null
  totalAmount?: number | null
  totalPaid?: number | null
  balanceDue?: number | null
  onSuccess?: () => void
}) {
  const [amount, setAmount] = React.useState("")
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const handleSubmit = async () => {
    setIsSubmitting(true)

    // Placeholder until payment API is available in this codebase.
    await new Promise((resolve) => setTimeout(resolve, 500))

    toast.success(`Payment recorded for ${invoiceNumber || invoiceId.slice(0, 8)}`)
    onOpenChange(false)
    onSuccess?.()
    setIsSubmitting(false)
    setAmount("")
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Record Payment</DrawerTitle>
          <DrawerDescription>
            Add a payment for invoice {invoiceNumber || `#${invoiceId.slice(0, 8)}`}.
          </DrawerDescription>
        </DrawerHeader>

        <div className="space-y-3 px-4">
          <div className="text-sm text-muted-foreground">
            Total: ${Number(totalAmount || 0).toFixed(2)} | Paid: ${Number(totalPaid || 0).toFixed(2)} | Balance: ${Number(balanceDue || 0).toFixed(2)}
          </div>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="Payment amount"
          />
        </div>

        <DrawerFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || !amount}>
            {isSubmitting ? "Saving..." : "Record Payment"}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
