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
