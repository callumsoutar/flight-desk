import type { Database } from "@/lib/types/database"

export type AircraftTechLogReadingSource = "hobbs" | "tacho"
export type AircraftTotalTimeMethod = Database["public"]["Enums"]["total_time_method"]

export type AircraftTechLogRow = {
  tech_log_date: string
  latest_reading: number | null
  daily_delta: number | null
  daily_ttis_delta: number | null
  computed_ttis: number | null
  reading_source: AircraftTechLogReadingSource
  total_time_method: AircraftTotalTimeMethod | null
  latest_entry_at: string | null
  entry_count: number
}

export type AircraftTechLogResponse = {
  rows: AircraftTechLogRow[]
  page: number
  pageSize: number
  totalRows: number
  totalPages: number
  timeZone: string
}
