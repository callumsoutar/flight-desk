import type {
  FlightTypesRow,
  InstructorCategoriesRow,
  InstructorFlightTypeRatesRow,
  InstructorRow,
  UserDirectoryRow,
  UserRow,
} from "@/lib/types"

type DirectoryUserLite = Pick<UserDirectoryRow, "id" | "first_name" | "last_name" | "email">

export type InstructorWithRelations = Pick<
  InstructorRow,
  | "id"
  | "user_id"
  | "first_name"
  | "last_name"
  | "status"
  | "is_actively_instructing"
  | "employment_type"
  | "hire_date"
  | "expires_at"
  | "rating"
> & {
  user: DirectoryUserLite | null
  instructor_category: Pick<InstructorCategoriesRow, "id" | "name"> | null
}

export type InstructorDetailWithRelations = Pick<
  InstructorRow,
  | "id"
  | "user_id"
  | "first_name"
  | "last_name"
  | "rating"
  | "status"
  | "is_actively_instructing"
  | "employment_type"
  | "hire_date"
  | "termination_date"
  | "approved_at"
  | "approved_by"
  | "expires_at"
  | "class_1_medical_due_date"
  | "instructor_check_due_date"
  | "instrument_check_due_date"
  | "night_removal"
  | "multi_removal"
  | "ifr_removal"
  | "aerobatics_removal"
  | "tawa_removal"
  | "notes"
  | "created_at"
  | "updated_at"
> & {
  user: Pick<
    UserRow,
    | "id"
    | "first_name"
    | "last_name"
    | "email"
    | "phone"
    | "street_address"
    | "date_of_birth"
    | "notes"
  > | null
  rating_category: Pick<InstructorCategoriesRow, "id" | "name" | "country" | "description"> | null
}

export type InstructorRateWithFlightType = Pick<
  InstructorFlightTypeRatesRow,
  "id" | "instructor_id" | "flight_type_id" | "rate" | "currency" | "effective_from"
> & {
  flight_type: Pick<FlightTypesRow, "id" | "name" | "instruction_type"> | null
}

export type InstructorCategoryLite = Pick<InstructorCategoriesRow, "id" | "name">

export type InstructorFlightTypeLite = Pick<FlightTypesRow, "id" | "name">
