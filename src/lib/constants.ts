export const THRESHOLDS = {
  microEnterprise: { services: 83_600, sales: 203_100 },
  vatFranchise: { services: 37_500, sales: 85_000 },
  vatMajored: { services: 41_250, sales: 93_500 },
  dedicatedBankAccount: 10_000,
} as const

export const COTISATION_RATES_2026 = {
  BNC_SSI: 0.256,
  BNC_CIPAV: 0.232,
  BIC_SERVICES: 0.212,
  BIC_VENTE: 0.123,
  CFP: 0.002,
  VFL_BNC: 0.022,
  VFL_BIC_SERVICES: 0.017,
  VFL_BIC_VENTE: 0.01,
} as const

export const INVOICE_MENTIONS = {
  vatExemption: "TVA non applicable, article 293 B du Code Général des Impôts",
  recoveryIndemnity: "Indemnité forfaitaire pour frais de recouvrement : 40 €",
  latePaymentRate: "Pénalités de retard : 3 fois le taux d'intérêt légal",
  eiMention: "Entrepreneur individuel",
} as const

export const ALERT_THRESHOLDS = { warning: 0.80, danger: 0.95 } as const

export function getProratedThreshold(annual: number, companyCreatedAt: Date): number {
  const year = new Date().getFullYear()
  const startOfYear = new Date(year, 0, 1)
  const creationDate = companyCreatedAt > startOfYear ? companyCreatedAt : startOfYear
  const daysRemaining = Math.ceil(
    (new Date(year, 11, 31).getTime() - creationDate.getTime()) / 86_400_000,
  )
  return Math.round(annual * (daysRemaining / 365))
}

/**
 * ACRE reform — LSFSS 2026
 * Before July 1st 2026: ACRE is automatic, 50% reduction for 12 months.
 * After July 1st 2026: ACRE restricted to eligible populations, 25% reduction for 12 months.
 */
export const ACRE_REFORM_DATE = '2026-07-01' as const

export const ACRE_RATES = {
  /** Reduction rate before reform: cotisations × (1 - 0.5) = half rate */
  BEFORE_REFORM: 0.5,
  /** Reduction rate after reform: cotisations × (1 - 0.25) = 75% of full rate */
  AFTER_REFORM: 0.25,
} as const
