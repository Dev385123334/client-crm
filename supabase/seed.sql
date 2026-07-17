-- ============================================================
-- Bank Deposit Log Updates
-- Run this in Supabase Dashboard > SQL Editor
-- ============================================================

-- 1. DELETE duplicate entries (keep only one of each)
-- Delete the duplicate on 11 Aug 2025 for ₹59,900.14
DELETE FROM bank_deposits
WHERE date = '2025-08-11' AND inr_amount = 59900.14;

-- Delete the duplicate on 11 Sep 2025 for ₹32,134.79
DELETE FROM bank_deposits
WHERE date = '2025-09-11' AND inr_amount = 32134.79;

-- 2. INSERT 10 new deposits
INSERT INTO bank_deposits (id, date, inr_amount, note) VALUES
  (gen_random_uuid(), '2024-12-09', 40465.35, 'Skydo (SRN-33241)'),
  (gen_random_uuid(), '2024-12-17', 11612.64, 'PayPal (6SK973986E8039044)'),
  (gen_random_uuid(), '2024-12-19', 122967.70, 'PayPal (client: GinsingHub)'),
  (gen_random_uuid(), '2025-08-07', 79826.01, 'PayPal (4MX32953T4949322A)'),
  (gen_random_uuid(), '2025-08-18', 49341.24, 'Skydo (SRN-94041)'),
  (gen_random_uuid(), '2025-08-18', 32894.16, 'Skydo (SRN-94040)'),
  (gen_random_uuid(), '2025-09-05', 25738.39, 'PayPal (90M04802R2908394G)'),
  (gen_random_uuid(), '2025-10-23', 33096.85, 'Skydo (SRN-127318)'),
  (gen_random_uuid(), '2026-06-02', 30379.64, 'PayPal (75953730Y3195901W)'),
  (gen_random_uuid(), '2026-06-04', 8678.75, 'PayPal (8KT77748XR901224X)');

-- 3. Verify: count should be 148
SELECT COUNT(*) AS total_deposits FROM bank_deposits;

-- 4. Verify: total sum
SELECT SUM(inr_amount) AS total_inr FROM bank_deposits;
