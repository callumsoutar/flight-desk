export type TaxRate = {
  id: string
  tenant_id: string
  tax_name: string
  rate: number
  country_code: string
  region_code: string | null
  is_default: boolean
  is_active: boolean
  effective_from: string
  description: string | null
  created_at: string
  updated_at: string
}
