import { z } from 'zod'

export const clientSchema = z.object({
  name: z.string().min(1, 'Le nom est requis').max(200),
  type: z.enum(['PROFESSIONAL', 'INDIVIDUAL']),
  siret: z
    .string()
    .regex(/^\d{14}$/, 'Le SIRET doit contenir 14 chiffres')
    .optional()
    .or(z.literal('')),
  address: z.string().min(1, "L'adresse est requise"),
  city: z.string().min(1, 'La ville est requise'),
  postal_code: z
    .string()
    .regex(/^\d{5}$/, 'Le code postal doit contenir 5 chiffres'),
  email: z.string().email("L'email n'est pas valide").optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
})

export type ClientFormData = z.infer<typeof clientSchema>

export const profileSchema = z.object({
  first_name: z.string().min(1, 'Le prénom est requis'),
  last_name: z.string().min(1, 'Le nom est requis'),
  address: z.string().min(1, "L'adresse est requise"),
  city: z.string().min(1, 'La ville est requise'),
  postal_code: z.string().regex(/^\d{5}$/, 'Code postal invalide'),
  siret: z.string().regex(/^\d{14}$/, 'SIRET invalide (14 chiffres)'),
  code_ape: z.string().optional().or(z.literal('')),
  iban: z
    .string()
    .regex(/^[A-Z]{2}\d{2}[A-Z0-9]{1,30}$/, 'IBAN invalide')
    .optional()
    .or(z.literal('')),
  bic: z
    .string()
    .regex(/^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/, 'BIC invalide')
    .optional()
    .or(z.literal('')),
  company_created_at: z.string().min(1, 'La date de création est requise'),
  vat_regime: z.enum(['FRANCHISE', 'SUBJECT']),
  declaration_freq: z.enum(['MONTHLY', 'QUARTERLY']),
  cotisation_rate: z.number().min(0).max(1),
  is_acre: z.boolean().default(false),
  acre_public_eligible: z.boolean().default(false),
  facturx_enabled: z.boolean().default(true),
})

export type ProfileFormData = z.infer<typeof profileSchema>

export const invoiceLineSchema = z.object({
  description: z.string().min(1, 'La description est requise'),
  quantity: z.number().positive('La quantité doit être positive'),
  unit_price: z.number().min(0, 'Le prix unitaire doit être positif'),
  amount: z.number(),
  sort_order: z.number().int().default(0),
})

export const invoiceSchema = z.object({
  client_id: z.string().uuid('Veuillez sélectionner un client'),
  issue_date: z.string().min(1, "La date d'émission est requise"),
  service_date: z.string().min(1, 'La date de prestation est requise'),
  due_date: z.string().min(1, "La date d'échéance est requise"),
  payment_term_days: z.number().int().min(0).default(30),
  payment_method: z.string().min(1, 'Le mode de paiement est requis'),
  vat_rate: z.number().min(0).max(1).default(0),
  notes: z.string().optional().or(z.literal('')),
  lines: z.array(invoiceLineSchema).min(1, 'Au moins une ligne est requise'),
})

export type InvoiceFormData = z.infer<typeof invoiceSchema>

export const quoteLineSchema = z.object({
  description: z.string().min(1, 'La description est requise'),
  quantity: z.number().positive('La quantité doit être positive'),
  unit_price: z.number().min(0, 'Le prix unitaire doit être positif'),
  amount: z.number(),
  sort_order: z.number().int().default(0),
})

export const quoteSchema = z.object({
  client_id: z.string().uuid('Veuillez sélectionner un client'),
  issue_date: z.string().min(1, "La date d'émission est requise"),
  valid_until: z.string().min(1, 'La date de validité est requise'),
  notes: z.string().optional().or(z.literal('')),
  lines: z.array(quoteLineSchema).min(1, 'Au moins une ligne est requise'),
})

export type QuoteFormData = z.infer<typeof quoteSchema>

export const creditNoteSchema = z.object({
  original_invoice_id: z.string().uuid(),
  issue_date: z.string().min(1, "La date est requise"),
  reason: z.string().optional().or(z.literal('')),
  lines: z.array(invoiceLineSchema).min(1, 'Au moins une ligne est requise'),
})

export type CreditNoteFormData = z.infer<typeof creditNoteSchema>

export const loginSchema = z.object({
  email: z.string().email("L'email n'est pas valide"),
  password: z.string().min(6, 'Le mot de passe doit contenir au moins 6 caractères'),
})

export type LoginFormData = z.infer<typeof loginSchema>

export const registerSchema = z
  .object({
    email: z.string().email("L'email n'est pas valide"),
    password: z.string().min(6, 'Le mot de passe doit contenir au moins 6 caractères'),
    confirmPassword: z.string(),
    first_name: z.string().min(1, 'Le prénom est requis'),
    last_name: z.string().min(1, 'Le nom est requis'),
    siret: z.string().regex(/^\d{14}$/, 'SIRET invalide (14 chiffres)'),
    address: z.string().min(1, "L'adresse est requise"),
    city: z.string().min(1, 'La ville est requise'),
    postal_code: z.string().regex(/^\d{5}$/, 'Code postal invalide'),
    company_created_at: z.string().min(1, 'La date de création est requise'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Les mots de passe ne correspondent pas',
    path: ['confirmPassword'],
  })

export type RegisterFormData = z.infer<typeof registerSchema>
