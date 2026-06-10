-- Sheet connections table (per-user, cross-device)
create table if not exists sheet_connections (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  sheet_type text not null check (sheet_type in ('client', 'expense')),
  url text not null default '',
  connected boolean not null default false,
  status text not null default 'disconnected',
  last_sync text not null default '',
  error text not null default '',
  found_tabs jsonb default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, sheet_type)
);

-- RLS
alter table sheet_connections enable row level security;

-- Users can read their own connections
drop policy if exists "users_select_own_sheets" on sheet_connections;
create policy "users_select_own_sheets"
  on sheet_connections
  for select
  to authenticated
  using (user_id = auth.uid());

-- Users can insert their own connections
drop policy if exists "users_insert_own_sheets" on sheet_connections;
create policy "users_insert_own_sheets"
  on sheet_connections
  for insert
  to authenticated
  with check (user_id = auth.uid());

-- Users can update their own connections
drop policy if exists "users_update_own_sheets" on sheet_connections;
create policy "users_update_own_sheets"
  on sheet_connections
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Users can delete their own connections
drop policy if exists "users_delete_own_sheets" on sheet_connections;
create policy "users_delete_own_sheets"
  on sheet_connections
  for delete
  to authenticated
  using (user_id = auth.uid());
