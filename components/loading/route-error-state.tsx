"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export function RouteErrorState({
  title,
  message,
  reset,
}: {
  title: string
  message: string
  reset: () => void
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{message}</CardDescription>
      </CardHeader>
      <div className="px-6 pb-6">
        <Button onClick={reset}>Try again</Button>
      </div>
    </Card>
  )
}
