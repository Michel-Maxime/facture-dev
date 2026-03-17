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
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          first_name: string
          last_name: string
          address: string
          city: string
          postal_code: string
          siret: string
          code_ape: string | null
          iban: string | null
          bic: string | null
          company_created_at: string
          vat_regime: 'FRANCHISE' | 'SUBJECT'
          declaration_freq: 'MONTHLY' | 'QUARTERLY'
          cotisation_rate: number
          logo_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          first_name: string
          last_name: string
          address: string
          city: string
          postal_code: string
          siret: string
          code_ape?: string | null
          iban?: string | null
          bic?: string | null
          company_created_at: string
          vat_regime?: 'FRANCHISE' | 'SUBJECT'
          declaration_freq?: 'MONTHLY' | 'QUARTERLY'
          cotisation_rate?: number
          logo_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          first_name?: string
          last_name?: string
          address?: string
          city?: string
          postal_code?: string
          siret?: string
          code_ape?: string | null
          iban?: string | null
          bic?: string | null
          company_created_at?: string
          vat_regime?: 'FRANCHISE' | 'SUBJECT'
          declaration_freq?: 'MONTHLY' | 'QUARTERLY'
          cotisation_rate?: number
          logo_url?: string | null
          updated_at?: string
        }
      }
      clients: {
        Row: {
          id: string
          user_id: string
          name: string
          type: 'PROFESSIONAL' | 'INDIVIDUAL'
          siret: string | null
          address: string
          city: string
          postal_code: string
          email: string | null
          phone: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          type?: 'PROFESSIONAL' | 'INDIVIDUAL'
          siret?: string | null
          address: string
          city: string
          postal_code: string
          email?: string | null
          phone?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          type?: 'PROFESSIONAL' | 'INDIVIDUAL'
          siret?: string | null
          address?: string
          city?: string
          postal_code?: string
          email?: string | null
          phone?: string | null
          notes?: string | null
          updated_at?: string
        }
      }
      invoices: {
        Row: {
          id: string
          user_id: string
          client_id: string
          number: string | null
          sequence_number: number | null
          status: 'DRAFT' | 'SENT' | 'PAID' | 'OVERDUE' | 'CANCELLED'
          issue_date: string
          service_date: string
          due_date: string
          payment_term_days: number
          payment_method: string
          subtotal: number
          vat_rate: number
          vat_amount: number
          total: number
          notes: string | null
          pdf_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          client_id: string
          number?: string | null
          sequence_number?: number | null
          status?: 'DRAFT' | 'SENT' | 'PAID' | 'OVERDUE' | 'CANCELLED'
          issue_date: string
          service_date: string
          due_date: string
          payment_term_days?: number
          payment_method?: string
          subtotal: number
          vat_rate?: number
          vat_amount?: number
          total: number
          notes?: string | null
          pdf_url?: string | null
        }
        Update: {
          id?: string
          client_id?: string
          status?: 'DRAFT' | 'SENT' | 'PAID' | 'OVERDUE' | 'CANCELLED'
          issue_date?: string
          service_date?: string
          due_date?: string
          payment_term_days?: number
          payment_method?: string
          subtotal?: number
          vat_rate?: number
          vat_amount?: number
          total?: number
          notes?: string | null
          pdf_url?: string | null
          updated_at?: string
        }
      }
      invoice_lines: {
        Row: {
          id: string
          invoice_id: string
          description: string
          quantity: number
          unit_price: number
          amount: number
          sort_order: number
        }
        Insert: {
          id?: string
          invoice_id: string
          description: string
          quantity: number
          unit_price: number
          amount: number
          sort_order?: number
        }
        Update: {
          description?: string
          quantity?: number
          unit_price?: number
          amount?: number
          sort_order?: number
        }
      }
      payments: {
        Row: {
          id: string
          invoice_id: string
          amount: number
          date: string
          method: string
          reference: string | null
          created_at: string
        }
        Insert: {
          id?: string
          invoice_id: string
          amount: number
          date: string
          method: string
          reference?: string | null
        }
        Update: {
          amount?: number
          date?: string
          method?: string
          reference?: string | null
        }
      }
      quotes: {
        Row: {
          id: string
          user_id: string
          client_id: string
          number: string | null
          status: 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REFUSED' | 'EXPIRED'
          issue_date: string
          valid_until: string
          subtotal: number
          notes: string | null
          converted_invoice_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          client_id: string
          number?: string | null
          status?: 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REFUSED' | 'EXPIRED'
          issue_date: string
          valid_until: string
          subtotal: number
          notes?: string | null
          converted_invoice_id?: string | null
        }
        Update: {
          client_id?: string
          status?: 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REFUSED' | 'EXPIRED'
          issue_date?: string
          valid_until?: string
          subtotal?: number
          notes?: string | null
          converted_invoice_id?: string | null
          updated_at?: string
        }
      }
      quote_lines: {
        Row: {
          id: string
          quote_id: string
          description: string
          quantity: number
          unit_price: number
          amount: number
          sort_order: number
        }
        Insert: {
          id?: string
          quote_id: string
          description: string
          quantity: number
          unit_price: number
          amount: number
          sort_order?: number
        }
        Update: {
          description?: string
          quantity?: number
          unit_price?: number
          amount?: number
          sort_order?: number
        }
      }
      audit_logs: {
        Row: {
          id: string
          user_id: string
          action: string
          entity: string
          entity_id: string
          details: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          action: string
          entity: string
          entity_id: string
          details?: Json | null
        }
        Update: never
      }
      invoice_sequences: {
        Row: {
          user_id: string
          year: number
          last_number: number
        }
        Insert: {
          user_id: string
          year: number
          last_number?: number
        }
        Update: {
          last_number?: number
        }
      }
      quote_sequences: {
        Row: {
          user_id: string
          year: number
          last_number: number
        }
        Insert: {
          user_id: string
          year: number
          last_number?: number
        }
        Update: {
          last_number?: number
        }
      }
      credit_note_sequences: {
        Row: {
          user_id: string
          year: number
          last_number: number
        }
        Insert: {
          user_id: string
          year: number
          last_number?: number
        }
        Update: {
          last_number?: number
        }
      }
      credit_notes: {
        Row: {
          id: string
          user_id: string
          original_invoice_id: string
          number: string | null
          issue_date: string
          subtotal: number
          vat_rate: number
          vat_amount: number
          total: number
          status: 'DRAFT' | 'SENT'
          reason: string | null
          pdf_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          original_invoice_id: string
          number?: string | null
          issue_date: string
          subtotal: number
          vat_rate?: number
          vat_amount?: number
          total: number
          status?: 'DRAFT' | 'SENT'
          reason?: string | null
          pdf_url?: string | null
        }
        Update: {
          number?: string | null
          issue_date?: string
          subtotal?: number
          vat_rate?: number
          vat_amount?: number
          total?: number
          status?: 'DRAFT' | 'SENT'
          reason?: string | null
          pdf_url?: string | null
          updated_at?: string
        }
      }
      credit_note_lines: {
        Row: {
          id: string
          credit_note_id: string
          description: string
          quantity: number
          unit_price: number
          amount: number
          sort_order: number
        }
        Insert: {
          id?: string
          credit_note_id: string
          description: string
          quantity: number
          unit_price: number
          amount: number
          sort_order?: number
        }
        Update: {
          description?: string
          quantity?: number
          unit_price?: number
          amount?: number
          sort_order?: number
        }
      }
    }
    Views: {
      dashboard_stats: {
        Row: {
          user_id: string | null
          ca_encaisse: number | null
          ca_facture: number | null
          en_attente: number | null
          nb_en_attente: number | null
          nb_payees: number | null
          nb_total: number | null
        }
      }
    }
    Functions: {
      generate_invoice_number: {
        Args: { p_user_id: string; p_year: number }
        Returns: Array<{ seq_number: number; invoice_number: string }>
      }
      generate_quote_number: {
        Args: { p_user_id: string; p_year: number }
        Returns: Array<{ seq_number: number; quote_number: string }>
      }
      generate_credit_note_number: {
        Args: { p_user_id: string; p_year: number }
        Returns: Array<{ seq_number: number; credit_note_number: string }>
      }
    }
    Enums: {
      vat_regime: 'FRANCHISE' | 'SUBJECT'
      frequency: 'MONTHLY' | 'QUARTERLY'
      client_type: 'PROFESSIONAL' | 'INDIVIDUAL'
      invoice_status: 'DRAFT' | 'SENT' | 'PAID' | 'OVERDUE' | 'CANCELLED'
      quote_status: 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REFUSED' | 'EXPIRED'
    }
  }
}

// Convenience types
export type Profile = Database['public']['Tables']['profiles']['Row']
export type Client = Database['public']['Tables']['clients']['Row']
export type Invoice = Database['public']['Tables']['invoices']['Row']
export type InvoiceLine = Database['public']['Tables']['invoice_lines']['Row']
export type Payment = Database['public']['Tables']['payments']['Row']
export type Quote = Database['public']['Tables']['quotes']['Row']
export type QuoteLine = Database['public']['Tables']['quote_lines']['Row']
export type AuditLog = Database['public']['Tables']['audit_logs']['Row']
export type CreditNote = Database['public']['Tables']['credit_notes']['Row']
export type CreditNoteLine = Database['public']['Tables']['credit_note_lines']['Row']
export type CreditNoteStatus = Database['public']['Tables']['credit_notes']['Row']['status']
export type InvoiceStatus = Database['public']['Enums']['invoice_status']
export type QuoteStatus = Database['public']['Enums']['quote_status']
export type ClientType = Database['public']['Enums']['client_type']
export type VatRegime = Database['public']['Enums']['vat_regime']
