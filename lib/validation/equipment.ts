import { z } from "zod"

export const equipmentTypeValues = [
  "AIP",
  "Stationery",
  "Headset",
  "Technology",
  "Maps",
  "Radio",
  "Transponder",
  "ELT",
  "Lifejacket",
  "FirstAidKit",
  "FireExtinguisher",
  "Other",
] as const

export const equipmentStatusValues = ["active", "maintenance", "lost", "retired"] as const

export const equipmentCreateSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(255, "Name is too long"),
  label: z.string().trim().max(255, "Label is too long").optional(),
  type: z.enum(equipmentTypeValues),
  status: z.enum(equipmentStatusValues).default("active"),
  serial_number: z.string().trim().max(255, "Serial number is too long").optional(),
  location: z.string().trim().max(255, "Location is too long").optional(),
  notes: z.string().trim().optional(),
  year_purchased: z
    .number()
    .int()
    .min(1900, "Year must be 1900 or later")
    .max(2100, "Year must be 2100 or earlier")
    .optional(),
})

export type EquipmentCreateInput = z.infer<typeof equipmentCreateSchema>
