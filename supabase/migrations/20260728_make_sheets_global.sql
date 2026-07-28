-- Make sheet_connections global (not per-user).
-- Removes user_id, changes unique constraint to sheet_type only,
-- updates RLS so all authenticated users see the same connection state.

-- 1. Drop old per-user RLS policies FIRST (they depend on user_id column)
DROP POLICY IF EXISTS "users_select_own_sheets" ON sheet_connections;
DROP POLICY IF EXISTS "users_insert_own_sheets" ON sheet_connections;
DROP POLICY IF EXISTS "users_update_own_sheets" ON sheet_connections;
DROP POLICY IF EXISTS "users_delete_own_sheets" ON sheet_connections;

-- 2. Drop FK constraint
ALTER TABLE sheet_connections DROP CONSTRAINT IF EXISTS sheet_connections_user_id_fkey;

-- 3. Drop old unique constraint on (user_id, sheet_type)
ALTER TABLE sheet_connections DROP CONSTRAINT IF EXISTS sheet_connections_user_id_sheet_type_key;

-- 4. Delete duplicate rows per sheet_type (might exist from per-user era)
DELETE FROM sheet_connections a
WHERE a.id IN (
  SELECT a.id FROM sheet_connections a
  JOIN sheet_connections b ON a.sheet_type = b.sheet_type
    AND (a.updated_at < b.updated_at OR (a.updated_at = b.updated_at AND a.id < b.id))
);

-- 5. Drop user_id column
ALTER TABLE sheet_connections DROP COLUMN user_id;

-- 6. Add unique constraint on sheet_type alone
ALTER TABLE sheet_connections ADD CONSTRAINT sheet_connections_sheet_type_key UNIQUE (sheet_type);

-- 6. Create new global RLS policies
CREATE POLICY "all_users_select_sheets" ON sheet_connections
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "all_users_insert_sheets" ON sheet_connections
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "all_users_update_sheets" ON sheet_connections
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "all_users_delete_sheets" ON sheet_connections
  FOR DELETE TO authenticated USING (true);

-- Verify
SELECT sheet_type, url, connected, status FROM sheet_connections ORDER BY sheet_type;