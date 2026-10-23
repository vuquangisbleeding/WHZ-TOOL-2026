create table if not exists public.customers (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.customers enable row level security;

drop policy if exists "Frontend can read customers" on public.customers;
create policy "Frontend can read customers"
  on public.customers for select
  to anon, authenticated
  using (true);

drop policy if exists "Frontend can insert customers" on public.customers;
create policy "Frontend can insert customers"
  on public.customers for insert
  to anon, authenticated
  with check (true);

drop policy if exists "Frontend can update customers" on public.customers;
create policy "Frontend can update customers"
  on public.customers for update
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "Frontend can delete customers" on public.customers;
create policy "Frontend can delete customers"
  on public.customers for delete
  to anon, authenticated
  using (true);
