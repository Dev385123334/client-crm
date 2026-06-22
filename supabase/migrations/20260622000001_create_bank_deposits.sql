-- ============================================================
-- Bank Deposit Log table
-- Tracks actual INR amounts credited to the user's Indian bank
-- account from Payoneer withdrawals. This is the single source
-- of truth for "cash in hand" — no estimation, no flat %.
-- ============================================================

create table if not exists bank_deposits (
  id uuid default gen_random_uuid() primary key,
  date text not null,
  inr_amount numeric not null,
  note text default null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table bank_deposits enable row level security;

drop policy if exists "authenticated_all" on bank_deposits;
create policy "authenticated_all"
  on bank_deposits
  for all
  to authenticated
  using (true)
  with check (true);

create index if not exists idx_bank_deposits_date on bank_deposits(date);
