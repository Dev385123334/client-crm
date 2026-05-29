-- Function to create a user_role entry during self-registration
-- Uses SECURITY DEFINER to bypass RLS (runs as the function owner)
-- Logic:
--   - If user_roles is empty (first ever user), any role is allowed (including admin)
--   - If user_roles has rows, only non-admin roles allowed unless caller is already an admin
CREATE OR REPLACE FUNCTION public.create_user_role(
  p_user_id uuid,
  p_email text,
  p_role text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_user_count bigint;
  v_current_uid uuid;
  v_is_admin boolean;
BEGIN
  SELECT COUNT(*) INTO v_user_count FROM public.user_roles;

  IF v_user_count = 0 THEN
    INSERT INTO public.user_roles (id, email, role)
    VALUES (p_user_id, p_email, p_role);
    RETURN;
  END IF;

  v_current_uid := auth.uid();

  IF p_role = 'admin' THEN
    IF v_current_uid IS NULL THEN
      RAISE EXCEPTION 'You must be signed in to create an admin account.';
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM public.user_roles WHERE id = v_current_uid AND role = 'admin'
    ) INTO v_is_admin;

    IF NOT v_is_admin THEN
      RAISE EXCEPTION 'Only existing admins can create new admin accounts.';
    END IF;
  END IF;

  INSERT INTO public.user_roles (id, email, role)
  VALUES (p_user_id, p_email, p_role);
END;
$$;

-- Grant execute permission so the function can be called via the Supabase API
GRANT EXECUTE ON FUNCTION public.create_user_role TO anon, authenticated;

-- ============================================================
-- Auto-create user_roles entry on signup via trigger on auth.users
-- Fires in the same transaction as the user insert, so the FK
-- constraint to auth.users(id) is always satisfied.
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_count bigint;
  v_role text;
BEGIN
  v_role := NEW.raw_app_meta_data ->> 'role';

  IF v_role IS NULL OR v_role NOT IN ('admin', 'pm_editor', 'hr_editor') THEN
    v_role := 'pm_editor';
  END IF;

  SELECT COUNT(*) INTO v_count FROM public.user_roles;

  IF v_count = 0 THEN
    INSERT INTO public.user_roles (id, email, role)
    VALUES (NEW.id, NEW.email, v_role);
    RETURN NEW;
  END IF;

  IF v_role = 'admin' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE id = auth.uid() AND role = 'admin'
    ) THEN
      v_role := 'pm_editor';
    END IF;
  END IF;

  INSERT INTO public.user_roles (id, email, role)
  VALUES (NEW.id, NEW.email, v_role);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Backfill roles for existing users who registered before the trigger was added
INSERT INTO public.user_roles (id, email, role)
SELECT
  u.id,
  u.email,
  CASE
    WHEN ROW_NUMBER() OVER (ORDER BY u.created_at) = 1 THEN 'admin'
    ELSE 'pm_editor'
  END AS role
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_roles r WHERE r.id = u.id
);
