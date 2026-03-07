"use client"

import * as React from "react"

type TimezoneContextValue = {
  timeZone: string
}

const TimezoneContext = React.createContext<TimezoneContextValue>({
  timeZone: "Pacific/Auckland",
})

export function TimezoneProvider({
  timeZone,
  children,
}: {
  timeZone: string
  children: React.ReactNode
}) {
  const value = React.useMemo(() => ({ timeZone }), [timeZone])
  return (
    <TimezoneContext.Provider value={value}>
      {children}
    </TimezoneContext.Provider>
  )
}

export function useTimezone() {
  return React.useContext(TimezoneContext)
}
