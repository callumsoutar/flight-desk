"use client"

import * as React from "react"
import { toast } from "sonner"

function resolveMessage<T>(
  value: string | ((arg: T) => string),
  arg: T
) {
  return typeof value === "function" ? value(arg) : value
}

function LoadingToastContent({
  title,
  description,
}: {
  title: string
  description?: string
}) {
  const steps = React.useMemo(() => [14, 24, 37, 49, 58, 66, 73, 79, 84, 88], [])
  const [index, setIndex] = React.useState(0)

  React.useEffect(() => {
    const interval = window.setInterval(() => {
      setIndex((current) => (current + 1) % steps.length)
    }, 180)

    return () => window.clearInterval(interval)
  }, [steps.length])

  return (
    <div className="w-full min-w-0">
      <div className="text-sm font-medium text-foreground">{title}</div>
      {description ? (
        <div className="mt-1 text-sm text-muted-foreground">{description}</div>
      ) : null}
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-200 ease-out"
          style={{ width: `${steps[index]}%` }}
        />
      </div>
    </div>
  )
}

export async function runAsyncProgressToast<T>({
  promise,
  loading,
  loadingDescription,
  success,
  successDescription,
  error,
  errorDescription,
  successDuration = 4000,
  errorDuration = 6000,
}: {
  promise: Promise<T> | (() => Promise<T>)
  loading: string
  loadingDescription?: string
  success: string | ((result: T) => string)
  successDescription?: string | ((result: T) => string)
  error: string | ((cause: unknown) => string)
  errorDescription?: string | ((cause: unknown) => string)
  successDuration?: number
  errorDuration?: number
}) {
  const toastId = toast.loading(
    <LoadingToastContent title={loading} description={loadingDescription} />,
    {
      duration: Infinity,
      dismissible: false,
    }
  )

  try {
    const result = await (typeof promise === "function" ? promise() : promise)
    toast.success(resolveMessage(success, result), {
      id: toastId,
      duration: successDuration,
      description: successDescription ? resolveMessage(successDescription, result) : undefined,
      dismissible: true,
    })
    return result
  } catch (cause) {
    toast.error(resolveMessage(error, cause), {
      id: toastId,
      duration: errorDuration,
      description: errorDescription ? resolveMessage(errorDescription, cause) : undefined,
      dismissible: true,
    })
    throw cause
  }
}
