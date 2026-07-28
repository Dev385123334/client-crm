-- Run this in Supabase SQL Editor (https://supabase.com/dashboard/project/vndpfwxshbbjjyrptuhn/sql/new)
-- Updates all Rent expenses from 'Monthly Recurring' to 'One-Time'

UPDATE expenses
SET frequency = 'One-Time', updated_at = now()
WHERE LOWER(name) LIKE '%rent%'
  AND frequency = 'Monthly Recurring';

-- Check what was updated
SELECT id, name, amount, frequency, month, year
FROM expenses
WHERE LOWER(name) LIKE '%rent%'
ORDER BY month, year;