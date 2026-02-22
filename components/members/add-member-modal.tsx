"use client"

import * as React from "react"
import { z } from "zod"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Plus } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"

const formSchema = z.object({
  first_name: z.string().trim().max(100, "First name too long").optional(),
  last_name: z.string().trim().max(100, "Last name too long").optional(),
  email: z.string().trim().toLowerCase().email("A valid email is required"),
  phone: z.string().trim().max(20, "Phone number too long").optional(),
  street_address: z.string().trim().max(200, "Street address too long").optional(),
  send_invitation: z.boolean(),
})

type FormValues = z.infer<typeof formSchema>
type FormErrors = Partial<Record<keyof FormValues, string>>

const defaultValues: FormValues = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  street_address: "",
  send_invitation: false,
}

export function AddMemberModal(props: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}) {
  const { open, onOpenChange, onSuccess } = props
  const router = useRouter()

  const [values, setValues] = React.useState<FormValues>(defaultValues)
  const [errors, setErrors] = React.useState<FormErrors>({})
  const [submitting, setSubmitting] = React.useState(false)

  React.useEffect(() => {
    if (!open) return
    setValues(defaultValues)
    setErrors({})
    setSubmitting(false)
  }, [open])

  function setField<K extends keyof FormValues>(field: K, value: FormValues[K]) {
    setValues((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => {
      if (!prev[field]) return prev
      return { ...prev, [field]: undefined }
    })
  }

  function parseValues(): FormValues | null {
    const parsed = formSchema.safeParse(values)
    if (parsed.success) {
      setErrors({})
      return parsed.data
    }

    const fieldErrors = parsed.error.flatten().fieldErrors
    setErrors({
      first_name: fieldErrors.first_name?.[0],
      last_name: fieldErrors.last_name?.[0],
      email: fieldErrors.email?.[0],
      phone: fieldErrors.phone?.[0],
      street_address: fieldErrors.street_address?.[0],
      send_invitation: fieldErrors.send_invitation?.[0],
    })
    return null
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const parsedValues = parseValues()
    if (!parsedValues) return

    setSubmitting(true)
    try {
      const res = await fetch("/api/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: parsedValues.email,
          first_name: parsedValues.first_name || null,
          last_name: parsedValues.last_name || null,
          phone: parsedValues.phone || null,
          street_address: parsedValues.street_address || null,
          send_invitation: parsedValues.send_invitation,
        }),
      })

      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        const message =
          typeof json?.error === "string"
            ? json.error
            : res.status === 409
              ? "A member with that email already exists."
              : "Failed to create member"
        toast.error(message)
        return
      }

      const member = json?.member as { id?: string } | undefined
      if (!member?.id) {
        toast.error("Member created, but response was unexpected.")
        return
      }

      toast.success("Member created")
      onOpenChange(false)
      onSuccess?.()
      router.push(`/members/${member.id}`)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "p-0 border-none shadow-2xl rounded-[24px] overflow-hidden",
          "w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] sm:w-full sm:max-w-[720px]",
          "top-[calc(env(safe-area-inset-top)+1rem)] sm:top-[50%] translate-y-0 sm:translate-y-[-50%]",
          "h-[calc(100dvh-2rem)] sm:h-auto sm:max-h-[calc(100dvh-4rem)]"
        )}
      >
        <div className="flex h-full min-h-0 flex-col bg-white">
          <DialogHeader className="px-6 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-4 text-left sm:pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
                <Plus className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold tracking-tight text-slate-900">
                  Add Member
                </DialogTitle>
                <DialogDescription className="mt-0.5 text-sm text-slate-500">
                  Create a new contact/member record. Required fields are marked with{" "}
                  <span className="text-destructive">*</span>.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form
            id="add-member-form"
            onSubmit={submit}
            className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-6 pb-6"
          >
            <div className="space-y-6">
              <section>
                <div className="mb-3 flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                  <span className="text-xs font-semibold tracking-tight text-slate-900">Contact Details</span>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                      FIRST NAME
                    </label>
                    <Input
                      autoFocus
                      className="h-10 rounded-xl border-slate-200 bg-white px-3 text-base font-medium shadow-none hover:bg-slate-50 focus-visible:ring-0"
                      placeholder="First name"
                      value={values.first_name}
                      onChange={(event) => setField("first_name", event.target.value)}
                    />
                    {errors.first_name ? (
                      <p className="mt-1 text-[10px] text-destructive">{errors.first_name}</p>
                    ) : null}
                  </div>

                  <div>
                    <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                      LAST NAME
                    </label>
                    <Input
                      className="h-10 rounded-xl border-slate-200 bg-white px-3 text-base font-medium shadow-none hover:bg-slate-50 focus-visible:ring-0"
                      placeholder="Last name"
                      value={values.last_name}
                      onChange={(event) => setField("last_name", event.target.value)}
                    />
                    {errors.last_name ? (
                      <p className="mt-1 text-[10px] text-destructive">{errors.last_name}</p>
                    ) : null}
                  </div>

                  <div className="sm:col-span-2">
                    <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                      EMAIL <span className="text-destructive">*</span>
                    </label>
                    <Input
                      type="email"
                      className="h-10 rounded-xl border-slate-200 bg-white px-3 text-base font-medium shadow-none hover:bg-slate-50 focus-visible:ring-0"
                      placeholder="name@example.com"
                      value={values.email}
                      onChange={(event) => setField("email", event.target.value)}
                    />
                    {errors.email ? (
                      <p className="mt-1 text-[10px] text-destructive">{errors.email}</p>
                    ) : null}
                  </div>

                  <div className="sm:col-span-2">
                    <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                      PHONE
                    </label>
                    <Input
                      className="h-10 rounded-xl border-slate-200 bg-white px-3 text-base font-medium shadow-none hover:bg-slate-50 focus-visible:ring-0"
                      placeholder="Optional"
                      value={values.phone}
                      onChange={(event) => setField("phone", event.target.value)}
                    />
                    {errors.phone ? (
                      <p className="mt-1 text-[10px] text-destructive">{errors.phone}</p>
                    ) : null}
                  </div>

                  <div className="sm:col-span-2">
                    <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                      STREET ADDRESS
                    </label>
                    <Input
                      className="h-10 rounded-xl border-slate-200 bg-white px-3 text-base font-medium shadow-none hover:bg-slate-50 focus-visible:ring-0"
                      placeholder="Optional"
                      value={values.street_address}
                      onChange={(event) => setField("street_address", event.target.value)}
                    />
                    {errors.street_address ? (
                      <p className="mt-1 text-[10px] text-destructive">{errors.street_address}</p>
                    ) : null}
                  </div>
                </div>
              </section>

              <section>
                <div className="mb-3 flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                  <span className="text-xs font-semibold tracking-tight text-slate-900">Authentication</span>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-semibold text-slate-900">Send Invitation</Label>
                      <p className="text-xs text-slate-500">
                        Invite this member to create an account and access the portal.
                      </p>
                    </div>
                    <Switch
                      checked={values.send_invitation}
                      onCheckedChange={(checked) => setField("send_invitation", checked)}
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
                disabled={submitting}
                className="h-10 flex-1 rounded-xl border-slate-200 text-xs font-bold shadow-none hover:bg-slate-50"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                form="add-member-form"
                disabled={submitting}
                className="h-10 flex-[1.4] rounded-xl bg-slate-900 text-xs font-bold text-white shadow-lg shadow-slate-900/10 hover:bg-slate-800"
              >
                {submitting ? "Saving..." : "Save Member"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
