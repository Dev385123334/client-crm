-- Allow authenticated users full access to settings and sync_logs tables

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'settings'
  ) THEN RETURN; END IF;

  ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'settings' AND policyname = 'authenticated_all'
  ) THEN
    CREATE POLICY "authenticated_all"
      ON settings
      FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'sync_logs'
  ) THEN RETURN; END IF;

  ALTER TABLE sync_logs ENABLE ROW LEVEL SECURITY;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'sync_logs' AND policyname = 'authenticated_all'
  ) THEN
    CREATE POLICY "authenticated_all"
      ON sync_logs
      FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END
$$;
