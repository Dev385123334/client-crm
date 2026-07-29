-- Revert sheet_connections from global back to per-user.
-- Undoes 20260728_make_sheets_global.sql.
-- Each user owns their own sheet connections, stored in the database.

-- 1. Drop global RLS policies
DROP POLICY IF EXISTS "all_users_select_sheets" ON sheet_connections;
DROP POLICY IF EXISTS "all_users_insert_sheets" ON sheet_connections;
DROP POLICY IF EXISTS "all_users_update_sheets" ON sheet_connections;
DROP POLICY IF EXISTS "all_users_delete_sheets" ON sheet_connections;

-- 2. Drop unique constraint on sheet_type (global constraint)
ALTER TABLE sheet_connections DROP CONSTRAINT IF EXISTS sheet_connections_sheet_type_key;

-- 3. Add user_id column (FK to auth.users)
ALTER TABLE sheet_connections ADD COLUMN IF NOT EXISTS user_id uuid references auth.users(id) on delete cascade;

-- 4. Clear existing global data — it was shared incorrectly across all users
--    and cannot be reliably attributed to any single user.
DELETE FROM sheet_connections;

-- 5. Make user_id NOT NULL (now that existing rows are gone)
ALTER TABLE sheet_connections ALTER COLUMN user_id SET NOT NULL;

-- 6. Add unique constraint on (user_id, sheet_type) — each user can have
--    at most one client sheet and one expense sheet.
ALTER TABLE sheet_connections ADD CONSTRAINT sheet_connections_user_id_sheet_type_key UNIQUE (user_id, sheet_type);

-- 7. Create per-user RLS policies
CREATE POLICY "users_select_own_sheets" ON sheet_connections
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "users_insert_own_sheets" ON sheet_connections
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "users_update_own_sheets" ON sheet_connections
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "users_delete_own_sheets" ON sheet_connections
  FOR DELETE TO authenticated USING (user_id = auth.uid());
