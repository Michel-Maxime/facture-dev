---
name: french-invoicing
description: French micro-enterprise invoicing rules, mandatory mentions, thresholds, VAT, cotisations. Auto-invoked when working on invoices, PDF, thresholds, tax, ledger.
---
# French micro-enterprise invoicing (2026)
## 13 mandatory PDF mentions (15€ fine each)
1. "Facture" 2. Sequential number FAC-{YEAR}-{SEQ} 3. Issue date 4. Service date 5. Seller (name+address+SIRET+"EI") 6. Client (name+address+SIRET if pro) 7. Line items (desc+qty+price+amount) 8. Subtotal HT 9. "TVA non applicable, article 293 B du CGI" (if franchise) 10. Payment terms 11. Late penalties rate 12. "Indemnité forfaitaire pour frais de recouvrement : 40 €" (B2B) 13. IBAN+BIC
## Thresholds 2026
Micro ceiling: 83600€. VAT franchise: 37500€. VAT majored: 41250€. Prorata 1st year: threshold × (remaining_days/365). Alert at 80% and 95%.
## Cotisations: BNC/SSI 25.6%, CFP 0.2%, VFL 2.2%. ACRE: halved first year.
## Numbering: atomic PostgreSQL function, assigned at DRAFT→SENT, continuous, no gaps.
## Immutability: DRAFT=editable, SENT/PAID/OVERDUE/CANCELLED=IMMUTABLE (RLS enforced). Correct via credit note + new invoice.
## Ledger: auto from paid invoices. Columns: date encaissement, ref, client, nature, montant, mode.
