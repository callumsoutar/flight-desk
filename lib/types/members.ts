import type {
  InstructorRow,
  MembershipRow,
  MembershipTypesRow,
  RoleRow,
  TenantUserRow,
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

export type MembersFilter = {
  person_type?: Exclude<PersonType, "all">
  membership_status?: MembershipStatus
  search?: string
  is_active?: boolean
  membership_type_id?: string
}
