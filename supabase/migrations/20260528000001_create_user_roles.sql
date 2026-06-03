-- Create user_roles table
CREATE TABLE IF NOT EXISTS user_roles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL CHECK (role = 'admin' OR role = 'hr_editor' OR role ~ '^pm[0-9]*_editor$'),
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Function to check if a user has admin role (used in policies)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- Policy: Users can select their own row
CREATE POLICY "users_select_own"
  ON user_roles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- Policy: Admins can select all rows
CREATE POLICY "admins_select_all"
  ON user_roles
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Policy: Admins can insert rows
CREATE POLICY "admins_insert"
  ON user_roles
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- Policy: Admins can update rows
CREATE POLICY "admins_update"
  ON user_roles
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Policy: Admins can delete rows
CREATE POLICY "admins_delete"
  ON user_roles
  FOR DELETE
  TO authenticated
  USING (public.is_admin());
