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

function computeNextRunDate(frequency: string, dayOfMonth: number, from: Date): string {
  const year = from.getFullYear()
  const month = from.getMonth()

  if (frequency === 'MONTHLY') {
    const nextMonth = month + 1
    const nextYear = nextMonth > 11 ? year + 1 : year
    const adjustedMonth = nextMonth > 11 ? 0 : nextMonth
    return `${nextYear}-${String(adjustedMonth + 1).padStart(2, '0')}-${String(dayOfMonth).padStart(2, '0')}`
  }

  // QUARTERLY
  const currentQuarter = Math.floor(month / 3)
  const nextQStart = (currentQuarter + 1) * 3
  let nextQYear = year
  let nextQMonth = nextQStart
  if (nextQMonth > 11) { nextQMonth = 0; nextQYear = year + 1 }
  return `${nextQYear}-${String(nextQMonth + 1).padStart(2, '0')}-${String(dayOfMonth).padStart(2, '0')}`
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

  const body = await req.json().catch(() => ({}));
  const { scheduleId } = body;

  const today = new Date().toISOString().slice(0, 10);

  // Fetch due schedules for this user
  let query = supabase
    .from('recurring_schedules')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .lte('next_run_date', today);

  if (scheduleId) {
    query = query.eq('id', scheduleId);
  }

  const { data: schedules, error: schedErr } = await query;
  if (schedErr) return json({ error: schedErr.message }, 500);
  if (!schedules || schedules.length === 0) return json({ invoicesCreated: 0 });

  let invoicesCreated = 0;

  for (const schedule of schedules) {
    const invoiceDate = today;
    const dueDate = new Date(Date.now() + schedule.payment_term_days * 86_400_000)
      .toISOString().slice(0, 10);

    const lines = schedule.template_lines as Array<{
      description: string; quantity: number; unit_price: number; amount: number; sort_order: number;
    }>;

    const subtotal = lines.reduce((sum: number, l: any) => sum + l.amount, 0);
    const vatAmount = subtotal * Number(schedule.vat_rate);
    const total = subtotal + vatAmount;

    // Create invoice
    const { data: invoice, error: invErr } = await supabase
      .from('invoices')
      .insert({
        user_id: user.id,
        client_id: schedule.client_id,
        issue_date: invoiceDate,
        service_date: invoiceDate,
        due_date: dueDate,
        payment_term_days: schedule.payment_term_days,
        payment_method: schedule.payment_method,
        vat_rate: Number(schedule.vat_rate),
        vat_amount: vatAmount,
        subtotal,
        total,
        notes: schedule.notes || null,
        status: 'DRAFT',
      })
      .select()
      .single();

    if (invErr || !invoice) continue;

    // Insert lines
    if (lines.length > 0) {
      await supabase.from('invoice_lines').insert(
        lines.map((l) => ({ ...l, invoice_id: invoice.id }))
      );
    }

    // Compute next run date
    const nextRun = computeNextRunDate(
      schedule.frequency,
      schedule.day_of_month,
      new Date(today),
    );

    // Update schedule
    await supabase
      .from('recurring_schedules')
      .update({ next_run_date: nextRun, updated_at: new Date().toISOString() })
      .eq('id', schedule.id);

    // Audit log
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action: 'CREATE_RECURRING_INVOICE',
      entity: 'invoices',
      entity_id: invoice.id,
      details: { schedule_id: schedule.id, next_run: nextRun },
    });

    invoicesCreated++;
  }

  return json({ invoicesCreated });
});
