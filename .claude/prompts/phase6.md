Read PRD.md and CLAUDE.md. Phase 6: Server-side PDF generation and Supabase Storage.

1. Create a Supabase Storage bucket named 'invoices' with RLS policy: authenticated users can read files in their own user_id folder.

2. Create Edge Function 'generate-pdf/index.ts':
   - Accepts invoiceId in body
   - Fetches invoice, lines, client, profile from Supabase (service role)
   - Reuses the same HTML template logic from src/utils/pdf-template.ts (keep it DRY by extracting shared template)
   - Converts HTML to PDF (use jsr:@nicholascoole/html-to-pdf or similar Deno-compatible lib)
   - Uploads PDF to storage at 'invoices/{user_id}/{invoice_number}.pdf'
   - Updates invoice.pdf_url with the storage path
   - Returns the PDF URL

3. Update generate-invoice-number Edge Function: after assigning the number and setting status to SENT, call generate-pdf internally or chain the call.

4. Update usePdf.ts composable: add a downloadStoredPdf() method that fetches from pdf_url if available, falling back to client-side generation for drafts.

5. Update the invoice detail page ([id].vue): show 'Download PDF' button that uses the stored PDF URL when available.

6. Update send-invoice-email Edge Function: attach the PDF from Storage to the email (Resend supports attachments via base64).

7. Write tests:
   - PDF is generated and stored when invoice is emitted
   - pdf_url is populated after emission
   - Email contains PDF attachment

Success criteria:
- Emitting an invoice generates a PDF stored in Supabase Storage
- pdf_url is set on the invoice record
- PDF can be downloaded from storage
- Email includes PDF as attachment
- All 13 mandatory mentions present in generated PDF

Output <promise>PHASE6_DONE</promise>
