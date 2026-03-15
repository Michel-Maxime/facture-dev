import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Missing authorization' }), { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Verify the JWT and get the user
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const { invoiceId } = await req.json();
  if (!invoiceId) {
    return new Response(JSON.stringify({ error: 'invoiceId is required' }), { status: 400 });
  }

  // Fetch the invoice to verify ownership and get issue_date
  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .select('id, user_id, status, issue_date')
    .eq('id', invoiceId)
    .single();

  if (invoiceError || !invoice) {
    return new Response(JSON.stringify({ error: 'Invoice not found' }), { status: 404 });
  }

  if (invoice.user_id !== user.id) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
  }

  if (invoice.status !== 'DRAFT') {
    return new Response(JSON.stringify({ error: 'Only DRAFT invoices can be emitted' }), { status: 422 });
  }

  const year = new Date(invoice.issue_date).getFullYear();

  // Atomically generate the invoice number
  const { data: seqResult, error: seqError } = await supabase
    .rpc('generate_invoice_number', { p_user_id: user.id, p_year: year });

  if (seqError || !seqResult || seqResult.length === 0) {
    return new Response(JSON.stringify({ error: 'Failed to generate invoice number' }), { status: 500 });
  }

  const { seq_number, invoice_number } = seqResult[0];

  // Update invoice: DRAFT → SENT with the assigned number
  const { data: updated, error: updateError } = await supabase
    .from('invoices')
    .update({
      status: 'SENT',
      number: invoice_number,
      sequence_number: seq_number,
      updated_at: new Date().toISOString(),
    })
    .eq('id', invoiceId)
    .eq('status', 'DRAFT') // extra safety check
    .select()
    .single();

  if (updateError || !updated) {
    return new Response(JSON.stringify({ error: 'Failed to emit invoice' }), { status: 500 });
  }

  // Insert audit log
  await supabase.from('audit_logs').insert({
    user_id: user.id,
    action: 'EMIT_INVOICE',
    entity: 'invoices',
    entity_id: invoiceId,
    details: { invoice_number, seq_number },
  });

  return new Response(
    JSON.stringify({ invoiceNumber: invoice_number, sequenceNumber: seq_number, invoice: updated }),
    { headers: { 'Content-Type': 'application/json' } },
  );
});
