alter table monthly_client_records
  add column if not exists upsell_amount numeric not null default 0,
  add column if not exists downsell_amount numeric not null default 0;
