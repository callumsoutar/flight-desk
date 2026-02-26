/**
 * Supabase database types — auto-generated from project schema.
 * Regenerate when the schema changes:
 *   npx supabase gen types typescript --project-id fergmobsjyucucxeumvb > lib/types/database.ts
 * Or use the Supabase MCP: generate_typescript_types for project fergmobsjyucucxeumvb
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      aircraft: {
        Row: {
          aircraft_image_url: string | null
          aircraft_type_id: string | null
          capacity: number | null
          created_at: string
          current_hobbs: number
          current_tach: number
          for_ato: boolean
          fuel_consumption: number | null
          id: string
          initial_total_time_in_service: number
          manufacturer: string | null
          model: string | null
          notes: string | null
          on_line: boolean
          order: number
          prioritise_scheduling: boolean
          record_airswitch: boolean
          record_hobbs: boolean
          record_tacho: boolean
          registration: string
          status: string | null
          tenant_id: string
          total_time_in_service: number
          total_time_method:
            | Database["public"]["Enums"]["total_time_method"]
            | null
          type: string
          updated_at: string
          year_manufactured: number | null
        }
        Insert: {
          aircraft_image_url?: string | null
          aircraft_type_id?: string | null
          capacity?: number | null
          created_at?: string
          current_hobbs?: number
          current_tach?: number
          for_ato?: boolean
          fuel_consumption?: number | null
          id?: string
          initial_total_time_in_service?: number
          manufacturer?: string | null
          model?: string | null
          notes?: string | null
          on_line?: boolean
          order?: number
          prioritise_scheduling?: boolean
          record_airswitch?: boolean
          record_hobbs?: boolean
          record_tacho?: boolean
          registration: string
          status?: string | null
          tenant_id?: string
          total_time_in_service?: number
          total_time_method?:
            | Database["public"]["Enums"]["total_time_method"]
            | null
          type: string
          updated_at?: string
          year_manufactured?: number | null
        }
        Update: {
          aircraft_image_url?: string | null
          aircraft_type_id?: string | null
          capacity?: number | null
          created_at?: string
          current_hobbs?: number
          current_tach?: number
          for_ato?: boolean
          fuel_consumption?: number | null
          id?: string
          initial_total_time_in_service?: number
          manufacturer?: string | null
          model?: string | null
          notes?: string | null
          on_line?: boolean
          order?: number
          prioritise_scheduling?: boolean
          record_airswitch?: boolean
          record_hobbs?: boolean
          record_tacho?: boolean
          registration?: string
          status?: string | null
          tenant_id?: string
          total_time_in_service?: number
          total_time_method?:
            | Database["public"]["Enums"]["total_time_method"]
            | null
          type?: string
          updated_at?: string
          year_manufactured?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "aircraft_aircraft_type_id_fkey"
            columns: ["aircraft_type_id"]
            isOneToOne: false
            referencedRelation: "aircraft_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aircraft_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      aircraft_charge_rates: {
        Row: {
          aircraft_id: string
          charge_airswitch: boolean
          charge_hobbs: boolean
          charge_tacho: boolean
          created_at: string
          flight_type_id: string
          id: string
          rate_per_hour: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          aircraft_id: string
          charge_airswitch?: boolean
          charge_hobbs?: boolean
          charge_tacho?: boolean
          created_at?: string
          flight_type_id: string
          id?: string
          rate_per_hour: number
          tenant_id?: string
          updated_at?: string
        }
        Update: {
          aircraft_id?: string
          charge_airswitch?: boolean
          charge_hobbs?: boolean
          charge_tacho?: boolean
          created_at?: string
          flight_type_id?: string
          id?: string
          rate_per_hour?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "aircraft_charge_rates_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "aircraft"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aircraft_charge_rates_flight_type_id_fkey"
            columns: ["flight_type_id"]
            isOneToOne: false
            referencedRelation: "flight_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aircraft_charge_rates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      aircraft_components: {
        Row: {
          aircraft_id: string
          component_type: Database["public"]["Enums"]["component_type_enum"]
          created_at: string
          current_due_date: string | null
          current_due_hours: number | null
          description: string | null
          extension_limit_hours: number | null
          id: string
          interval_days: number | null
          interval_hours: number | null
          interval_type: Database["public"]["Enums"]["interval_type_enum"]
          last_completed_date: string | null
          last_completed_hours: number | null
          name: string
          notes: string | null
          priority: string | null
          status: Database["public"]["Enums"]["component_status_enum"]
          tenant_id: string
          updated_at: string
          voided_at: string | null
        }
        Insert: {
          aircraft_id: string
          component_type: Database["public"]["Enums"]["component_type_enum"]
          created_at?: string
          current_due_date?: string | null
          current_due_hours?: number | null
          description?: string | null
          extension_limit_hours?: number | null
          id?: string
          interval_days?: number | null
          interval_hours?: number | null
          interval_type?: Database["public"]["Enums"]["interval_type_enum"]
          last_completed_date?: string | null
          last_completed_hours?: number | null
          name: string
          notes?: string | null
          priority?: string | null
          status?: Database["public"]["Enums"]["component_status_enum"]
          tenant_id?: string
          updated_at?: string
          voided_at?: string | null
        }
        Update: {
          aircraft_id?: string
          component_type?: Database["public"]["Enums"]["component_type_enum"]
          created_at?: string
          current_due_date?: string | null
          current_due_hours?: number | null
          description?: string | null
          extension_limit_hours?: number | null
          id?: string
          interval_days?: number | null
          interval_hours?: number | null
          interval_type?: Database["public"]["Enums"]["interval_type_enum"]
          last_completed_date?: string | null
          last_completed_hours?: number | null
          name?: string
          notes?: string | null
          priority?: string | null
          status?: Database["public"]["Enums"]["component_status_enum"]
          tenant_id?: string
          updated_at?: string
          voided_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "aircraft_components_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "aircraft"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aircraft_components_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      aircraft_types: {
        Row: {
          category: string | null
          created_at: string | null
          description: string | null
          id: string
          name: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          tenant_id?: string
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "aircraft_types_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          column_changes: Json | null
          created_at: string
          id: string
          new_data: Json | null
          old_data: Json | null
          record_id: string
          table_name: string
          tenant_id: string
          user_id: string | null
        }
        Insert: {
          action: string
          column_changes?: Json | null
          created_at?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id: string
          table_name: string
          tenant_id?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          column_changes?: Json | null
          created_at?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string
          table_name?: string
          tenant_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          aircraft_id: string | null
          actual_end: string | null
          actual_start: string | null
          airswitch_end: number | null
          airswitch_start: number | null
          applied_aircraft_delta: number | null
          applied_total_time_method: string | null
          authorization_completed: boolean | null
          billing_basis: string | null
          billing_hours: number | null
          booking_type: Database["public"]["Enums"]["booking_type"]
          briefing_completed: boolean | null
          cancellation_category_id: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          cancelled_notes: string | null
          checked_in_at: string | null
          checked_in_by: string | null
          checked_out_aircraft_id: string | null
          checked_out_at: string | null
          checked_out_instructor_id: string | null
          checkin_approved_at: string | null
          checkin_approved_by: string | null
          checkin_invoice_id: string | null
          corrected_at: string | null
          corrected_by: string | null
          correction_delta: number | null
          correction_reason: string | null
          created_at: string
          dual_time: number | null
          end_time: string
          equipment: Json | null
          eta: string | null
          flight_remarks: string | null
          flight_time: number | null
          flight_time_airswitch: number | null
          flight_time_hobbs: number | null
          flight_time_tach: number | null
          flight_type_id: string | null
          fuel_on_board: number | null
          hobbs_end: number | null
          hobbs_start: number | null
          id: string
          instructor_id: string | null
          lesson_id: string | null
          notes: string | null
          passengers: string | null
          purpose: string
          remarks: string | null
          route: string | null
          solo_end_hobbs: number | null
          solo_end_tach: number | null
          solo_time: number | null
          start_time: string
          status: Database["public"]["Enums"]["booking_status"]
          tach_end: number | null
          tach_start: number | null
          tenant_id: string
          total_hours_end: number | null
          total_hours_start: number | null
          updated_at: string
          user_id: string | null
          voucher_number: string | null
        }
        Insert: {
          actual_end?: string | null
          actual_start?: string | null
          aircraft_id?: string | null
          airswitch_end?: number | null
          airswitch_start?: number | null
          applied_aircraft_delta?: number | null
          applied_total_time_method?: string | null
          authorization_completed?: boolean | null
          billing_basis?: string | null
          billing_hours?: number | null
          booking_type?: Database["public"]["Enums"]["booking_type"]
          briefing_completed?: boolean | null
          cancellation_category_id?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          cancelled_notes?: string | null
          checked_in_at?: string | null
          checked_in_by?: string | null
          checked_out_aircraft_id?: string | null
          checked_out_at?: string | null
          checked_out_instructor_id?: string | null
          checkin_approved_at?: string | null
          checkin_approved_by?: string | null
          checkin_invoice_id?: string | null
          corrected_at?: string | null
          corrected_by?: string | null
          correction_delta?: number | null
          correction_reason?: string | null
          created_at?: string
          dual_time?: number | null
          end_time: string
          equipment?: Json | null
          eta?: string | null
          flight_remarks?: string | null
          flight_time?: number | null
          flight_time_airswitch?: number | null
          flight_time_hobbs?: number | null
          flight_time_tach?: number | null
          flight_type_id?: string | null
          fuel_on_board?: number | null
          hobbs_end?: number | null
          hobbs_start?: number | null
          id?: string
          instructor_id?: string | null
          lesson_id?: string | null
          notes?: string | null
          passengers?: string | null
          purpose?: string
          remarks?: string | null
          route?: string | null
          solo_end_hobbs?: number | null
          solo_end_tach?: number | null
          solo_time?: number | null
          start_time: string
          status?: Database["public"]["Enums"]["booking_status"]
          tach_end?: number | null
          tach_start?: number | null
          tenant_id?: string
          total_hours_end?: number | null
          total_hours_start?: number | null
          updated_at?: string
          user_id?: string | null
          voucher_number?: string | null
        }
        Update: {
          actual_end?: string | null
          actual_start?: string | null
          aircraft_id?: string | null
          airswitch_end?: number | null
          airswitch_start?: number | null
          applied_aircraft_delta?: number | null
          applied_total_time_method?: string | null
          authorization_completed?: boolean | null
          billing_basis?: string | null
          billing_hours?: number | null
          booking_type?: Database["public"]["Enums"]["booking_type"]
          briefing_completed?: boolean | null
          cancellation_category_id?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          cancelled_notes?: string | null
          checked_in_at?: string | null
          checked_in_by?: string | null
          checked_out_aircraft_id?: string | null
          checked_out_at?: string | null
          checked_out_instructor_id?: string | null
          checkin_approved_at?: string | null
          checkin_approved_by?: string | null
          checkin_invoice_id?: string | null
          corrected_at?: string | null
          corrected_by?: string | null
          correction_delta?: number | null
          correction_reason?: string | null
          created_at?: string
          dual_time?: number | null
          end_time?: string
          equipment?: Json | null
          eta?: string | null
          flight_remarks?: string | null
          flight_time?: number | null
          flight_time_airswitch?: number | null
          flight_time_hobbs?: number | null
          flight_time_tach?: number | null
          flight_type_id?: string | null
          fuel_on_board?: number | null
          hobbs_end?: number | null
          hobbs_start?: number | null
          id?: string
          instructor_id?: string | null
          lesson_id?: string | null
          notes?: string | null
          passengers?: string | null
          purpose?: string
          remarks?: string | null
          route?: string | null
          solo_end_hobbs?: number | null
          solo_end_tach?: number | null
          solo_time?: number | null
          start_time?: string
          status?: Database["public"]["Enums"]["booking_status"]
          tach_end?: number | null
          tach_start?: number | null
          tenant_id?: string
          total_hours_end?: number | null
          total_hours_start?: number | null
          updated_at?: string
          user_id?: string | null
          voucher_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "aircraft"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_cancellation_category_id_fkey"
            columns: ["cancellation_category_id"]
            isOneToOne: false
            referencedRelation: "cancellation_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "user_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_checked_out_aircraft_id_fkey"
            columns: ["checked_out_aircraft_id"]
            isOneToOne: false
            referencedRelation: "aircraft"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_checked_out_instructor_id_fkey"
            columns: ["checked_out_instructor_id"]
            isOneToOne: false
            referencedRelation: "instructors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_checkin_invoice_id_fkey"
            columns: ["checkin_invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_flight_type_id_fkey"
            columns: ["flight_type_id"]
            isOneToOne: false
            referencedRelation: "flight_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "instructors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      cancellation_categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_global: boolean
          name: string
          tenant_id: string | null
          updated_at: string
          voided_at: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_global?: boolean
          name: string
          tenant_id?: string | null
          updated_at?: string
          voided_at?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_global?: boolean
          name?: string
          tenant_id?: string | null
          updated_at?: string
          voided_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cancellation_categories_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      chargeable_types: {
        Row: {
          code: string
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          is_global: boolean
          is_system: boolean | null
          name: string
          tenant_id: string | null
          updated_at: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_global?: boolean
          is_system?: boolean | null
          name: string
          tenant_id?: string | null
          updated_at?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_global?: boolean
          is_system?: boolean | null
          name?: string
          tenant_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chargeable_types_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      chargeables: {
        Row: {
          chargeable_type_id: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_taxable: boolean | null
          name: string
          rate: number | null
          tenant_id: string
          updated_at: string
          voided_at: string | null
        }
        Insert: {
          chargeable_type_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_taxable?: boolean | null
          name: string
          rate?: number | null
          tenant_id?: string
          updated_at?: string
          voided_at?: string | null
        }
        Update: {
          chargeable_type_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_taxable?: boolean | null
          name?: string
          rate?: number | null
          tenant_id?: string
          updated_at?: string
          voided_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chargeables_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_chargeable_type"
            columns: ["chargeable_type_id"]
            isOneToOne: false
            referencedRelation: "chargeable_types"
            referencedColumns: ["id"]
          },
        ]
      }
      email_logs: {
        Row: {
          booking_id: string | null
          created_at: string | null
          email_type: string
          error_message: string | null
          id: string
          message_id: string | null
          recipient_email: string
          sent_at: string | null
          status: string
          subject: string
          tenant_id: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          booking_id?: string | null
          created_at?: string | null
          email_type: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          recipient_email: string
          sent_at?: string | null
          status?: string
          subject: string
          tenant_id?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          booking_id?: string | null
          created_at?: string | null
          email_type?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          recipient_email?: string
          sent_at?: string | null
          status?: string
          subject?: string
          tenant_id?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_logs_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      endorsements: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
          voided_at: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
          voided_at?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
          voided_at?: string | null
        }
        Relationships: []
      }
      equipment: {
        Row: {
          created_at: string
          id: string
          label: string | null
          location: string | null
          name: string
          notes: string | null
          purchase_date: string | null
          serial_number: string | null
          status: Database["public"]["Enums"]["equipment_status"]
          tenant_id: string
          type: Database["public"]["Enums"]["equipment_type"]
          updated_at: string
          voided_at: string | null
          warranty_expiry: string | null
          year_purchased: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          label?: string | null
          location?: string | null
          name: string
          notes?: string | null
          purchase_date?: string | null
          serial_number?: string | null
          status?: Database["public"]["Enums"]["equipment_status"]
          tenant_id?: string
          type: Database["public"]["Enums"]["equipment_type"]
          updated_at?: string
          voided_at?: string | null
          warranty_expiry?: string | null
          year_purchased?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          label?: string | null
          location?: string | null
          name?: string
          notes?: string | null
          purchase_date?: string | null
          serial_number?: string | null
          status?: Database["public"]["Enums"]["equipment_status"]
          tenant_id?: string
          type?: Database["public"]["Enums"]["equipment_type"]
          updated_at?: string
          voided_at?: string | null
          warranty_expiry?: string | null
          year_purchased?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "equipment_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_issuance: {
        Row: {
          created_at: string
          equipment_id: string
          expected_return: string | null
          id: string
          issued_at: string
          issued_by: string
          notes: string | null
          returned_at: string | null
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          equipment_id: string
          expected_return?: string | null
          id?: string
          issued_at?: string
          issued_by: string
          notes?: string | null
          returned_at?: string | null
          tenant_id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          equipment_id?: string
          expected_return?: string | null
          id?: string
          issued_at?: string
          issued_by?: string
          notes?: string | null
          returned_at?: string | null
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipment_issuance_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_issuance_issued_by_fkey"
            columns: ["issued_by"]
            isOneToOne: false
            referencedRelation: "user_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_issuance_issued_by_fkey"
            columns: ["issued_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_issuance_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_issuance_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_issuance_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_updates: {
        Row: {
          created_at: string
          equipment_id: string
          id: string
          next_due_at: string | null
          notes: string | null
          tenant_id: string
          updated_at: string
          updated_by: string
        }
        Insert: {
          created_at?: string
          equipment_id: string
          id?: string
          next_due_at?: string | null
          notes?: string | null
          tenant_id?: string
          updated_at?: string
          updated_by: string
        }
        Update: {
          created_at?: string
          equipment_id?: string
          id?: string
          next_due_at?: string | null
          notes?: string | null
          tenant_id?: string
          updated_at?: string
          updated_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipment_updates_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_updates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_updates_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "user_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_updates_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      exam: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          passing_score: number
          syllabus_id: string | null
          tenant_id: string
          updated_at: string
          voided_at: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          passing_score: number
          syllabus_id?: string | null
          tenant_id?: string
          updated_at?: string
          voided_at?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          passing_score?: number
          syllabus_id?: string | null
          tenant_id?: string
          updated_at?: string
          voided_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exam_syllabus_id_fkey"
            columns: ["syllabus_id"]
            isOneToOne: false
            referencedRelation: "syllabus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_results: {
        Row: {
          created_at: string
          exam_date: string
          exam_id: string
          id: string
          notes: string | null
          result: Database["public"]["Enums"]["exam_result"]
          score: number
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          exam_date?: string
          exam_id: string
          id?: string
          notes?: string | null
          result: Database["public"]["Enums"]["exam_result"]
          score: number
          tenant_id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          exam_date?: string
          exam_id?: string
          id?: string
          notes?: string | null
          result?: Database["public"]["Enums"]["exam_result"]
          score?: number
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_results_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exam"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_results_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_results_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_results_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      experience_types: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          tenant_id: string
          updated_at: string | null
          voided_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          tenant_id?: string
          updated_at?: string | null
          voided_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          tenant_id?: string
          updated_at?: string | null
          voided_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "experience_types_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      flight_experience: {
        Row: {
          booking_id: string | null
          conditions: string | null
          created_at: string | null
          created_by: string | null
          experience_type_id: string
          id: string
          instructor_id: string | null
          lesson_progress_id: string | null
          notes: string | null
          occurred_at: string
          tenant_id: string
          unit: Database["public"]["Enums"]["experience_unit"]
          updated_at: string | null
          user_id: string
          value: number
        }
        Insert: {
          booking_id?: string | null
          conditions?: string | null
          created_at?: string | null
          created_by?: string | null
          experience_type_id: string
          id?: string
          instructor_id?: string | null
          lesson_progress_id?: string | null
          notes?: string | null
          occurred_at: string
          tenant_id?: string
          unit?: Database["public"]["Enums"]["experience_unit"]
          updated_at?: string | null
          user_id: string
          value: number
        }
        Update: {
          booking_id?: string | null
          conditions?: string | null
          created_at?: string | null
          created_by?: string | null
          experience_type_id?: string
          id?: string
          instructor_id?: string | null
          lesson_progress_id?: string | null
          notes?: string | null
          occurred_at?: string
          tenant_id?: string
          unit?: Database["public"]["Enums"]["experience_unit"]
          updated_at?: string | null
          user_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "flight_experience_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flight_experience_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flight_experience_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flight_experience_experience_type_id_fkey"
            columns: ["experience_type_id"]
            isOneToOne: false
            referencedRelation: "experience_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flight_experience_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "instructors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flight_experience_lesson_progress_id_fkey"
            columns: ["lesson_progress_id"]
            isOneToOne: false
            referencedRelation: "lesson_progress"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flight_experience_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flight_experience_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flight_experience_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      flight_types: {
        Row: {
          created_at: string
          description: string | null
          id: string
          instruction_type: Database["public"]["Enums"]["instruction_type_enum"]
          is_active: boolean
          is_default_solo: boolean | null
          name: string
          tenant_id: string
          updated_at: string
          voided_at: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          instruction_type?: Database["public"]["Enums"]["instruction_type_enum"]
          is_active?: boolean
          is_default_solo?: boolean | null
          name: string
          tenant_id?: string
          updated_at?: string
          voided_at?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          instruction_type?: Database["public"]["Enums"]["instruction_type_enum"]
          is_active?: boolean
          is_default_solo?: boolean | null
          name?: string
          tenant_id?: string
          updated_at?: string
          voided_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "flight_types_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      instructor_categories: {
        Row: {
          country: string
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          country: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          country?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      instructor_flight_type_rates: {
        Row: {
          created_at: string
          currency: string
          effective_from: string
          flight_type_id: string
          id: string
          instructor_id: string
          rate: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          effective_from?: string
          flight_type_id: string
          id?: string
          instructor_id: string
          rate: number
          tenant_id?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          effective_from?: string
          flight_type_id?: string
          id?: string
          instructor_id?: string
          rate?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "instructor_flight_type_rates_flight_type_id_fkey"
            columns: ["flight_type_id"]
            isOneToOne: false
            referencedRelation: "flight_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instructor_flight_type_rates_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "instructors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instructor_flight_type_rates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      instructors: {
        Row: {
          aerobatics_removal: boolean | null
          approved_at: string | null
          approved_by: string | null
          class_1_medical_due_date: string | null
          created_at: string
          employment_type: Database["public"]["Enums"]["employment_type"] | null
          expires_at: string | null
          first_name: string | null
          hire_date: string | null
          id: string
          ifr_removal: boolean | null
          instructor_check_due_date: string | null
          instrument_check_due_date: string | null
          is_actively_instructing: boolean
          last_name: string | null
          multi_removal: boolean | null
          night_removal: boolean | null
          notes: string | null
          rating: string | null
          status: Database["public"]["Enums"]["instructor_status"]
          tawa_removal: boolean | null
          tenant_id: string
          termination_date: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          aerobatics_removal?: boolean | null
          approved_at?: string | null
          approved_by?: string | null
          class_1_medical_due_date?: string | null
          created_at?: string
          employment_type?:
            | Database["public"]["Enums"]["employment_type"]
            | null
          expires_at?: string | null
          first_name?: string | null
          hire_date?: string | null
          id?: string
          ifr_removal?: boolean | null
          instructor_check_due_date?: string | null
          instrument_check_due_date?: string | null
          is_actively_instructing?: boolean
          last_name?: string | null
          multi_removal?: boolean | null
          night_removal?: boolean | null
          notes?: string | null
          rating?: string | null
          status?: Database["public"]["Enums"]["instructor_status"]
          tawa_removal?: boolean | null
          tenant_id?: string
          termination_date?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          aerobatics_removal?: boolean | null
          approved_at?: string | null
          approved_by?: string | null
          class_1_medical_due_date?: string | null
          created_at?: string
          employment_type?:
            | Database["public"]["Enums"]["employment_type"]
            | null
          expires_at?: string | null
          first_name?: string | null
          hire_date?: string | null
          id?: string
          ifr_removal?: boolean | null
          instructor_check_due_date?: string | null
          instrument_check_due_date?: string | null
          is_actively_instructing?: boolean
          last_name?: string | null
          multi_removal?: boolean | null
          night_removal?: boolean | null
          notes?: string | null
          rating?: string | null
          status?: Database["public"]["Enums"]["instructor_status"]
          tawa_removal?: boolean | null
          tenant_id?: string
          termination_date?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "instructors_rating_fkey"
            columns: ["rating"]
            isOneToOne: false
            referencedRelation: "instructor_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instructors_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instructors_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "user_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instructors_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          amount: number
          chargeable_id: string | null
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          description: string
          id: string
          invoice_id: string
          line_total: number | null
          notes: string | null
          quantity: number
          rate_inclusive: number | null
          tax_amount: number | null
          tax_rate: number | null
          tenant_id: string
          unit_price: number
          updated_at: string
        }
        Insert: {
          amount?: number
          chargeable_id?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          description: string
          id?: string
          invoice_id: string
          line_total?: number | null
          notes?: string | null
          quantity?: number
          rate_inclusive?: number | null
          tax_amount?: number | null
          tax_rate?: number | null
          tenant_id?: string
          unit_price: number
          updated_at?: string
        }
        Update: {
          amount?: number
          chargeable_id?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string
          id?: string
          invoice_id?: string
          line_total?: number | null
          notes?: string | null
          quantity?: number
          rate_inclusive?: number | null
          tax_amount?: number | null
          tax_rate?: number | null
          tenant_id?: string
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_chargeable_id_fkey"
            columns: ["chargeable_id"]
            isOneToOne: false
            referencedRelation: "chargeables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "user_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_payments: {
        Row: {
          amount: number
          created_at: string
          created_by: string
          id: string
          invoice_id: string
          notes: string | null
          paid_at: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          payment_reference: string | null
          tenant_id: string
          transaction_id: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by: string
          id?: string
          invoice_id: string
          notes?: string | null
          paid_at?: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          payment_reference?: string | null
          tenant_id?: string
          transaction_id: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string
          id?: string
          invoice_id?: string
          notes?: string | null
          paid_at?: string
          payment_method?: Database["public"]["Enums"]["payment_method"]
          payment_reference?: string | null
          tenant_id?: string
          transaction_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_payments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_payments_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_sequences: {
        Row: {
          created_at: string
          id: string
          last_sequence: number
          tenant_id: string
          updated_at: string
          year_month: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_sequence?: number
          tenant_id?: string
          updated_at?: string
          year_month: string
        }
        Update: {
          created_at?: string
          id?: string
          last_sequence?: number
          tenant_id?: string
          updated_at?: string
          year_month?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_sequences_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          balance_due: number | null
          booking_id: string | null
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          deletion_reason: string | null
          due_date: string | null
          id: string
          invoice_number: string | null
          issue_date: string
          notes: string | null
          paid_date: string | null
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          payment_reference: string | null
          reference: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          subtotal: number | null
          tax_rate: number
          tax_total: number | null
          tenant_id: string
          total_amount: number | null
          total_paid: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          balance_due?: number | null
          booking_id?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          deletion_reason?: string | null
          due_date?: string | null
          id?: string
          invoice_number?: string | null
          issue_date?: string
          notes?: string | null
          paid_date?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          payment_reference?: string | null
          reference?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number | null
          tax_rate?: number
          tax_total?: number | null
          tenant_id?: string
          total_amount?: number | null
          total_paid?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          balance_due?: number | null
          booking_id?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          deletion_reason?: string | null
          due_date?: string | null
          id?: string
          invoice_number?: string | null
          issue_date?: string
          notes?: string | null
          paid_date?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          payment_reference?: string | null
          reference?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number | null
          tax_rate?: number
          tax_total?: number | null
          tenant_id?: string
          total_amount?: number | null
          total_paid?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "user_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      landing_fee_rates: {
        Row: {
          aircraft_type_id: string
          chargeable_id: string
          created_at: string | null
          id: string
          rate: number
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          aircraft_type_id: string
          chargeable_id: string
          created_at?: string | null
          id?: string
          rate: number
          tenant_id?: string
          updated_at?: string | null
        }
        Update: {
          aircraft_type_id?: string
          chargeable_id?: string
          created_at?: string | null
          id?: string
          rate?: number
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "landing_fee_rates_aircraft_type_id_fkey"
            columns: ["aircraft_type_id"]
            isOneToOne: false
            referencedRelation: "aircraft_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "landing_fee_rates_chargeable_id_fkey"
            columns: ["chargeable_id"]
            isOneToOne: false
            referencedRelation: "chargeables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "landing_fee_rates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_progress: {
        Row: {
          airmanship: string | null
          areas_for_improvement: string | null
          attempt: number
          booking_id: string | null
          completed_at: string | null
          created_at: string
          date: string
          focus_next_lesson: string | null
          id: string
          instructor_comments: string | null
          instructor_id: string | null
          lesson_highlights: string | null
          lesson_id: string | null
          safety_concerns: string | null
          status: Database["public"]["Enums"]["lesson_outcome"]
          syllabus_id: string | null
          tenant_id: string
          updated_at: string
          user_id: string
          weather_conditions: string | null
        }
        Insert: {
          airmanship?: string | null
          areas_for_improvement?: string | null
          attempt?: number
          booking_id?: string | null
          completed_at?: string | null
          created_at?: string
          date?: string
          focus_next_lesson?: string | null
          id?: string
          instructor_comments?: string | null
          instructor_id?: string | null
          lesson_highlights?: string | null
          lesson_id?: string | null
          safety_concerns?: string | null
          status?: Database["public"]["Enums"]["lesson_outcome"]
          syllabus_id?: string | null
          tenant_id?: string
          updated_at?: string
          user_id: string
          weather_conditions?: string | null
        }
        Update: {
          airmanship?: string | null
          areas_for_improvement?: string | null
          attempt?: number
          booking_id?: string | null
          completed_at?: string | null
          created_at?: string
          date?: string
          focus_next_lesson?: string | null
          id?: string
          instructor_comments?: string | null
          instructor_id?: string | null
          lesson_highlights?: string | null
          lesson_id?: string | null
          safety_concerns?: string | null
          status?: Database["public"]["Enums"]["lesson_outcome"]
          syllabus_id?: string | null
          tenant_id?: string
          updated_at?: string
          user_id?: string
          weather_conditions?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lesson_progress_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_progress_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "instructors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_progress_syllabus_id_fkey"
            columns: ["syllabus_id"]
            isOneToOne: false
            referencedRelation: "syllabus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_progress_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_required: boolean | null
          name: string
          order: number
          syllabus_id: string
          syllabus_stage: Database["public"]["Enums"]["syllabus_stage"] | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_required?: boolean | null
          name: string
          order: number
          syllabus_id: string
          syllabus_stage?: Database["public"]["Enums"]["syllabus_stage"] | null
          tenant_id?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_required?: boolean | null
          name?: string
          order?: number
          syllabus_id?: string
          syllabus_stage?: Database["public"]["Enums"]["syllabus_stage"] | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lessons_syllabus_id_fkey"
            columns: ["syllabus_id"]
            isOneToOne: false
            referencedRelation: "syllabus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      licenses: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      maintenance_visits: {
        Row: {
          aircraft_id: string
          booking_id: string | null
          component_due_date: string | null
          component_due_hours: number | null
          component_id: string | null
          created_at: string
          date_out_of_maintenance: string | null
          description: string
          hours_after: number | null
          hours_at_visit: number | null
          hours_before: number | null
          id: string
          next_due_date: string | null
          next_due_hours: number | null
          notes: string | null
          performed_by: string | null
          scheduled_by: string | null
          scheduled_end: string | null
          scheduled_for: string | null
          technician_name: string | null
          tenant_id: string
          total_cost: number | null
          updated_at: string
          visit_date: string
          visit_type: string
        }
        Insert: {
          aircraft_id: string
          booking_id?: string | null
          component_due_date?: string | null
          component_due_hours?: number | null
          component_id?: string | null
          created_at?: string
          date_out_of_maintenance?: string | null
          description: string
          hours_after?: number | null
          hours_at_visit?: number | null
          hours_before?: number | null
          id?: string
          next_due_date?: string | null
          next_due_hours?: number | null
          notes?: string | null
          performed_by?: string | null
          scheduled_by?: string | null
          scheduled_end?: string | null
          scheduled_for?: string | null
          technician_name?: string | null
          tenant_id?: string
          total_cost?: number | null
          updated_at?: string
          visit_date: string
          visit_type: string
        }
        Update: {
          aircraft_id?: string
          booking_id?: string | null
          component_due_date?: string | null
          component_due_hours?: number | null
          component_id?: string | null
          created_at?: string
          date_out_of_maintenance?: string | null
          description?: string
          hours_after?: number | null
          hours_at_visit?: number | null
          hours_before?: number | null
          id?: string
          next_due_date?: string | null
          next_due_hours?: number | null
          notes?: string | null
          performed_by?: string | null
          scheduled_by?: string | null
          scheduled_end?: string | null
          scheduled_for?: string | null
          technician_name?: string | null
          tenant_id?: string
          total_cost?: number | null
          updated_at?: string
          visit_date?: string
          visit_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_visits_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "aircraft"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_visits_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "user_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_visits_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_visits_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      membership_types: {
        Row: {
          benefits: Json | null
          chargeable_id: string | null
          code: string
          created_at: string
          description: string | null
          duration_months: number
          id: string
          is_active: boolean
          name: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          benefits?: Json | null
          chargeable_id?: string | null
          code: string
          created_at?: string
          description?: string | null
          duration_months?: number
          id?: string
          is_active?: boolean
          name: string
          tenant_id?: string
          updated_at?: string
        }
        Update: {
          benefits?: Json | null
          chargeable_id?: string | null
          code?: string
          created_at?: string
          description?: string | null
          duration_months?: number
          id?: string
          is_active?: boolean
          name?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_membership_chargeable"
            columns: ["chargeable_id"]
            isOneToOne: false
            referencedRelation: "chargeables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membership_types_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          auto_renew: boolean
          created_at: string
          end_date: string | null
          expiry_date: string
          grace_period_days: number
          id: string
          invoice_id: string | null
          is_active: boolean
          membership_type_id: string
          notes: string | null
          purchased_date: string
          start_date: string
          tenant_id: string
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          auto_renew?: boolean
          created_at?: string
          end_date?: string | null
          expiry_date: string
          grace_period_days?: number
          id?: string
          invoice_id?: string | null
          is_active?: boolean
          membership_type_id: string
          notes?: string | null
          purchased_date?: string
          start_date?: string
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          auto_renew?: boolean
          created_at?: string
          end_date?: string | null
          expiry_date?: string
          grace_period_days?: number
          id?: string
          invoice_id?: string | null
          is_active?: boolean
          membership_type_id?: string
          notes?: string | null
          purchased_date?: string
          start_date?: string
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_membership_type_id_fkey"
            columns: ["membership_type_id"]
            isOneToOne: false
            referencedRelation: "membership_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      observations: {
        Row: {
          aircraft_id: string
          assigned_to: string | null
          closed_by: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          notes: string | null
          priority: string | null
          reported_by: string
          reported_date: string
          resolution_comments: string | null
          resolved_at: string | null
          stage: Database["public"]["Enums"]["observation_stage"]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          aircraft_id: string
          assigned_to?: string | null
          closed_by?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          notes?: string | null
          priority?: string | null
          reported_by: string
          reported_date?: string
          resolution_comments?: string | null
          resolved_at?: string | null
          stage?: Database["public"]["Enums"]["observation_stage"]
          tenant_id?: string
          updated_at?: string
        }
        Update: {
          aircraft_id?: string
          assigned_to?: string | null
          closed_by?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          notes?: string | null
          priority?: string | null
          reported_by?: string
          reported_date?: string
          resolution_comments?: string | null
          resolved_at?: string | null
          stage?: Database["public"]["Enums"]["observation_stage"]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "observations_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "aircraft"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "observations_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "user_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "observations_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "observations_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "user_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "observations_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "observations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: []
      }
      roster_rules: {
        Row: {
          created_at: string
          day_of_week: number
          effective_from: string
          effective_until: string | null
          end_time: string
          id: string
          instructor_id: string
          is_active: boolean
          notes: string | null
          start_time: string
          tenant_id: string
          updated_at: string
          voided_at: string | null
        }
        Insert: {
          created_at?: string
          day_of_week: number
          effective_from?: string
          effective_until?: string | null
          end_time: string
          id?: string
          instructor_id: string
          is_active?: boolean
          notes?: string | null
          start_time: string
          tenant_id?: string
          updated_at?: string
          voided_at?: string | null
        }
        Update: {
          created_at?: string
          day_of_week?: number
          effective_from?: string
          effective_until?: string | null
          end_time?: string
          id?: string
          instructor_id?: string
          is_active?: boolean
          notes?: string | null
          start_time?: string
          tenant_id?: string
          updated_at?: string
          voided_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "roster_rules_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "instructors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roster_rules_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_overrides: {
        Row: {
          created_at: string
          end_time: string | null
          id: string
          instructor_id: string
          notes: string | null
          override_date: string
          override_type: Database["public"]["Enums"]["shift_override_type"]
          replaces_rule_id: string | null
          start_time: string | null
          tenant_id: string
          updated_at: string
          voided_at: string | null
        }
        Insert: {
          created_at?: string
          end_time?: string | null
          id?: string
          instructor_id: string
          notes?: string | null
          override_date: string
          override_type: Database["public"]["Enums"]["shift_override_type"]
          replaces_rule_id?: string | null
          start_time?: string | null
          tenant_id?: string
          updated_at?: string
          voided_at?: string | null
        }
        Update: {
          created_at?: string
          end_time?: string | null
          id?: string
          instructor_id?: string
          notes?: string | null
          override_date?: string
          override_type?: Database["public"]["Enums"]["shift_override_type"]
          replaces_rule_id?: string | null
          start_time?: string | null
          tenant_id?: string
          updated_at?: string
          voided_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shift_overrides_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "instructors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_overrides_replaces_rule_id_fkey"
            columns: ["replaces_rule_id"]
            isOneToOne: false
            referencedRelation: "roster_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_overrides_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      student_syllabus_enrollment: {
        Row: {
          aircraft_type: string | null
          completion_date: string | null
          created_at: string
          enrolled_at: string
          id: string
          notes: string | null
          primary_instructor_id: string | null
          status: string
          syllabus_id: string
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          aircraft_type?: string | null
          completion_date?: string | null
          created_at?: string
          enrolled_at?: string
          id?: string
          notes?: string | null
          primary_instructor_id?: string | null
          status?: string
          syllabus_id: string
          tenant_id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          aircraft_type?: string | null
          completion_date?: string | null
          created_at?: string
          enrolled_at?: string
          id?: string
          notes?: string | null
          primary_instructor_id?: string | null
          status?: string
          syllabus_id?: string
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_syllabus_enrollment_aircraft_type_fkey"
            columns: ["aircraft_type"]
            isOneToOne: false
            referencedRelation: "aircraft_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_syllabus_enrollment_syllabus_id_fkey"
            columns: ["syllabus_id"]
            isOneToOne: false
            referencedRelation: "syllabus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_syllabus_enrollment_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_syllabus_enrollment_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_syllabus_enrollment_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      syllabus: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          number_of_exams: number
          tenant_id: string
          updated_at: string
          voided_at: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          number_of_exams?: number
          tenant_id?: string
          updated_at?: string
          voided_at?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          number_of_exams?: number
          tenant_id?: string
          updated_at?: string
          voided_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "syllabus_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_rates: {
        Row: {
          country_code: string
          created_at: string
          description: string | null
          effective_from: string
          id: string
          is_active: boolean
          is_default: boolean
          rate: number
          region_code: string | null
          tax_name: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          country_code: string
          created_at?: string
          description?: string | null
          effective_from?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          rate: number
          region_code?: string | null
          tax_name?: string
          tenant_id?: string
          updated_at?: string
        }
        Update: {
          country_code?: string
          created_at?: string
          description?: string | null
          effective_from?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          rate?: number
          region_code?: string | null
          tax_name?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tax_rates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_settings: {
        Row: {
          settings: Json
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          settings?: Json
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          settings?: Json
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_users: {
        Row: {
          created_at: string
          granted_at: string
          granted_by: string | null
          id: string
          is_active: boolean
          role_changed_at: string | null
          role_id: string
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          granted_at?: string
          granted_by?: string | null
          id?: string
          is_active?: boolean
          role_changed_at?: string | null
          role_id: string
          tenant_id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          granted_at?: string
          granted_by?: string | null
          id?: string
          is_active?: boolean
          role_changed_at?: string | null
          role_id?: string
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_users_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "user_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_users_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_users_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_users_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_users_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_users_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          address: string | null
          billing_address: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          currency: string | null
          description: string | null
          gst_number: string | null
          id: string
          is_active: boolean
          logo_url: string | null
          name: string
          registration_number: string | null
          settings: Json | null
          slug: string
          timezone: string | null
          updated_at: string
          website_url: string | null
        }
        Insert: {
          address?: string | null
          billing_address?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          currency?: string | null
          description?: string | null
          gst_number?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name: string
          registration_number?: string | null
          settings?: Json | null
          slug: string
          timezone?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          address?: string | null
          billing_address?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          currency?: string | null
          description?: string | null
          gst_number?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name?: string
          registration_number?: string | null
          settings?: Json | null
          slug?: string
          timezone?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          completed_at: string | null
          created_at: string
          description: string
          id: string
          metadata: Json | null
          reference_number: string | null
          status: Database["public"]["Enums"]["transaction_status"]
          tenant_id: string
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          completed_at?: string | null
          created_at?: string
          description: string
          id?: string
          metadata?: Json | null
          reference_number?: string | null
          status?: Database["public"]["Enums"]["transaction_status"]
          tenant_id?: string
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          completed_at?: string | null
          created_at?: string
          description?: string
          id?: string
          metadata?: Json | null
          reference_number?: string | null
          status?: Database["public"]["Enums"]["transaction_status"]
          tenant_id?: string
          type?: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_permission_overrides: {
        Row: {
          created_at: string
          granted: boolean
          id: string
          permission_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          granted: boolean
          id?: string
          permission_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          granted?: boolean
          id?: string
          permission_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_permission_overrides_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_permission_overrides_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          BFR_due: string | null
          city: string | null
          class_1_medical_due: string | null
          class_2_medical_due: string | null
          company_name: string | null
          country: string | null
          created_at: string
          date_of_birth: string | null
          date_of_last_flight: string | null
          DL9_due: string | null
          email: string
          emergency_contact_relationship: string | null
          employer: string | null
          first_name: string | null
          gender: Database["public"]["Enums"]["gender_enum"] | null
          id: string
          is_active: boolean
          last_name: string | null
          medical_certificate_expiry: string | null
          next_of_kin_name: string | null
          next_of_kin_phone: string | null
          notes: string | null
          occupation: string | null
          phone: string | null
          pilot_license_expiry: string | null
          pilot_license_id: string | null
          pilot_license_number: string | null
          pilot_license_type: string | null
          postal_code: string | null
          public_directory_opt_in: boolean
          state: string | null
          street_address: string | null
          updated_at: string
        }
        Insert: {
          BFR_due?: string | null
          city?: string | null
          class_1_medical_due?: string | null
          class_2_medical_due?: string | null
          company_name?: string | null
          country?: string | null
          created_at?: string
          date_of_birth?: string | null
          date_of_last_flight?: string | null
          DL9_due?: string | null
          email: string
          emergency_contact_relationship?: string | null
          employer?: string | null
          first_name?: string | null
          gender?: Database["public"]["Enums"]["gender_enum"] | null
          id: string
          is_active?: boolean
          last_name?: string | null
          medical_certificate_expiry?: string | null
          next_of_kin_name?: string | null
          next_of_kin_phone?: string | null
          notes?: string | null
          occupation?: string | null
          phone?: string | null
          pilot_license_expiry?: string | null
          pilot_license_id?: string | null
          pilot_license_number?: string | null
          pilot_license_type?: string | null
          postal_code?: string | null
          public_directory_opt_in?: boolean
          state?: string | null
          street_address?: string | null
          updated_at?: string
        }
        Update: {
          BFR_due?: string | null
          city?: string | null
          class_1_medical_due?: string | null
          class_2_medical_due?: string | null
          company_name?: string | null
          country?: string | null
          created_at?: string
          date_of_birth?: string | null
          date_of_last_flight?: string | null
          DL9_due?: string | null
          email?: string
          emergency_contact_relationship?: string | null
          employer?: string | null
          first_name?: string | null
          gender?: Database["public"]["Enums"]["gender_enum"] | null
          id?: string
          is_active?: boolean
          last_name?: string | null
          medical_certificate_expiry?: string | null
          next_of_kin_name?: string | null
          next_of_kin_phone?: string | null
          notes?: string | null
          occupation?: string | null
          phone?: string | null
          pilot_license_expiry?: string | null
          pilot_license_id?: string | null
          pilot_license_number?: string | null
          pilot_license_type?: string | null
          postal_code?: string | null
          public_directory_opt_in?: boolean
          state?: string | null
          street_address?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_pilot_license_id_fkey"
            columns: ["pilot_license_id"]
            isOneToOne: false
            referencedRelation: "licenses"
            referencedColumns: ["id"]
          },
        ]
      }
      users_endorsements: {
        Row: {
          created_at: string
          endorsement_id: string
          expiry_date: string | null
          id: string
          issued_date: string
          notes: string | null
          tenant_id: string
          updated_at: string
          user_id: string
          voided_at: string | null
        }
        Insert: {
          created_at?: string
          endorsement_id: string
          expiry_date?: string | null
          id?: string
          issued_date?: string
          notes?: string | null
          tenant_id?: string
          updated_at?: string
          user_id: string
          voided_at?: string | null
        }
        Update: {
          created_at?: string
          endorsement_id?: string
          expiry_date?: string | null
          id?: string
          issued_date?: string
          notes?: string | null
          tenant_id?: string
          updated_at?: string
          user_id?: string
          voided_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_endorsements_endorsement_id_fkey"
            columns: ["endorsement_id"]
            isOneToOne: false
            referencedRelation: "endorsements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_endorsements_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_endorsements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_endorsements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      user_directory: {
        Row: {
          created_at: string | null
          email: string | null
          first_name: string | null
          id: string | null
          last_name: string | null
          phone: string | null
          public_directory_opt_in: boolean | null
          public_email: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          first_name?: string | null
          id?: string | null
          last_name?: string | null
          phone?: never
          public_directory_opt_in?: boolean | null
          public_email?: never
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          first_name?: string | null
          id?: string | null
          last_name?: string | null
          phone?: never
          public_directory_opt_in?: boolean | null
          public_email?: never
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      apply_credit_note_atomic: {
        Args: { p_applied_by: string; p_credit_note_id: string }
        Returns: Json
      }
      approve_booking_checkin_atomic:
        | {
            Args: {
              p_actual_end: string | null
              p_actual_start: string | null
              p_airswitch_end: number | null
              p_airswitch_start: number | null
              p_billing_basis: string
              p_billing_hours: number
              p_booking_id: string
              p_checked_out_aircraft_id: string
              p_checked_out_instructor_id: string | null
              p_dual_time: number | null
              p_due_date?: string | null
              p_flight_type_id: string
              p_hobbs_end: number | null
              p_hobbs_start: number | null
              p_items?: Json
              p_notes?: string | null
              p_reference?: string | null
              p_solo_end_hobbs: number | null
              p_solo_end_tach: number | null
              p_solo_time: number | null
              p_tach_end: number | null
              p_tach_start: number | null
              p_tax_rate?: number | null
            }
            Returns: Json
          }
        | {
            Args: {
              p_airswitch_end: number | null
              p_airswitch_start: number | null
              p_billing_basis: string
              p_billing_hours: number
              p_booking_id: string
              p_checked_out_aircraft_id: string
              p_checked_out_instructor_id: string | null
              p_dual_time: number | null
              p_due_date?: string | null
              p_flight_type_id: string
              p_hobbs_end: number | null
              p_hobbs_start: number | null
              p_items?: Json
              p_notes?: string | null
              p_reference?: string | null
              p_solo_end_hobbs: number | null
              p_solo_end_tach: number | null
              p_solo_time: number | null
              p_tach_end: number | null
              p_tach_start: number | null
              p_tax_rate?: number | null
            }
            Returns: Json
          }
      begin_transaction: { Args: never; Returns: string }
      calculate_applied_aircraft_delta: {
        Args: { p_hobbs_delta: number; p_method: string; p_tach_delta: number }
        Returns: number
      }
      can_manage_user: { Args: { p_user_id: string }; Returns: boolean }
      can_see_contact_info: { Args: { p_user_id: string }; Returns: boolean }
      cancel_booking: {
        Args: {
          p_booking_id: string
          p_cancellation_category_id?: string
          p_notes?: string
          p_reason?: string
        }
        Returns: string
      }
      check_schedule_conflict: {
        Args: {
          p_date: string
          p_end_time: string
          p_exclude_override_id?: string
          p_exclude_rule_id?: string
          p_instructor_id: string
          p_start_time: string
        }
        Returns: boolean
      }
      check_user_role: {
        Args: {
          allowed_roles: Database["public"]["Enums"]["user_role"][]
          user_id: string
        }
        Returns: boolean
      }
      check_user_role_simple: {
        Args: {
          allowed_roles: Database["public"]["Enums"]["user_role"][]
          user_id: string
        }
        Returns: boolean
      }
      commit_transaction: { Args: never; Returns: string }
      correct_booking_checkin_ttis_atomic: {
        Args: {
          p_airswitch_end: number
          p_booking_id: string
          p_correction_reason: string
          p_hobbs_end: number
          p_tach_end: number
        }
        Returns: Json
      }
      create_invoice_atomic: {
        Args: {
          p_booking_id?: string
          p_due_date?: string
          p_invoice_number?: string
          p_issue_date?: string
          p_items?: Json
          p_notes?: string
          p_reference?: string
          p_status?: string
          p_tax_rate?: number
          p_user_id: string
        }
        Returns: Json
      }
      create_invoice_with_transaction: {
        Args: {
          p_booking_id?: string
          p_due_date?: string
          p_invoice_number?: string
          p_status?: string
          p_tax_rate?: number
          p_user_id: string
        }
        Returns: Json
      }
      current_user_is_staff: { Args: never; Returns: boolean }
      equipment_update_summary: {
        Args: never
        Returns: {
          days_until_due: number
          id: string
          label: string
          last_updated_at: string
          last_updated_by: string
          last_updated_by_name: string
          name: string
          next_due_at: string
          notes: string
          status: string
          type: Database["public"]["Enums"]["equipment_type"]
        }[]
      }
      finalize_booking_checkin_with_invoice_atomic:
        | {
            Args: {
              p_actual_end: string
              p_actual_start: string
              p_airswitch_end: number
              p_airswitch_start: number
              p_billing_basis: string
              p_billing_hours: number
              p_booking_id: string
              p_checked_out_aircraft_id: string
              p_checked_out_instructor_id: string
              p_dual_time: number
              p_flight_type_id: string
              p_hobbs_end: number
              p_hobbs_start: number
              p_invoice_id: string
              p_solo_end_hobbs: number
              p_solo_end_tach: number
              p_solo_time: number
              p_tach_end: number
              p_tach_start: number
            }
            Returns: Json
          }
        | {
            Args: {
              p_airswitch_end: number
              p_airswitch_start: number
              p_billing_basis: string
              p_billing_hours: number
              p_booking_id: string
              p_checked_out_aircraft_id: string
              p_checked_out_instructor_id: string
              p_dual_time: number
              p_flight_type_id: string
              p_hobbs_end: number
              p_hobbs_start: number
              p_invoice_id: string
              p_solo_end_hobbs: number
              p_solo_end_tach: number
              p_solo_time: number
              p_tach_end: number
              p_tach_start: number
            }
            Returns: Json
          }
      find_aircraft_with_suspicious_ttis: {
        Args: never
        Returns: {
          aircraft_id: string
          first_flight_date: string
          flights_count: number
          registration: string
          total_time_in_service: number
        }[]
      }
      flatten_settings: { Args: { nested_settings: Json }; Returns: Json }
      generate_credit_note_number: { Args: never; Returns: string }
      generate_invoice_number: { Args: never; Returns: string }
      generate_invoice_number_app: { Args: never; Returns: string }
      generate_invoice_number_with_prefix: {
        Args: { p_prefix?: string }
        Returns: string
      }
      generate_payment_number: { Args: never; Returns: string }
      get_account_balance: { Args: { p_user_id: string }; Returns: number }
      get_aircraft_maintenance_cost_report:
        | {
            Args: {
              p_aircraft_id?: string
              p_end_date?: string
              p_start_date?: string
            }
            Returns: {
              aircraft_id: string
              aircraft_type: string
              avg_cost_per_visit: number
              cost_by_type: Json
              cost_per_hour: number
              last_maintenance_date: string
              registration: string
              total_maintenance_cost: number
              total_time_in_service: number
              visit_count: number
            }[]
          }
        | {
            Args: {
              p_aircraft_id?: string
              p_end_date?: string
              p_start_date?: string
            }
            Returns: {
              aircraft_id: string
              aircraft_type: string
              avg_cost_per_visit: number
              cost_by_type: Json
              cost_per_hour: number
              last_maintenance_date: string
              registration: string
              total_hours: number
              total_maintenance_cost: number
              visit_count: number
            }[]
          }
      get_auth_user_details: {
        Args: { user_uuid: string }
        Returns: {
          confirmed_at: string
        }[]
      }
      get_component_timing_report: {
        Args: {
          p_aircraft_id?: string
          p_end_date?: string
          p_start_date?: string
        }
        Returns: {
          aircraft_id: string
          component_id: string
          component_name: string
          component_type: string
          description: string
          hours_at_service: number
          hours_due_at_service: number
          registration: string
          timing_difference_hours: number
          timing_status: string
          visit_date: string
          visit_type: string
        }[]
      }
      get_current_role_state: {
        Args: { p_user_id: string }
        Returns: {
          role_changed_at: string
          role_name: Database["public"]["Enums"]["user_role"]
          tenant_id: string
        }[]
      }
      get_instructor_activity_reports: {
        Args: {
          p_end_date?: string
          p_instructor_id?: string
          p_start_date?: string
        }
        Returns: {
          aircraft_registration: string
          cumulative_time: number
          flight_date: string
          flight_time: number
          purpose: string
          student_name: string
        }[]
      }
      get_instructor_week_schedule: {
        Args: { p_instructor_id: string; p_week_start_date: string }
        Returns: {
          date: string
          day_of_week: number
          shifts: Json
        }[]
      }
      get_maintenance_frequency_report: {
        Args: {
          p_aircraft_id?: string
          p_end_date?: string
          p_start_date?: string
        }
        Returns: {
          aircraft_id: string
          avg_days_between_visits: number
          avg_maintenance_duration_hours: number
          first_visit_date: string
          last_visit_date: string
          registration: string
          total_days_in_maintenance: number
          visit_count: number
          visit_details: Json
        }[]
      }
      get_role_id_by_name: { Args: { role_name: string }; Returns: string }
      get_tech_log_reports: {
        Args: {
          p_aircraft_id?: string
          p_end_date?: string
          p_start_date?: string
        }
        Returns: {
          aircraft_id: string
          daily_credited_time: number
          daily_hobbs_time: number
          daily_tach_time: number
          end_of_day_tach: number
          flight_count: number
          registration: string
          report_date: string
          total_hours_end_of_day: number
          total_hours_start_of_day: number
          total_time_method: string
        }[]
      }
      get_tenant_user_role: {
        Args: { p_tenant_id?: string; p_user_id?: string }
        Returns: Database["public"]["Enums"]["user_role"]
      }
      get_user_role: { Args: { user_id?: string }; Returns: string }
      get_user_tenant: { Args: { p_user_id?: string }; Returns: string }
      is_auth_user: { Args: { user_uuid: string }; Returns: boolean }
      needs_session_refresh: {
        Args: { p_token_issued_at: string; p_user_id: string }
        Returns: boolean
      }
      process_credit_payment_atomic: {
        Args: {
          p_amount: number
          p_notes?: string
          p_payment_method: string
          p_payment_reference?: string
          p_user_id: string
        }
        Returns: Json
      }
      process_payment: {
        Args: {
          p_amount: number
          p_invoice_id: string
          p_notes?: string
          p_payment_method: string
          p_payment_reference?: string
        }
        Returns: string
      }
      process_payment_atomic: {
        Args: {
          p_amount: number
          p_invoice_id: string
          p_notes?: string
          p_payment_method: string
          p_payment_reference?: string
        }
        Returns: Json
      }
      process_refund: {
        Args: { p_amount: number; p_notes?: string; p_payment_id: string }
        Returns: string
      }
      record_invoice_payment_atomic: {
        Args: {
          p_amount: number
          p_invoice_id: string
          p_notes?: string
          p_paid_at?: string
          p_payment_method: Database["public"]["Enums"]["payment_method"]
          p_payment_reference?: string
        }
        Returns: Json
      }
      reverse_and_replace_payment_atomic: {
        Args: {
          p_admin_user_id: string
          p_correct_amount: number
          p_notes?: string
          p_original_payment_id: string
          p_reason: string
        }
        Returns: Json
      }
      reverse_payment_atomic: {
        Args: {
          p_admin_user_id: string
          p_payment_id: string
          p_reason: string
        }
        Returns: Json
      }
      rollback_transaction: { Args: never; Returns: string }
      soft_delete_credit_note: {
        Args: { p_credit_note_id: string; p_reason?: string; p_user_id: string }
        Returns: Json
      }
      soft_delete_invoice: {
        Args: { p_invoice_id: string; p_reason?: string; p_user_id: string }
        Returns: Json
      }
      tenant_user_has_role: {
        Args: {
          p_required_roles: Database["public"]["Enums"]["user_role"][]
          p_tenant_id: string
          p_user_id: string
        }
        Returns: boolean
      }
      uncancel_booking: { Args: { p_booking_id: string }; Returns: string }
      update_invoice_status_atomic: {
        Args: {
          p_invoice_id: string
          p_new_status: string
          p_updated_at?: string
        }
        Returns: Json
      }
      update_invoice_totals_atomic: {
        Args: { p_invoice_id: string }
        Returns: Json
      }
      upsert_invoice_items_batch: {
        Args: { p_invoice_id: string; p_items: Json }
        Returns: {
          amount: number
          chargeable_id: string
          created_at: string
          description: string
          id: string
          invoice_id: string
          line_total: number
          notes: string
          quantity: number
          rate_inclusive: number
          tax_amount: number
          tax_rate: number
          unit_price: number
          updated_at: string
        }[]
      }
      user_belongs_to_tenant: {
        Args: { p_tenant_id: string }
        Returns: boolean
      }
      user_has_any_role: {
        Args: { required_roles: string[]; user_id?: string }
        Returns: boolean
      }
      user_has_minimum_role: {
        Args: { minimum_role_name: string; user_id?: string }
        Returns: boolean
      }
      user_has_role: {
        Args: { required_role_name: string; user_id?: string }
        Returns: boolean
      }
      users_share_tenant: { Args: { p_user_id: string }; Returns: boolean }
    }
    Enums: {
      booking_status:
        | "unconfirmed"
        | "confirmed"
        | "briefing"
        | "flying"
        | "complete"
        | "cancelled"
      booking_type: "flight" | "groundwork" | "maintenance" | "other"
      component_status_enum: "active" | "inactive" | "removed"
      component_type_enum:
        | "battery"
        | "inspection"
        | "service"
        | "engine"
        | "fuselage"
        | "avionics"
        | "elt"
        | "propeller"
        | "landing_gear"
        | "other"
      employment_type: "full_time" | "part_time" | "casual" | "contractor"
      equipment_status: "active" | "lost" | "maintenance" | "retired"
      equipment_type:
        | "AIP"
        | "Stationery"
        | "Headset"
        | "Technology"
        | "Maps"
        | "Radio"
        | "Transponder"
        | "ELT"
        | "Lifejacket"
        | "FirstAidKit"
        | "FireExtinguisher"
        | "Other"
      exam_result: "PASS" | "FAIL"
      experience_unit: "hours" | "count" | "landings"
      gender_enum: "male" | "female"
      instruction_type_enum: "dual" | "solo" | "trial"
      instructor_status: "active" | "inactive" | "deactivated" | "suspended"
      interval_type_enum: "HOURS" | "CALENDAR" | "BOTH"
      invoice_status:
        | "draft"
        | "pending"
        | "paid"
        | "overdue"
        | "cancelled"
        | "refunded"
      lesson_outcome: "pass" | "not yet competent"
      membership_type:
        | "flying_member"
        | "non_flying_member"
        | "staff_membership"
        | "junior_member"
        | "life_member"
      observation_stage: "open" | "investigation" | "resolution" | "closed"
      observation_status: "active" | "resolved" | "closed"
      payment_method:
        | "cash"
        | "credit_card"
        | "debit_card"
        | "bank_transfer"
        | "check"
        | "online_payment"
        | "other"
      shift_override_type: "add" | "replace" | "cancel"
      syllabus_stage:
        | "basic syllabus"
        | "advances syllabus"
        | "circuit training"
        | "terrain and weather awareness"
        | "instrument flying and flight test revision"
      task_category:
        | "Safety"
        | "Training"
        | "Maintenance"
        | "Administrative"
        | "Other"
      task_priority: "low" | "medium" | "high"
      task_status: "assigned" | "inProgress" | "completed" | "overdue"
      total_time_method:
        | "hobbs"
        | "tacho"
        | "airswitch"
        | "hobbs less 5%"
        | "hobbs less 10%"
        | "tacho less 5%"
        | "tacho less 10%"
      transaction_status:
        | "pending"
        | "completed"
        | "failed"
        | "cancelled"
        | "refunded"
      transaction_type: "credit" | "debit" | "refund" | "adjustment"
      user_role: "admin" | "instructor" | "member" | "student" | "owner"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      booking_status: [
        "unconfirmed",
        "confirmed",
        "briefing",
        "flying",
        "complete",
        "cancelled",
      ],
      booking_type: ["flight", "groundwork", "maintenance", "other"],
      component_status_enum: ["active", "inactive", "removed"],
      component_type_enum: [
        "battery",
        "inspection",
        "service",
        "engine",
        "fuselage",
        "avionics",
        "elt",
        "propeller",
        "landing_gear",
        "other",
      ],
      employment_type: ["full_time", "part_time", "casual", "contractor"],
      equipment_status: ["active", "lost", "maintenance", "retired"],
      equipment_type: [
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
      ],
      exam_result: ["PASS", "FAIL"],
      experience_unit: ["hours", "count", "landings"],
      gender_enum: ["male", "female"],
      instruction_type_enum: ["dual", "solo", "trial"],
      instructor_status: ["active", "inactive", "deactivated", "suspended"],
      interval_type_enum: ["HOURS", "CALENDAR", "BOTH"],
      invoice_status: [
        "draft",
        "pending",
        "paid",
        "overdue",
        "cancelled",
        "refunded",
      ],
      lesson_outcome: ["pass", "not yet competent"],
      membership_type: [
        "flying_member",
        "non_flying_member",
        "staff_membership",
        "junior_member",
        "life_member",
      ],
      observation_stage: ["open", "investigation", "resolution", "closed"],
      observation_status: ["active", "resolved", "closed"],
      payment_method: [
        "cash",
        "credit_card",
        "debit_card",
        "bank_transfer",
        "check",
        "online_payment",
        "other",
      ],
      shift_override_type: ["add", "replace", "cancel"],
      syllabus_stage: [
        "basic syllabus",
        "advances syllabus",
        "circuit training",
        "terrain and weather awareness",
        "instrument flying and flight test revision",
      ],
      task_category: [
        "Safety",
        "Training",
        "Maintenance",
        "Administrative",
        "Other",
      ],
      task_priority: ["low", "medium", "high"],
      task_status: ["assigned", "inProgress", "completed", "overdue"],
      total_time_method: [
        "hobbs",
        "tacho",
        "airswitch",
        "hobbs less 5%",
        "hobbs less 10%",
        "tacho less 5%",
        "tacho less 10%",
      ],
      transaction_status: [
        "pending",
        "completed",
        "failed",
        "cancelled",
        "refunded",
      ],
      transaction_type: ["credit", "debit", "refund", "adjustment"],
      user_role: ["admin", "instructor", "member", "student", "owner"],
    },
  },
} as const
