-- Migration 013: recurring invoice schedules

CREATE TYPE public.recurring_frequency AS ENUM ('MONTHLY', 'QUARTERLY');

CREATE TABLE public.recurring_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,

  -- Schedule config
  frequency recurring_frequency NOT NULL DEFAULT 'MONTHLY',
  day_of_month INTEGER NOT NULL DEFAULT 1
    CONSTRAINT day_of_month_range CHECK (day_of_month BETWEEN 1 AND 28),
  next_run_date DATE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Invoice template
  template_lines JSONB NOT NULL DEFAULT '[]'::jsonb,
    -- Each element: { description: string, quantity: number, unit_price: number, amount: number, sort_order: number }
  payment_term_days INTEGER NOT NULL DEFAULT 30,
  payment_method TEXT NOT NULL DEFAULT 'Virement bancaire',
  vat_rate NUMERIC(5,4) NOT NULL DEFAULT 0,
  notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_recurring_schedules_user_id ON public.recurring_schedules(user_id);
CREATE INDEX idx_recurring_schedules_next_run ON public.recurring_schedules(next_run_date) WHERE is_active = true;

-- RLS
ALTER TABLE public.recurring_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD their own recurring schedules"
  ON public.recurring_schedules
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- updated_at trigger
CREATE OR REPLACE FUNCTION update_recurring_schedules_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_recurring_schedules_updated_at
  BEFORE UPDATE ON public.recurring_schedules
  FOR EACH ROW EXECUTE FUNCTION update_recurring_schedules_updated_at();
