"use client"

import * as React from "react"
import { Mail, Phone, User } from "lucide-react"

import { Input } from "@/components/ui/input"

type TrialGuestErrors = Partial<
  Record<"trialFirstName" | "trialLastName" | "trialEmail" | "trialPhone", string>
>

export function TrialGuestDetailsSection({
  values,
  errors,
  onChange,
}: {
  values: {
    trialFirstName: string
    trialLastName: string
    trialEmail: string
    trialPhone: string
  }
  errors: TrialGuestErrors
  onChange: (
    key: "trialFirstName" | "trialLastName" | "trialEmail" | "trialPhone",
    value: string
  ) => void
}) {
  return (
    <section>
      <div className="mb-4 flex items-center gap-2 border-b border-slate-100 pb-3">
        <User className="h-4 w-4 text-slate-500" />
        <span className="text-[13px] font-semibold text-slate-900">Guest Details</span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            FIRST NAME <span className="text-destructive">*</span>
          </label>
          <div className="relative">
            <User className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="First name"
              autoComplete="given-name"
              value={values.trialFirstName}
              onChange={(e) => onChange("trialFirstName", e.target.value)}
              className="h-10 rounded-xl border-slate-300 bg-white pl-9 text-base font-medium shadow-none placeholder:text-slate-300 hover:bg-slate-50 focus:ring-0"
            />
          </div>
          {errors.trialFirstName ? <p className="mt-1 text-[10px] text-destructive">{errors.trialFirstName}</p> : null}
        </div>
        <div>
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            LAST NAME <span className="text-destructive">*</span>
          </label>
          <div className="relative">
            <User className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Last name"
              autoComplete="family-name"
              value={values.trialLastName}
              onChange={(e) => onChange("trialLastName", e.target.value)}
              className="h-10 rounded-xl border-slate-300 bg-white pl-9 text-base font-medium shadow-none placeholder:text-slate-300 hover:bg-slate-50 focus:ring-0"
            />
          </div>
          {errors.trialLastName ? <p className="mt-1 text-[10px] text-destructive">{errors.trialLastName}</p> : null}
        </div>
        <div>
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            EMAIL <span className="text-destructive">*</span>
          </label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <Input
              type="email"
              placeholder="guest@example.com"
              autoComplete="email"
              value={values.trialEmail}
              onChange={(e) => onChange("trialEmail", e.target.value)}
              className="h-10 rounded-xl border-slate-300 bg-white pl-9 text-base font-medium shadow-none placeholder:text-slate-300 hover:bg-slate-50 focus:ring-0"
            />
          </div>
          {errors.trialEmail ? <p className="mt-1 text-[10px] text-destructive">{errors.trialEmail}</p> : null}
        </div>
        <div>
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            PHONE
          </label>
          <div className="relative">
            <Phone className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <Input
              type="tel"
              placeholder="Phone number (optional)"
              autoComplete="tel"
              inputMode="tel"
              value={values.trialPhone}
              onChange={(e) => onChange("trialPhone", e.target.value)}
              className="h-10 rounded-xl border-slate-300 bg-white pl-9 text-base font-medium shadow-none placeholder:text-slate-300 hover:bg-slate-50 focus:ring-0"
            />
          </div>
          {errors.trialPhone ? <p className="mt-1 text-[10px] text-destructive">{errors.trialPhone}</p> : null}
        </div>
      </div>
    </section>
  )
}
