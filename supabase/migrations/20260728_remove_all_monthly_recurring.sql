-- Run this in Supabase SQL Editor (https://supabase.com/dashboard/project/vndpfwxshbbjjyrptuhn/sql/new)
-- Removes Monthly Recurring from ALL expenses → changes to One-Time

UPDATE expenses
SET frequency = 'One-Time', updated_at = now()
WHERE frequency = 'Monthly Recurring';

-- Check results
SELECT COUNT(*) AS updated_count FROM expenses WHERE frequency = 'One-Time' AND updated_at > now() - interval '1 minute';
SELECT name, amount, frequency, month, year FROM expenses WHERE frequency = 'Monthly Recurring';