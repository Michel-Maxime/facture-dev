Read PRD.md and CLAUDE.md. Phase 7: Credit notes (avoirs) and draft editing.

1. Create migration 009_credit_notes.sql:
   - credit_note_sequences table (user_id, year, last_number)
   - credit_notes table: id, user_id, original_invoice_id (references invoices), number (AV-YEAR-SEQ), issue_date, subtotal, total, status (DRAFT/SENT), reason text, pdf_url, created_at, updated_at
   - credit_note_lines table: mirrors invoice_lines
   - RLS policies: user owns credit notes, immutability for non-DRAFT
   - PostgreSQL function generate_credit_note_number()

2. Create useCreditNotes.ts composable:
   - createCreditNote(originalInvoiceId): auto-populates from original invoice data (negative amounts)
   - emitCreditNote(): assigns number, generates PDF
   - Effect on original invoice: mark as CANCELLED after credit note is emitted

3. Add credit note UI:
   - Button on invoice detail page (SENT/OVERDUE status): 'Corriger (avoir)'
   - Credit note creation form (pre-filled, amounts negated)
   - Credit notes list page accessible from sidebar

4. Implement invoice draft editing:
   - Add 'Modifier' button on invoice detail when status is DRAFT
   - Route to /invoices/[id]/edit or reuse InvoiceForm with initialData
   - On submit: update invoice fields AND replace lines (delete old + insert new)
   - Recalculate subtotal, vat_amount, total

5. Add invoice duplication:
   - 'Dupliquer' button on invoice detail
   - Creates new DRAFT with same client, lines, but fresh dates

6. Write tests:
   - Credit note has correct AV-YEAR-SEQ numbering
   - Credit note references original invoice
   - Original invoice is CANCELLED after credit note emission
   - Draft invoice lines can be updated
   - Duplicated invoice is a separate DRAFT

Success criteria:
- Full credit note lifecycle works (create, emit, PDF)
- Draft invoices can be fully edited (including lines)
- Invoice duplication creates independent draft
- All audit logs generated

Output <promise>PHASE7_DONE</promise>
