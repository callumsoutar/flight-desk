export type TrainingTheoryStatus = "passed" | "not_passed" | "not_attempted"

export type TrainingTheoryRow = {
  exam_id: string
  exam_name: string
  passing_score: number
  attempts: number
  status: TrainingTheoryStatus
  score: number | null
  exam_date: string | null
  best_score: number | null
}

export type TrainingTheoryResponse = {
  rows: TrainingTheoryRow[]
}

