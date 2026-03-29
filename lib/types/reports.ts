export interface FlyingActivityDashboard {
  total_flying_hours: number
  dual_hours: number
  solo_hours: number
  trial_flight_hours: number
  weekend_hours: number
  weekday_hours: number
  avg_flight_duration_hours: number
  conversion_rate: number | null
  hours_by_month: { month: string; hours: number }[]
  hours_by_flight_type: { flight_type: string; hours: number }[]
  hours_by_stage: { stage: string; hours: number }[]
  cancellations_by_category: { category: string; count: number }[] | null
  flying_days_per_month: { month: string; flying_days: number }[]
}
