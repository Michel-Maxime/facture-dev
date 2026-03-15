-- 001_initial_schema.sql

-- Extension pour UUID
create extension if not exists "uuid-ossp";

-- Enum types
create type vat_regime as enum ('FRANCHISE', 'SUBJECT');
create type frequency as enum ('MONTHLY', 'QUARTERLY');
create type client_type as enum ('PROFESSIONAL', 'INDIVIDUAL');
create type invoice_status as enum ('DRAFT', 'SENT', 'PAID', 'OVERDUE', 'CANCELLED');
create type quote_status as enum ('DRAFT', 'SENT', 'ACCEPTED', 'REFUSED', 'EXPIRED');

-- Profiles (extends Supabase auth.users)
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  first_name text not null,
  last_name text not null,
  address text not null,
  city text not null,
  postal_code text not null,
  siret text not null,
  code_ape text,
  iban text,
  bic text,
  company_created_at date not null,
  vat_regime vat_regime default 'FRANCHISE',
  declaration_freq frequency default 'QUARTERLY',
  cotisation_rate numeric(5,3) default 0.256,
  logo_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Clients
create table clients (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  name text not null,
  type client_type default 'PROFESSIONAL',
  siret text,
  address text not null,
  city text not null,
  postal_code text not null,
  email text,
  phone text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Invoice sequence (atomic numbering per user per year)
create table invoice_sequences (
  user_id uuid references profiles(id) on delete cascade,
  year int not null,
  last_number int default 0,
  primary key (user_id, year)
);

-- Invoices
create table invoices (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  client_id uuid references clients(id) not null,
  number text unique,              -- FAC-2026-001 (null while DRAFT)
  sequence_number int,             -- 1, 2, 3...
  status invoice_status default 'DRAFT',
  issue_date date not null,
  service_date date not null,
  due_date date not null,
  payment_term_days int default 30,
  payment_method text default 'Virement bancaire',
  subtotal numeric(10,2) not null,
  vat_rate numeric(5,3) default 0,
  vat_amount numeric(10,2) default 0,
  total numeric(10,2) not null,
  notes text,
  pdf_url text,                    -- URL du PDF dans Supabase Storage
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Invoice lines
create table invoice_lines (
  id uuid default uuid_generate_v4() primary key,
  invoice_id uuid references invoices(id) on delete cascade not null,
  description text not null,
  quantity numeric(10,2) not null,
  unit_price numeric(10,2) not null,
  amount numeric(10,2) not null,
  sort_order int default 0
);

-- Payments
create table payments (
  id uuid default uuid_generate_v4() primary key,
  invoice_id uuid references invoices(id) not null,
  amount numeric(10,2) not null,
  date date not null,
  method text not null,
  reference text,
  created_at timestamptz default now()
);

-- Quote sequence
create table quote_sequences (
  user_id uuid references profiles(id) on delete cascade,
  year int not null,
  last_number int default 0,
  primary key (user_id, year)
);

-- Quotes
create table quotes (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  client_id uuid references clients(id) not null,
  number text unique,
  status quote_status default 'DRAFT',
  issue_date date not null,
  valid_until date not null,
  subtotal numeric(10,2) not null,
  notes text,
  converted_invoice_id uuid references invoices(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Quote lines
create table quote_lines (
  id uuid default uuid_generate_v4() primary key,
  quote_id uuid references quotes(id) on delete cascade not null,
  description text not null,
  quantity numeric(10,2) not null,
  unit_price numeric(10,2) not null,
  amount numeric(10,2) not null,
  sort_order int default 0
);

-- Audit log (IMMUTABLE — no update, no delete)
create table audit_logs (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  action text not null,
  entity text not null,
  entity_id uuid not null,
  details jsonb,
  created_at timestamptz default now()
);

-- Indexes
create index idx_invoices_user on invoices(user_id);
create index idx_invoices_client on invoices(client_id);
create index idx_invoices_status on invoices(status);
create index idx_clients_user on clients(user_id);
create index idx_payments_invoice on payments(invoice_id);
create index idx_audit_user on audit_logs(user_id);
