"use client"

import Link from "next/link"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { AircraftUtilisationRow } from "@/lib/types/reports"
import { cn } from "@/lib/utils"

function percentTone(row: AircraftUtilisationRow) {
  if (row.flights === 0) return "bg-slate-100 text-slate-600"
  if (row.utilisation_pct >= 40) return "bg-emerald-100 text-emerald-800"
  if (row.utilisation_pct >= 20) return "bg-amber-100 text-amber-800"
  return "bg-rose-100 text-rose-800"
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-NZ", { style: "currency", currency: "NZD", maximumFractionDigits: 2 }).format(
    value
  )
}

export function AircraftUtilisationTable({
  rows,
  dailyAvailableHours,
}: {
  rows: AircraftUtilisationRow[]
  dailyAvailableHours: number
}) {
  return (
    <Card className="border-slate-200/60 bg-white shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-slate-900">Aircraft Utilisation</CardTitle>
        <p className="text-xs text-slate-500">Well-utilised training aircraft: 40-60%</p>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Registration</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Hours Flown</TableHead>
              <TableHead>Available Hours</TableHead>
              <TableHead>Utilisation %</TableHead>
              <TableHead>Maintenance Days</TableHead>
              <TableHead>Revenue</TableHead>
              <TableHead>Open Observations</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-sm text-slate-500">
                  No aircraft utilisation data in this period.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.aircraft_id}>
                  <TableCell className="font-medium text-slate-900">{row.registration}</TableCell>
                  <TableCell>{row.aircraft_type}</TableCell>
                  <TableCell>{row.hours_flown.toFixed(1)}h</TableCell>
                  <TableCell>{row.available_hours.toFixed(1)}h</TableCell>
                  <TableCell>
                    <span className={cn("inline-flex rounded-md px-2 py-0.5 text-xs font-semibold", percentTone(row))}>
                      {row.utilisation_pct.toFixed(1)}%
                    </span>
                  </TableCell>
                  <TableCell>{row.maintenance_days}</TableCell>
                  <TableCell>{formatCurrency(row.hire_revenue)}</TableCell>
                  <TableCell>{row.open_observations}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        <p className="mt-3 text-xs text-slate-500">
          Based on {dailyAvailableHours.toFixed(1)} hrs/day available. Change in{" "}
          <Link href="/settings?tab=bookings" className="font-medium text-indigo-700 hover:text-indigo-800">
            Settings -&gt; Bookings
          </Link>
          .
        </p>
      </CardContent>
    </Card>
  )
}
