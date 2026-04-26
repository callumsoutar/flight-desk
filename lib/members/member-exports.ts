import type { MemberWithRelations, MembershipStatus } from "@/lib/types/members"

export const MEMBER_EXPORT_HEADERS = [
  "MembershipNumber",
  "FirstName",
  "Surname",
  "CompanyName",
  "PhoneHome",
  "PhoneWork",
  "PhoneMobile",
  "Fax",
  "Email",
  "MembershipType",
  "MembershipStatus",
] as const

export type MemberExportHeader = (typeof MEMBER_EXPORT_HEADERS)[number]

export type MemberExportRow = Record<MemberExportHeader, string>

export function getMemberDisplayName(member: MemberWithRelations) {
  const firstName = member.user?.first_name ?? ""
  const lastName = member.user?.last_name ?? ""
  const email = member.user?.email ?? ""
  const name = [firstName, lastName].filter(Boolean).join(" ")

  return {
    firstName,
    lastName,
    email,
    name: name || email || "Unknown",
  }
}

export function getMembershipTypeLabel(member: MemberWithRelations) {
  return member.membership?.membership_type?.name?.trim() ?? ""
}

export function getMembershipStatusLabel(status: MembershipStatus) {
  if (status === "active") return "Active"
  if (status === "expired") return "Expired"
  return ""
}

export function buildMemberExportRows(members: MemberWithRelations[]): MemberExportRow[] {
  return members.map((member) => ({
    MembershipNumber: "",
    FirstName: member.user?.first_name?.trim() ?? "",
    Surname: member.user?.last_name?.trim() ?? "",
    CompanyName: member.user?.company_name?.trim() ?? "",
    PhoneHome: "",
    PhoneWork: "",
    PhoneMobile: member.user?.phone?.trim() ?? "",
    Fax: "",
    Email: member.user?.email?.trim() ?? "",
    MembershipType: getMembershipTypeLabel(member),
    MembershipStatus: getMembershipStatusLabel(member.membership_status),
  }))
}

function escapeCsvValue(value: string) {
  return `"${value.replaceAll("\"", "\"\"")}"`
}

export function buildMembersCsv(members: MemberWithRelations[]) {
  const rows = buildMemberExportRows(members)
  const headerLine = MEMBER_EXPORT_HEADERS.join(",")
  const dataLines = rows.map((row) =>
    MEMBER_EXPORT_HEADERS.map((header) => escapeCsvValue(row[header])).join(",")
  )

  return [headerLine, ...dataLines].join("\r\n")
}
