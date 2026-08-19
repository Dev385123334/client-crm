-- Add extra_charges column for one-time additional work charges
alter table monthly_client_records
  add column if not exists extra_charges numeric not null default 0;
