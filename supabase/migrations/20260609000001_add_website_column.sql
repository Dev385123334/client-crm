alter table monthly_client_records
  add column if not exists website text not null default '';
