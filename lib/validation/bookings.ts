import { z } from "zod"

export const bookingUpdateSchema = z.object({
  checked_out_aircraft_id: z.string().uuid().nullable().optional(),
  checked_out_instructor_id: z.string().uuid().nullable().optional(),
  flight_type_id: z.string().uuid().nullable().optional(),
  lesson_id: z.string().uuid().nullable().optional(),

  hobbs_start: z.number().nullable().optional(),
  hobbs_end: z.number().nullable().optional(),
  tach_start: z.number().nullable().optional(),
  tach_end: z.number().nullable().optional(),
  airswitch_start: z.number().nullable().optional(),
  airswitch_end: z.number().nullable().optional(),
  solo_end_hobbs: z.number().nullable().optional(),
  solo_end_tach: z.number().nullable().optional(),

  flight_time_hobbs: z.number().nullable().optional(),
  flight_time_tach: z.number().nullable().optional(),
  flight_time_airswitch: z.number().nullable().optional(),
  flight_time: z.number().nullable().optional(),

  billing_basis: z.string().nullable().optional(),
  billing_hours: z.number().nullable().optional(),
  dual_time: z.number().nullable().optional(),
  solo_time: z.number().nullable().optional(),
  total_hours_start: z.number().nullable().optional(),
  total_hours_end: z.number().nullable().optional(),

  remarks: z.string().nullable().optional(),
  fuel_on_board: z.number().nullable().optional(),
  passengers: z.string().nullable().optional(),
  route: z.string().nullable().optional(),
  flight_remarks: z.string().nullable().optional(),

  instructor_comments: z.string().nullable().optional(),
  focus_next_lesson: z.string().nullable().optional(),
  lesson_highlights: z.string().nullable().optional(),
  areas_for_improvement: z.string().nullable().optional(),
  airmanship: z.string().nullable().optional(),
  weather_conditions: z.string().nullable().optional(),
  safety_concerns: z.string().nullable().optional(),
  lesson_status: z.enum(["pass", "not yet competent"]).nullable().optional(),
})
