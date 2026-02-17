import type {
  EndorsementsRow,
  InstructorRow,
  LicensesRow,
  MembershipRow,
  MembershipTypesRow,
  RoleRow,
  TenantUserRow,
  UserRow,
  UserDirectoryRow,
} from "@/lib/types"

export type PersonType = "all" | "member" | "instructor" | "staff" | "contact"
export type MembershipStatus = "active" | "expired" | "none"

export type DirectoryUserLite = Pick<
  UserDirectoryRow,
  "id" | "first_name" | "last_name" | "email"
>

export type MembershipWithType = Pick<MembershipRow, "id" | "is_active" | "expiry_date"> & {
  membership_type: Pick<MembershipTypesRow, "id" | "name"> | null
}

export type MemberWithRelations = Pick<
  TenantUserRow,
  "id" | "user_id" | "is_active" | "granted_at"
> & {
  user: DirectoryUserLite | null
  role: Pick<RoleRow, "id" | "name"> | null
  membership: MembershipWithType | null
  instructor: Pick<InstructorRow, "id" | "status" | "is_actively_instructing"> | null
  person_type: PersonType
  membership_status: MembershipStatus
}

export type MemberDetailWithRelations = Pick<
  TenantUserRow,
  "id" | "user_id" | "is_active" | "granted_at"
> & {
  user:
    | Pick<
        UserRow,
        | "id"
        | "first_name"
        | "last_name"
        | "email"
        | "phone"
        | "street_address"
        | "gender"
        | "date_of_birth"
        | "notes"
        | "next_of_kin_name"
        | "next_of_kin_phone"
        | "company_name"
        | "occupation"
        | "employer"
        | "pilot_license_number"
        | "pilot_license_type"
        | "pilot_license_id"
        | "pilot_license_expiry"
        | "medical_certificate_expiry"
      >
    | null
  role: Pick<RoleRow, "id" | "name"> | null
  membership:
    | (Pick<MembershipRow, "id" | "is_active" | "start_date" | "expiry_date"> & {
        membership_type: Pick<MembershipTypesRow, "id" | "name"> | null
      })
    | null
  instructor: Pick<InstructorRow, "id" | "status" | "is_actively_instructing"> | null
  is_auth_user: boolean
}

export type EndorsementLite = Pick<EndorsementsRow, "id" | "name" | "is_active" | "voided_at">
export type LicenseLite = Pick<LicensesRow, "id" | "name" | "is_active">

export type UserEndorsementWithRelation = {
  id: string
  issued_date: string
  expiry_date: string | null
  notes: string | null
  voided_at: string | null
  endorsement: EndorsementLite | null
}

export type MembersFilter = {
  person_type?: Exclude<PersonType, "all">
  membership_status?: MembershipStatus
  search?: string
  is_active?: boolean
  membership_type_id?: string
}
