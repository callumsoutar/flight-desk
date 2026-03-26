"use client"

import * as React from "react"

export function ResourceTimelineSection<T>({
  items,
  renderRow,
}: {
  items: T[]
  renderRow: (item: T) => React.ReactNode
}) {
  return <>{items.map((item) => renderRow(item))}</>
}
