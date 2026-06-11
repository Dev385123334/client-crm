-- Allow authenticated users full access to team_members table

ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'team_members'
    AND policyname = 'authenticated_all'
  ) THEN
    CREATE POLICY "authenticated_all"
      ON team_members
      FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END
$$;
