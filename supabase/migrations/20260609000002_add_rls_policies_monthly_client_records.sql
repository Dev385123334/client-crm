-- Allow authenticated users full access to monthly_client_records
-- (app-level role checks handle authorization)

ALTER TABLE monthly_client_records ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'monthly_client_records'
    AND policyname = 'authenticated_all'
  ) THEN
    CREATE POLICY "authenticated_all"
      ON monthly_client_records
      FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END
$$;
