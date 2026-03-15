import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return json({ error: 'Missing authorization' }, 401);
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const { invoiceId, recipientEmail } = await req.json();
  if (!invoiceId) {
    return json({ error: 'invoiceId is required' }, 400);
  }

  // Fetch invoice with client and profile
  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .select('*, clients(*)')
    .eq('id', invoiceId)
    .eq('user_id', user.id)
    .single();

  if (invoiceError || !invoice) {
    return json({ error: 'Invoice not found' }, 404);
  }

  if (invoice.status === 'DRAFT') {
    return json({ error: 'Cannot send a DRAFT invoice by email' }, 422);
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('first_name, last_name, email')
    .eq('id', user.id)
    .single();

  const toEmail = recipientEmail ?? invoice.clients?.email;
  if (!toEmail) {
    return json({ error: 'No recipient email address available' }, 422);
  }

  const senderName = profile
    ? `${profile.first_name} ${profile.last_name}`
    : 'facture.dev';

  const resendKey = Deno.env.get('RESEND_API_KEY');
  if (!resendKey) {
    return json({ error: 'Email service not configured (missing RESEND_API_KEY)' }, 503);
  }

  const emailBody = {
    from: `${senderName} <noreply@facture.dev>`,
    to: [toEmail],
    subject: `Facture ${invoice.number}`,
    html: `
      <p>Bonjour,</p>
      <p>Veuillez trouver ci-joint la facture <strong>${invoice.number}</strong> d'un montant de ${new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(invoice.total)}.</p>
      <p>Date d'échéance : ${new Intl.DateTimeFormat('fr-FR').format(new Date(invoice.due_date))}</p>
      <p>Cordialement,<br>${senderName}</p>
    `,
  };

  const resendRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${resendKey}`,
    },
    body: JSON.stringify(emailBody),
  });

  if (!resendRes.ok) {
    const errBody = await resendRes.text();
    return json({ error: `Email send failed: ${errBody}` }, 502);
  }

  const resendData = await resendRes.json();

  // Audit log
  await supabase.from('audit_logs').insert({
    user_id: user.id,
    action: 'SEND_INVOICE_EMAIL',
    entity: 'invoices',
    entity_id: invoiceId,
    details: { to: toEmail, resend_id: resendData.id },
  });

  return json({ success: true, emailId: resendData.id });
});
