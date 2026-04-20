export interface FlyingActivityDashboard {
  total_flying_hours: number
  dual_hours: number
  solo_hours: number
  trial_flight_hours: number
  weekend_hours: number
  weekday_hours: number
  avg_flight_duration_hours: number
  converted_members: number | null
  hours_by_month: { month: string; hours: number }[]
  hours_by_flight_type: { flight_type: string; hours: number }[]
  hours_by_stage: { stage: string; hours: number }[]
  cancellations_by_category: { category: string; count: number }[] | null
  flying_days_per_month: { month: string; flying_days: number }[]
}

export interface InstructorSummary {
  instructor_id: string
  instructor_name: string
  employment_type: "full_time" | "part_time" | "casual" | "contractor" | null
  rating: string | null
  dual_hours: number
  solo_hours: number
  flights: number
  unique_students: number
  instruction_revenue: number
}

export interface InstructorStudentLoad {
  instructor_name: string
  employment_type: string | null
  student_count: number
  students: {
    student_id: string
    student_name: string
    syllabus: string
    enrolled_at: string
  }[]
}

export interface StaffDashboard {
  dual_hours_salary: number
  dual_hours_contractor: number
  instructors: InstructorSummary[]
  students_per_instructor: InstructorStudentLoad[]
}

export interface AircraftUtilisationRow {
  aircraft_id: string
  registration: string
  aircraft_type: string
  current_ttis: number
  hours_flown: number
  maintenance_days: number
  available_hours: number
  utilisation_pct: number
  hire_revenue: number
  flights: number
  open_observations: number
}

export interface AircraftMonthlyHours {
  month: string
  registration: string
  hours_flown: number
}

export interface AircraftUtilisationDashboard {
  period_days: number
  daily_available_hours: number
  aircraft: AircraftUtilisationRow[]
  monthly_by_aircraft: AircraftMonthlyHours[]
}

export interface HoursByFlightTypeRow {
  flight_type_id: string
  flight_type_name: string
  instruction_type: string
  flights: number
  total_hours: number
  dual_hours: number
  solo_hours: number
  pct_of_total: number
}
