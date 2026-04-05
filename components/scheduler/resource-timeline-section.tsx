"use client"

import * as React from "react"

export function ResourceTimelineSection<T>({
  items,
  renderRow,
}: {
  items: T[]
  renderRow: (item: T, index: number) => React.ReactNode
}) {
  return <>{items.map((item, index) => renderRow(item, index))}</>
}
