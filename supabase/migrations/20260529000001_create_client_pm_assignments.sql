-- Table to control which PM editors can see which clients
-- Admin assigns clients to PMs here
CREATE TABLE IF NOT EXISTS client_pm_assignments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_name text NOT NULL,
  assigned_pm text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(business_name, assigned_pm)
);

ALTER TABLE client_pm_assignments ENABLE ROW LEVEL SECURITY;

-- Admins can read and write all rows
CREATE POLICY "admins_all"
  ON client_pm_assignments
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- PM editors can only read their own assignments
CREATE POLICY "pm_read_assigned"
  ON client_pm_assignments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE id = auth.uid() AND role = assigned_pm
    )
  );
