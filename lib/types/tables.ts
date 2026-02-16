/**
 * Named types for each Supabase table — Row (select), Insert (create), Update (patch).
 * Import e.g. `import type { BookingRow, BookingInsert, AircraftRow } from '@/lib/types'`
 *
 * Generated from Database; regenerate this file if you add/rename tables
 * (or add new table names to the type map below).
 */

import type { Database } from "./database"

type Tables = Database["public"]["Tables"]

// Table name -> Row / Insert / Update
export type AircraftRow = Tables["aircraft"]["Row"]
export type AircraftInsert = Tables["aircraft"]["Insert"]
export type AircraftUpdate = Tables["aircraft"]["Update"]

export type AircraftChargeRatesRow = Tables["aircraft_charge_rates"]["Row"]
export type AircraftChargeRatesInsert = Tables["aircraft_charge_rates"]["Insert"]
export type AircraftChargeRatesUpdate = Tables["aircraft_charge_rates"]["Update"]

export type AircraftComponentsRow = Tables["aircraft_components"]["Row"]
export type AircraftComponentsInsert = Tables["aircraft_components"]["Insert"]
export type AircraftComponentsUpdate = Tables["aircraft_components"]["Update"]

export type AircraftTypesRow = Tables["aircraft_types"]["Row"]
export type AircraftTypesInsert = Tables["aircraft_types"]["Insert"]
export type AircraftTypesUpdate = Tables["aircraft_types"]["Update"]

export type AuditLogsRow = Tables["audit_logs"]["Row"]
export type AuditLogsInsert = Tables["audit_logs"]["Insert"]
export type AuditLogsUpdate = Tables["audit_logs"]["Update"]

export type BookingRow = Tables["bookings"]["Row"]
export type BookingInsert = Tables["bookings"]["Insert"]
export type BookingUpdate = Tables["bookings"]["Update"]

export type CancellationCategoriesRow = Tables["cancellation_categories"]["Row"]
export type CancellationCategoriesInsert = Tables["cancellation_categories"]["Insert"]
export type CancellationCategoriesUpdate = Tables["cancellation_categories"]["Update"]

export type ChargeableTypesRow = Tables["chargeable_types"]["Row"]
export type ChargeableTypesInsert = Tables["chargeable_types"]["Insert"]
export type ChargeableTypesUpdate = Tables["chargeable_types"]["Update"]

export type ChargeablesRow = Tables["chargeables"]["Row"]
export type ChargeablesInsert = Tables["chargeables"]["Insert"]
export type ChargeablesUpdate = Tables["chargeables"]["Update"]

export type EmailLogsRow = Tables["email_logs"]["Row"]
export type EmailLogsInsert = Tables["email_logs"]["Insert"]
export type EmailLogsUpdate = Tables["email_logs"]["Update"]

export type EndorsementsRow = Tables["endorsements"]["Row"]
export type EndorsementsInsert = Tables["endorsements"]["Insert"]
export type EndorsementsUpdate = Tables["endorsements"]["Update"]

export type EquipmentRow = Tables["equipment"]["Row"]
export type EquipmentInsert = Tables["equipment"]["Insert"]
export type EquipmentUpdate = Tables["equipment"]["Update"]

export type EquipmentIssuanceRow = Tables["equipment_issuance"]["Row"]
export type EquipmentIssuanceInsert = Tables["equipment_issuance"]["Insert"]
export type EquipmentIssuanceUpdate = Tables["equipment_issuance"]["Update"]

export type EquipmentUpdatesRow = Tables["equipment_updates"]["Row"]
export type EquipmentUpdatesInsert = Tables["equipment_updates"]["Insert"]
export type EquipmentUpdatesUpdate = Tables["equipment_updates"]["Update"]

export type ExamRow = Tables["exam"]["Row"]
export type ExamInsert = Tables["exam"]["Insert"]
export type ExamUpdate = Tables["exam"]["Update"]

export type ExamResultsRow = Tables["exam_results"]["Row"]
export type ExamResultsInsert = Tables["exam_results"]["Insert"]
export type ExamResultsUpdate = Tables["exam_results"]["Update"]

export type ExperienceTypesRow = Tables["experience_types"]["Row"]
export type ExperienceTypesInsert = Tables["experience_types"]["Insert"]
export type ExperienceTypesUpdate = Tables["experience_types"]["Update"]

export type FlightExperienceRow = Tables["flight_experience"]["Row"]
export type FlightExperienceInsert = Tables["flight_experience"]["Insert"]
export type FlightExperienceUpdate = Tables["flight_experience"]["Update"]

export type FlightTypesRow = Tables["flight_types"]["Row"]
export type FlightTypesInsert = Tables["flight_types"]["Insert"]
export type FlightTypesUpdate = Tables["flight_types"]["Update"]

export type InstructorCategoriesRow = Tables["instructor_categories"]["Row"]
export type InstructorCategoriesInsert = Tables["instructor_categories"]["Insert"]
export type InstructorCategoriesUpdate = Tables["instructor_categories"]["Update"]

export type InstructorFlightTypeRatesRow = Tables["instructor_flight_type_rates"]["Row"]
export type InstructorFlightTypeRatesInsert = Tables["instructor_flight_type_rates"]["Insert"]
export type InstructorFlightTypeRatesUpdate = Tables["instructor_flight_type_rates"]["Update"]

export type InstructorRow = Tables["instructors"]["Row"]
export type InstructorInsert = Tables["instructors"]["Insert"]
export type InstructorUpdate = Tables["instructors"]["Update"]

export type InvoiceItemsRow = Tables["invoice_items"]["Row"]
export type InvoiceItemsInsert = Tables["invoice_items"]["Insert"]
export type InvoiceItemsUpdate = Tables["invoice_items"]["Update"]

export type InvoicePaymentsRow = Tables["invoice_payments"]["Row"]
export type InvoicePaymentsInsert = Tables["invoice_payments"]["Insert"]
export type InvoicePaymentsUpdate = Tables["invoice_payments"]["Update"]

export type InvoiceSequencesRow = Tables["invoice_sequences"]["Row"]
export type InvoiceSequencesInsert = Tables["invoice_sequences"]["Insert"]
export type InvoiceSequencesUpdate = Tables["invoice_sequences"]["Update"]

export type InvoiceRow = Tables["invoices"]["Row"]
export type InvoiceInsert = Tables["invoices"]["Insert"]
export type InvoiceUpdate = Tables["invoices"]["Update"]

export type LandingFeeRatesRow = Tables["landing_fee_rates"]["Row"]
export type LandingFeeRatesInsert = Tables["landing_fee_rates"]["Insert"]
export type LandingFeeRatesUpdate = Tables["landing_fee_rates"]["Update"]

export type LessonProgressRow = Tables["lesson_progress"]["Row"]
export type LessonProgressInsert = Tables["lesson_progress"]["Insert"]
export type LessonProgressUpdate = Tables["lesson_progress"]["Update"]

export type LessonRow = Tables["lessons"]["Row"]
export type LessonInsert = Tables["lessons"]["Insert"]
export type LessonUpdate = Tables["lessons"]["Update"]

export type LicensesRow = Tables["licenses"]["Row"]
export type LicensesInsert = Tables["licenses"]["Insert"]
export type LicensesUpdate = Tables["licenses"]["Update"]

export type MaintenanceVisitsRow = Tables["maintenance_visits"]["Row"]
export type MaintenanceVisitsInsert = Tables["maintenance_visits"]["Insert"]
export type MaintenanceVisitsUpdate = Tables["maintenance_visits"]["Update"]

export type MembershipTypesRow = Tables["membership_types"]["Row"]
export type MembershipTypesInsert = Tables["membership_types"]["Insert"]
export type MembershipTypesUpdate = Tables["membership_types"]["Update"]

export type MembershipRow = Tables["memberships"]["Row"]
export type MembershipInsert = Tables["memberships"]["Insert"]
export type MembershipUpdate = Tables["memberships"]["Update"]

export type ObservationRow = Tables["observations"]["Row"]
export type ObservationInsert = Tables["observations"]["Insert"]
export type ObservationUpdate = Tables["observations"]["Update"]

export type RoleRow = Tables["roles"]["Row"]
export type RoleInsert = Tables["roles"]["Insert"]
export type RoleUpdate = Tables["roles"]["Update"]

export type RosterRuleRow = Tables["roster_rules"]["Row"]
export type RosterRuleInsert = Tables["roster_rules"]["Insert"]
export type RosterRuleUpdate = Tables["roster_rules"]["Update"]

export type ShiftOverrideRow = Tables["shift_overrides"]["Row"]
export type ShiftOverrideInsert = Tables["shift_overrides"]["Insert"]
export type ShiftOverrideUpdate = Tables["shift_overrides"]["Update"]

export type StudentSyllabusEnrollmentRow = Tables["student_syllabus_enrollment"]["Row"]
export type StudentSyllabusEnrollmentInsert = Tables["student_syllabus_enrollment"]["Insert"]
export type StudentSyllabusEnrollmentUpdate = Tables["student_syllabus_enrollment"]["Update"]

export type SyllabusRow = Tables["syllabus"]["Row"]
export type SyllabusInsert = Tables["syllabus"]["Insert"]
export type SyllabusUpdate = Tables["syllabus"]["Update"]

export type TaxRatesRow = Tables["tax_rates"]["Row"]
export type TaxRatesInsert = Tables["tax_rates"]["Insert"]
export type TaxRatesUpdate = Tables["tax_rates"]["Update"]

export type TenantSettingsRow = Tables["tenant_settings"]["Row"]
export type TenantSettingsInsert = Tables["tenant_settings"]["Insert"]
export type TenantSettingsUpdate = Tables["tenant_settings"]["Update"]

export type TenantUserRow = Tables["tenant_users"]["Row"]
export type TenantUserInsert = Tables["tenant_users"]["Insert"]
export type TenantUserUpdate = Tables["tenant_users"]["Update"]

export type TenantRow = Tables["tenants"]["Row"]
export type TenantInsert = Tables["tenants"]["Insert"]
export type TenantUpdate = Tables["tenants"]["Update"]

export type TransactionRow = Tables["transactions"]["Row"]
export type TransactionInsert = Tables["transactions"]["Insert"]
export type TransactionUpdate = Tables["transactions"]["Update"]

export type UserPermissionOverridesRow = Tables["user_permission_overrides"]["Row"]
export type UserPermissionOverridesInsert = Tables["user_permission_overrides"]["Insert"]
export type UserPermissionOverridesUpdate = Tables["user_permission_overrides"]["Update"]

export type UserRow = Tables["users"]["Row"]
export type UserInsert = Tables["users"]["Insert"]
export type UserUpdate = Tables["users"]["Update"]

export type UsersEndorsementsRow = Tables["users_endorsements"]["Row"]
export type UsersEndorsementsInsert = Tables["users_endorsements"]["Insert"]
export type UsersEndorsementsUpdate = Tables["users_endorsements"]["Update"]

// View (read-only) — user_directory is under Views, not Tables
export type UserDirectoryRow = Database["public"]["Views"]["user_directory"]["Row"]
