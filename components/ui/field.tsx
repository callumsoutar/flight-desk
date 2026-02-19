import { cn } from "@/lib/utils"

type FieldIssue = {
  message?: string
}

export function FieldError({
  errors,
  className,
}: {
  errors?: FieldIssue[]
  className?: string
}) {
  const message = errors?.find((error) => Boolean(error?.message))?.message
  if (!message) return null

  return (
    <p className={cn("mt-2 text-sm font-medium text-destructive", className)}>
      {message}
    </p>
  )
}
