-- Allow authenticated users full access to expenses table
-- (app-level role checks handle authorization)

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'expenses'
    AND policyname = 'authenticated_all'
  ) THEN
    CREATE POLICY "authenticated_all"
      ON expenses
      FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END
$$;
