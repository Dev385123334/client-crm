alter table monthly_client_records
  add column if not exists phone text not null default '',
  add column if not exists email text not null default '';

alter table monthly_client_records
  alter column phone set default '',
  alter column email set default '';
