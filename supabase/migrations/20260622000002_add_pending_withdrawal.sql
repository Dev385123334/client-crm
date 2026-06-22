-- Add pending_withdrawal column to settings table
-- Tracks the current USD balance in Payoneer (manually entered by user)

alter table settings
  add column if not exists pending_withdrawal numeric not null default 0;
