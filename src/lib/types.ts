// Generated from Supabase schema
// Run: npx supabase gen types typescript --local > src/lib/types.ts

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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          created_at: string | null
          details: Json | null
          entity: string
          entity_id: string
          id: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string | null
          details?: Json | null
          entity: string
          entity_id: string
          id?: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string | null
          details?: Json | null
          entity?: string
          entity_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string
          city: string
          created_at: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          postal_code: string
          siret: string | null
          type: Database["public"]["Enums"]["client_type"] | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          address: string
          city: string
          created_at?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          postal_code: string
          siret?: string | null
          type?: Database["public"]["Enums"]["client_type"] | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          address?: string
          city?: string
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          postal_code?: string
          siret?: string | null
          type?: Database["public"]["Enums"]["client_type"] | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_note_lines: {
        Row: {
          amount: number
          credit_note_id: string
          description: string
          id: string
          quantity: number
          sort_order: number | null
          unit_price: number
        }
        Insert: {
          amount: number
          credit_note_id: string
          description: string
          id?: string
          quantity: number
          sort_order?: number | null
          unit_price: number
        }
        Update: {
          amount?: number
          credit_note_id?: string
          description?: string
          id?: string
          quantity?: number
          sort_order?: number | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "credit_note_lines_credit_note_id_fkey"
            columns: ["credit_note_id"]
            isOneToOne: false
            referencedRelation: "credit_notes"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_note_sequences: {
        Row: {
          last_number: number | null
          user_id: string
          year: number
        }
        Insert: {
          last_number?: number | null
          user_id: string
          year: number
        }
        Update: {
          last_number?: number | null
          user_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "credit_note_sequences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_notes: {
        Row: {
          created_at: string | null
          id: string
          issue_date: string
          number: string | null
          original_invoice_id: string
          pdf_url: string | null
          reason: string | null
          status: string | null
          subtotal: number
          total: number
          updated_at: string | null
          user_id: string
          vat_amount: number | null
          vat_rate: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          issue_date: string
          number?: string | null
          original_invoice_id: string
          pdf_url?: string | null
          reason?: string | null
          status?: string | null
          subtotal: number
          total: number
          updated_at?: string | null
          user_id: string
          vat_amount?: number | null
          vat_rate?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          issue_date?: string
          number?: string | null
          original_invoice_id?: string
          pdf_url?: string | null
          reason?: string | null
          status?: string | null
          subtotal?: number
          total?: number
          updated_at?: string | null
          user_id?: string
          vat_amount?: number | null
          vat_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "credit_notes_original_invoice_id_fkey"
            columns: ["original_invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_notes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_lines: {
        Row: {
          amount: number
          description: string
          id: string
          invoice_id: string
          quantity: number
          sort_order: number | null
          unit_price: number
        }
        Insert: {
          amount: number
          description: string
          id?: string
          invoice_id: string
          quantity: number
          sort_order?: number | null
          unit_price: number
        }
        Update: {
          amount?: number
          description?: string
          id?: string
          invoice_id?: string
          quantity?: number
          sort_order?: number | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_lines_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_sequences: {
        Row: {
          last_number: number | null
          user_id: string
          year: number
        }
        Insert: {
          last_number?: number | null
          user_id: string
          year: number
        }
        Update: {
          last_number?: number | null
          user_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_sequences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          client_id: string
          created_at: string | null
          due_date: string
          id: string
          issue_date: string
          notes: string | null
          number: string | null
          payment_method: string | null
          payment_term_days: number | null
          pdf_url: string | null
          sequence_number: number | null
          service_date: string
          status: Database["public"]["Enums"]["invoice_status"] | null
          subtotal: number
          total: number
          updated_at: string | null
          user_id: string
          vat_amount: number | null
          vat_rate: number | null
        }
        Insert: {
          client_id: string
          created_at?: string | null
          due_date: string
          id?: string
          issue_date: string
          notes?: string | null
          number?: string | null
          payment_method?: string | null
          payment_term_days?: number | null
          pdf_url?: string | null
          sequence_number?: number | null
          service_date: string
          status?: Database["public"]["Enums"]["invoice_status"] | null
          subtotal: number
          total: number
          updated_at?: string | null
          user_id: string
          vat_amount?: number | null
          vat_rate?: number | null
        }
        Update: {
          client_id?: string
          created_at?: string | null
          due_date?: string
          id?: string
          issue_date?: string
          notes?: string | null
          number?: string | null
          payment_method?: string | null
          payment_term_days?: number | null
          pdf_url?: string | null
          sequence_number?: number | null
          service_date?: string
          status?: Database["public"]["Enums"]["invoice_status"] | null
          subtotal?: number
          total?: number
          updated_at?: string | null
          user_id?: string
          vat_amount?: number | null
          vat_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string | null
          date: string
          id: string
          invoice_id: string
          method: string
          reference: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          date: string
          id?: string
          invoice_id: string
          method: string
          reference?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          date?: string
          id?: string
          invoice_id?: string
          method?: string
          reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          acre_public_eligible: boolean | null
          address: string
          bic: string | null
          city: string
          code_ape: string | null
          company_created_at: string
          cotisation_rate: number | null
          created_at: string | null
          declaration_freq: Database["public"]["Enums"]["frequency"] | null
          facturx_enabled: boolean
          first_name: string
          iban: string | null
          id: string
          is_acre: boolean | null
          last_name: string
          logo_url: string | null
          postal_code: string
          siret: string
          updated_at: string | null
          vat_regime: Database["public"]["Enums"]["vat_regime"] | null
        }
        Insert: {
          acre_public_eligible?: boolean | null
          address: string
          bic?: string | null
          city: string
          code_ape?: string | null
          company_created_at: string
          cotisation_rate?: number | null
          created_at?: string | null
          declaration_freq?: Database["public"]["Enums"]["frequency"] | null
          facturx_enabled?: boolean
          first_name: string
          iban?: string | null
          id: string
          is_acre?: boolean | null
          last_name: string
          logo_url?: string | null
          postal_code: string
          siret: string
          updated_at?: string | null
          vat_regime?: Database["public"]["Enums"]["vat_regime"] | null
        }
        Update: {
          acre_public_eligible?: boolean | null
          address?: string
          bic?: string | null
          city?: string
          code_ape?: string | null
          company_created_at?: string
          cotisation_rate?: number | null
          created_at?: string | null
          declaration_freq?: Database["public"]["Enums"]["frequency"] | null
          facturx_enabled?: boolean
          first_name?: string
          iban?: string | null
          id?: string
          is_acre?: boolean | null
          last_name?: string
          logo_url?: string | null
          postal_code?: string
          siret?: string
          updated_at?: string | null
          vat_regime?: Database["public"]["Enums"]["vat_regime"] | null
        }
        Relationships: []
      }
      quote_lines: {
        Row: {
          amount: number
          description: string
          id: string
          quantity: number
          quote_id: string
          sort_order: number | null
          unit_price: number
        }
        Insert: {
          amount: number
          description: string
          id?: string
          quantity: number
          quote_id: string
          sort_order?: number | null
          unit_price: number
        }
        Update: {
          amount?: number
          description?: string
          id?: string
          quantity?: number
          quote_id?: string
          sort_order?: number | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "quote_lines_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_sequences: {
        Row: {
          last_number: number | null
          user_id: string
          year: number
        }
        Insert: {
          last_number?: number | null
          user_id: string
          year: number
        }
        Update: {
          last_number?: number | null
          user_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "quote_sequences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          client_id: string
          converted_invoice_id: string | null
          created_at: string | null
          id: string
          issue_date: string
          notes: string | null
          number: string | null
          status: Database["public"]["Enums"]["quote_status"] | null
          subtotal: number
          updated_at: string | null
          user_id: string
          valid_until: string
        }
        Insert: {
          client_id: string
          converted_invoice_id?: string | null
          created_at?: string | null
          id?: string
          issue_date: string
          notes?: string | null
          number?: string | null
          status?: Database["public"]["Enums"]["quote_status"] | null
          subtotal: number
          updated_at?: string | null
          user_id: string
          valid_until: string
        }
        Update: {
          client_id?: string
          converted_invoice_id?: string | null
          created_at?: string | null
          id?: string
          issue_date?: string
          notes?: string | null
          number?: string | null
          status?: Database["public"]["Enums"]["quote_status"] | null
          subtotal?: number
          updated_at?: string | null
          user_id?: string
          valid_until?: string
        }
        Relationships: [
          {
            foreignKeyName: "quotes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_converted_invoice_id_fkey"
            columns: ["converted_invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_schedules: {
        Row: {
          client_id: string
          created_at: string
          day_of_month: number
          frequency: Database["public"]["Enums"]["recurring_frequency"]
          id: string
          is_active: boolean
          next_run_date: string
          notes: string | null
          payment_method: string
          payment_term_days: number
          template_lines: Json
          updated_at: string
          user_id: string
          vat_rate: number
        }
        Insert: {
          client_id: string
          created_at?: string
          day_of_month?: number
          frequency?: Database["public"]["Enums"]["recurring_frequency"]
          id?: string
          is_active?: boolean
          next_run_date: string
          notes?: string | null
          payment_method?: string
          payment_term_days?: number
          template_lines?: Json
          updated_at?: string
          user_id: string
          vat_rate?: number
        }
        Update: {
          client_id?: string
          created_at?: string
          day_of_month?: number
          frequency?: Database["public"]["Enums"]["recurring_frequency"]
          id?: string
          is_active?: boolean
          next_run_date?: string
          notes?: string | null
          payment_method?: string
          payment_term_days?: number
          template_lines?: Json
          updated_at?: string
          user_id?: string
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "recurring_schedules_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      dashboard_stats: {
        Row: {
          ca_encaisse: number | null
          ca_facture: number | null
          en_attente: number | null
          nb_en_attente: number | null
          nb_payees: number | null
          nb_total: number | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      generate_credit_note_number: {
        Args: { p_user_id: string; p_year: number }
        Returns: {
          credit_note_number: string
          seq_number: number
        }[]
      }
      generate_invoice_number: {
        Args: { p_user_id: string; p_year: number }
        Returns: {
          invoice_number: string
          seq_number: number
        }[]
      }
      generate_quote_number: {
        Args: { p_user_id: string; p_year: number }
        Returns: {
          quote_number: string
          seq_number: number
        }[]
      }
      mark_overdue_invoices: {
        Args: { p_user_id?: string }
        Returns: undefined
      }
    }
    Enums: {
      client_type: "PROFESSIONAL" | "INDIVIDUAL"
      frequency: "MONTHLY" | "QUARTERLY"
      invoice_status: "DRAFT" | "SENT" | "PAID" | "OVERDUE" | "CANCELLED"
      quote_status: "DRAFT" | "SENT" | "ACCEPTED" | "REFUSED" | "EXPIRED"
      recurring_frequency: "MONTHLY" | "QUARTERLY"
      vat_regime: "FRANCHISE" | "SUBJECT"
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
      client_type: ["PROFESSIONAL", "INDIVIDUAL"],
      frequency: ["MONTHLY", "QUARTERLY"],
      invoice_status: ["DRAFT", "SENT", "PAID", "OVERDUE", "CANCELLED"],
      quote_status: ["DRAFT", "SENT", "ACCEPTED", "REFUSED", "EXPIRED"],
      recurring_frequency: ["MONTHLY", "QUARTERLY"],
      vat_regime: ["FRANCHISE", "SUBJECT"],
    },
  },
} as const
