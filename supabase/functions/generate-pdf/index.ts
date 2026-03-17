import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { PDFDocument, rgb, StandardFonts } from "npm:pdf-lib@1.17.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
}

function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat('fr-FR').format(new Date(dateStr));
}

async function buildInvoicePdf(invoice: any, lines: any[], client: any, profile: any): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]); // A4
  const { width, height } = page.getSize();

  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const purple = rgb(0.486, 0.227, 0.929); // #7C3AED
  const gray = rgb(0.42, 0.447, 0.502);    // #6B7280
  const black = rgb(0.067, 0.094, 0.153);  // #111827
  const lightGray = rgb(0.953, 0.953, 0.965); // #F3F4F6

  let y = height - 50;
  const marginL = 50;
  const marginR = width - 50;

  // ── HEADER ────────────────────────────────────────────────────────────
  page.drawText(`${profile.first_name} ${profile.last_name}`, {
    x: marginL, y, font: fontBold, size: 18, color: purple,
  });
  page.drawText('FACTURE', {
    x: marginR - 120, y, font: fontBold, size: 22, color: black,
  });

  y -= 18;
  page.drawText('Entrepreneur Individuel', { x: marginL, y, font: fontRegular, size: 9, color: gray });
  if (invoice.number) {
    page.drawText(invoice.number, { x: marginR - 120, y, font: fontBold, size: 13, color: purple });
  }

  y -= 14;
  page.drawText(`SIRET : ${profile.siret}`, { x: marginL, y, font: fontRegular, size: 9, color: gray });
  page.drawText(`Date d'émission : ${formatDate(invoice.issue_date)}`, { x: marginR - 180, y, font: fontRegular, size: 9, color: gray });

  y -= 12;
  page.drawText(`${profile.address}`, { x: marginL, y, font: fontRegular, size: 9, color: gray });
  page.drawText(`Date de prestation : ${formatDate(invoice.service_date)}`, { x: marginR - 180, y, font: fontRegular, size: 9, color: gray });

  y -= 12;
  page.drawText(`${profile.postal_code} ${profile.city}`, { x: marginL, y, font: fontRegular, size: 9, color: gray });
  page.drawText(`Échéance : ${formatDate(invoice.due_date)}`, { x: marginR - 180, y, font: fontRegular, size: 9, color: gray });

  if (profile.code_ape) {
    y -= 12;
    page.drawText(`Code APE : ${profile.code_ape}`, { x: marginL, y, font: fontRegular, size: 9, color: gray });
  }

  // ── SEPARATOR ─────────────────────────────────────────────────────────
  y -= 20;
  page.drawLine({ start: { x: marginL, y }, end: { x: marginR, y }, thickness: 0.5, color: lightGray });

  // ── CLIENT ────────────────────────────────────────────────────────────
  y -= 20;
  page.drawText('FACTURÉ À', { x: marginL, y, font: fontBold, size: 8, color: gray });
  y -= 14;
  page.drawText(client.name, { x: marginL, y, font: fontBold, size: 11, color: black });
  y -= 13;
  if (client.siret) {
    page.drawText(`SIRET : ${client.siret}`, { x: marginL, y, font: fontRegular, size: 9, color: gray });
    y -= 12;
  }
  page.drawText(client.address, { x: marginL, y, font: fontRegular, size: 9, color: gray });
  y -= 12;
  page.drawText(`${client.postal_code} ${client.city}`, { x: marginL, y, font: fontRegular, size: 9, color: gray });
  if (client.email) {
    y -= 12;
    page.drawText(client.email, { x: marginL, y, font: fontRegular, size: 9, color: gray });
  }

  // ── LINES TABLE ───────────────────────────────────────────────────────
  y -= 28;
  const colDesc = marginL;
  const colQty = 330;
  const colPU = 400;
  const colMt = 490;

  page.drawRectangle({ x: marginL, y: y - 4, width: marginR - marginL, height: 18, color: lightGray });
  page.drawText('Description', { x: colDesc, y, font: fontBold, size: 8, color: gray });
  page.drawText('Qté', { x: colQty, y, font: fontBold, size: 8, color: gray });
  page.drawText('P.U. HT', { x: colPU, y, font: fontBold, size: 8, color: gray });
  page.drawText('Montant HT', { x: colMt, y, font: fontBold, size: 8, color: gray });

  const sortedLines = [...lines].sort((a, b) => a.sort_order - b.sort_order);
  for (const line of sortedLines) {
    y -= 20;
    page.drawText(line.description.slice(0, 60), { x: colDesc, y, font: fontRegular, size: 9, color: black });
    page.drawText(String(line.quantity), { x: colQty, y, font: fontRegular, size: 9, color: black });
    page.drawText(formatCurrency(line.unit_price), { x: colPU, y, font: fontRegular, size: 9, color: black });
    page.drawText(formatCurrency(line.amount), { x: colMt, y, font: fontBold, size: 9, color: black });
    y -= 2;
    page.drawLine({ start: { x: marginL, y }, end: { x: marginR, y }, thickness: 0.3, color: lightGray });
  }

  // ── TOTALS ────────────────────────────────────────────────────────────
  y -= 20;
  const totalsX = 400;
  page.drawText('Sous-total HT', { x: totalsX, y, font: fontRegular, size: 9, color: gray });
  page.drawText(formatCurrency(invoice.subtotal), { x: marginR - 60, y, font: fontRegular, size: 9, color: black });

  if (invoice.vat_rate > 0) {
    y -= 14;
    page.drawText(`TVA (${(invoice.vat_rate * 100).toFixed(0)} %)`, { x: totalsX, y, font: fontRegular, size: 9, color: gray });
    page.drawText(formatCurrency(invoice.vat_amount), { x: marginR - 60, y, font: fontRegular, size: 9, color: black });
  }

  y -= 16;
  page.drawLine({ start: { x: totalsX, y: y + 2 }, end: { x: marginR, y: y + 2 }, thickness: 1, color: purple });
  y -= 4;
  page.drawText('Total TTC', { x: totalsX, y, font: fontBold, size: 11, color: purple });
  page.drawText(formatCurrency(invoice.total), { x: marginR - 70, y, font: fontBold, size: 11, color: purple });

  // ── PAYMENT INFO ──────────────────────────────────────────────────────
  y -= 30;
  page.drawRectangle({ x: marginL, y: y - 50, width: marginR - marginL, height: 70, borderColor: lightGray, borderWidth: 0.5 });
  y -= 4;
  page.drawText('RÈGLEMENT', { x: marginL + 10, y, font: fontBold, size: 8, color: gray });
  y -= 14;
  page.drawText(`Mode : ${invoice.payment_method}`, { x: marginL + 10, y, font: fontRegular, size: 9, color: black });
  page.drawText(`Délai : ${invoice.payment_term_days} jours`, { x: 250, y, font: fontRegular, size: 9, color: black });
  page.drawText(`Échéance : ${formatDate(invoice.due_date)}`, { x: 370, y, font: fontRegular, size: 9, color: black });
  if (profile.iban) {
    y -= 14;
    page.drawText(`IBAN : ${profile.iban}`, { x: marginL + 10, y, font: fontRegular, size: 9, color: black });
    if (profile.bic) {
      page.drawText(`BIC : ${profile.bic}`, { x: 350, y, font: fontRegular, size: 9, color: black });
    }
  }

  // ── LEGAL MENTIONS ────────────────────────────────────────────────────
  y -= 50;
  page.drawLine({ start: { x: marginL, y: y + 8 }, end: { x: marginR, y: y + 8 }, thickness: 0.3, color: lightGray });

  const mentionSize = 7.5;
  const mentionColor = gray;

  if (invoice.vat_rate === 0) {
    page.drawText('TVA non applicable, article 293 B du Code Général des Impôts', {
      x: marginL, y, font: fontRegular, size: mentionSize, color: mentionColor,
    });
    y -= 11;
  }
  page.drawText("Pénalités de retard : 3 fois le taux d'intérêt légal", {
    x: marginL, y, font: fontRegular, size: mentionSize, color: mentionColor,
  });
  y -= 11;
  page.drawText('Indemnité forfaitaire pour frais de recouvrement : 40 €', {
    x: marginL, y, font: fontRegular, size: mentionSize, color: mentionColor,
  });

  if (invoice.notes) {
    y -= 16;
    page.drawText(invoice.notes.slice(0, 120), { x: marginL, y, font: fontRegular, size: 8, color: gray });
  }

  return pdfDoc.save();
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Missing authorization' }, 401);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return json({ error: 'Unauthorized' }, 401);

  const { invoiceId } = await req.json();
  if (!invoiceId) return json({ error: 'invoiceId is required' }, 400);

  const [invoiceRes, linesRes, profileRes] = await Promise.all([
    supabase.from('invoices').select('*, clients(*)').eq('id', invoiceId).eq('user_id', user.id).single(),
    supabase.from('invoice_lines').select('*').eq('invoice_id', invoiceId).order('sort_order'),
    supabase.from('profiles').select('*').eq('id', user.id).single(),
  ]);

  if (invoiceRes.error || !invoiceRes.data) return json({ error: 'Invoice not found' }, 404);
  if (profileRes.error || !profileRes.data) return json({ error: 'Profile not found' }, 404);

  const invoice = invoiceRes.data;
  const client = invoice.clients;
  const profile = profileRes.data;
  const lines = linesRes.data ?? [];

  if (!client) return json({ error: 'Client not found' }, 404);
  if (!invoice.number) return json({ error: 'Invoice has no number — emit it first' }, 422);

  const pdfBytes = await buildInvoicePdf(invoice, lines, client, profile);

  const storagePath = `${user.id}/${invoice.number}.pdf`;
  const { error: uploadError } = await supabase.storage
    .from('invoices')
    .upload(storagePath, pdfBytes, {
      contentType: 'application/pdf',
      upsert: true,
    });

  if (uploadError) {
    return json({ error: `Storage upload failed: ${uploadError.message}` }, 500);
  }

  const { error: updateError } = await supabase
    .from('invoices')
    .update({ pdf_url: storagePath, updated_at: new Date().toISOString() })
    .eq('id', invoiceId);

  if (updateError) {
    return json({ error: `Failed to update pdf_url: ${updateError.message}` }, 500);
  }

  return json({ pdfUrl: storagePath });
});
