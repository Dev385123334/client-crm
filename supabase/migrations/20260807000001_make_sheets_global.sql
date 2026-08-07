-- Make sheet_connections global (shared across ALL users) again.
-- Fixes: connected sheet UI only showing for the user who connected it.
-- Undoes the per-user lock added in 20260729_per_user_sheet_connections.sql.
-- Idempotent: safe to run whether the table is currently global or per-user.

-- 1. Drop per-user RLS policies (if present)
DROP POLICY IF EXISTS "users_select_own_sheets" ON sheet_connections;
DROP POLICY IF EXISTS "users_insert_own_sheets" ON sheet_connections;
DROP POLICY IF EXISTS "users_update_own_sheets" ON sheet_connections;
DROP POLICY IF EXISTS "users_delete_own_sheets" ON sheet_connections;

-- 2. Drop per-user constraints (if present)
ALTER TABLE sheet_connections DROP CONSTRAINT IF EXISTS sheet_connections_user_id_fkey;
ALTER TABLE sheet_connections DROP CONSTRAINT IF EXISTS sheet_connections_user_id_sheet_type_key;

-- 3. Collapse per-user rows into a single row per sheet_type (keep the most recently updated one)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'sheet_connections'
      AND column_name = 'user_id'
  ) THEN
    DELETE FROM sheet_connections a
    USING sheet_connections b
    WHERE a.sheet_type = b.sheet_type
      AND a.id <> b.id
      AND (a.updated_at < b.updated_at OR (a.updated_at = b.updated_at AND a.id < b.id));
  END IF;
END $$;

-- 4. Remove user_id column (no-op if already global)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'sheet_connections'
      AND column_name = 'user_id'
  ) THEN
    ALTER TABLE sheet_connections DROP COLUMN user_id;
  END IF;
END $$;

-- 5. Unique constraint on sheet_type alone (if not already present)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sheet_connections_sheet_type_key'
  ) THEN
    ALTER TABLE sheet_connections ADD CONSTRAINT sheet_connections_sheet_type_key UNIQUE (sheet_type);
  END IF;
END $$;

-- 6. Global RLS policies (every authenticated user sees and edits the same sheet)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'all_users_select_sheets' AND tablename = 'sheet_connections') THEN
    CREATE POLICY "all_users_select_sheets" ON sheet_connections FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'all_users_insert_sheets' AND tablename = 'sheet_connections') THEN
    CREATE POLICY "all_users_insert_sheets" ON sheet_connections FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'all_users_update_sheets' AND tablename = 'sheet_connections') THEN
    CREATE POLICY "all_users_update_sheets" ON sheet_connections FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'all_users_delete_sheets' AND tablename = 'sheet_connections') THEN
    CREATE POLICY "all_users_delete_sheets" ON sheet_connections FOR DELETE TO authenticated USING (true);
  END IF;
END $$;