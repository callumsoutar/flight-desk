type SubjectVars = {
  tenantName?: string
  memberFirstName?: string
  memberLastName?: string
  bookingId?: string
  invoiceNumber?: string
  flightDate?: string
  aircraftRegistration?: string
}

export function interpolateSubject(template: string, vars: SubjectVars): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    return (vars as Record<string, string | undefined>)[key] ?? ""
  })
}
