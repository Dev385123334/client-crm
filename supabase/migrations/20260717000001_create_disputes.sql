-- ============================================================
-- Disputes table — tracks chargebacks, disputes, and refunds
-- ============================================================

create table if not exists disputes (
  id uuid default gen_random_uuid() primary key,
  date text not null,
  amount numeric not null,
  platform text not null default 'PayPal',
  reason text default '',
  status text not null default 'Open' check (status in ('Open', 'Resolved', 'Written Off')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table disputes enable row level security;

drop policy if exists "authenticated_all" on disputes;
create policy "authenticated_all"
  on disputes
  for all
  to authenticated
  using (true)
  with check (true);

create index if not exists idx_disputes_date on disputes(date);

-- Seed entries
INSERT INTO disputes (id, date, amount, platform, reason, status)
VALUES
  (gen_random_uuid(), '2026-02-20', 102000.00, 'PayPal', 'Payment dispute — paid back to client', 'Resolved'),
  (gen_random_uuid(), '2026-02-20', 34740.00, 'Unknown/Bank', 'Unexplained deduction, confirmed by owner to subtract', 'Resolved');
