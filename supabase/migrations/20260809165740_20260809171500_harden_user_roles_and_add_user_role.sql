/*
# Harden user roles and add regular users

1. Overview
- Adds the 'user' role so the superadministrator can create both administrators and regular users.
- Restricts privileged role-changing functions to authenticated superadmins only.
- Adds an explicit search path and execute grants to reduce function abuse risk.

2. Modified Tables
- `user_profiles.role` now allows 'superadmin', 'admin', or 'user'.
- Existing profile rows keep their current role.

3. Security
- Security-definer functions now use a fixed `public` search path.
- Anonymous users cannot execute user-management functions.
- Role changes remain server-checked against the caller's own profile.

4. Important Notes
- This migration does not delete users or alter existing rate data.
- The superadmin remains the only role allowed to create accounts or change roles.
*/

ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_role_check;
ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_role_check CHECK (role IN ('superadmin','admin','user'));

CREATE OR REPLACE FUNCTION admin_create_user(p_email text, p_password text, p_display_name text, p_role text DEFAULT 'admin')
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_user_id uuid;
  caller_role text;
BEGIN
  SELECT role INTO caller_role FROM public.user_profiles WHERE user_id = auth.uid();
  IF caller_role IS DISTINCT FROM 'superadmin' THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;
  IF p_email IS NULL OR length(trim(p_email)) < 5 OR p_password IS NULL OR length(p_password) < 8 THEN
    RAISE EXCEPTION 'Datos de usuario inválidos';
  END IF;
  IF p_role NOT IN ('superadmin','admin','user') THEN
    RAISE EXCEPTION 'Rol no válido';
  END IF;

  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  )
  SELECT
    '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
    lower(trim(p_email)), crypt(p_password, gen_salt('bf')), now(),
    jsonb_build_object('role', p_role), jsonb_build_object('display_name', trim(p_display_name)), now(), now()
  RETURNING id INTO new_user_id;

  INSERT INTO public.user_profiles (user_id, email, display_name, role)
  VALUES (new_user_id, lower(trim(p_email)), trim(p_display_name), p_role)
  ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role, display_name = EXCLUDED.display_name;

  RETURN new_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION admin_update_user_role(p_user_id uuid, p_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_role text;
BEGIN
  SELECT role INTO caller_role FROM public.user_profiles WHERE user_id = auth.uid();
  IF caller_role IS DISTINCT FROM 'superadmin' OR p_role NOT IN ('superadmin','admin','user') THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;
  UPDATE public.user_profiles SET role = p_role WHERE user_id = p_user_id;
  UPDATE auth.users SET raw_app_meta_data = jsonb_set(COALESCE(raw_app_meta_data,'{}'::jsonb), '{role}', to_jsonb(p_role)) WHERE id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION admin_delete_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_role text;
BEGIN
  SELECT role INTO caller_role FROM public.user_profiles WHERE user_id = auth.uid();
  IF caller_role IS DISTINCT FROM 'superadmin' OR p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;
  DELETE FROM auth.users WHERE id = p_user_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION admin_create_user(text,text,text,text) FROM anon;
REVOKE EXECUTE ON FUNCTION admin_update_user_role(uuid,text) FROM anon;
REVOKE EXECUTE ON FUNCTION admin_delete_user(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION admin_create_user(text,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_update_user_role(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_delete_user(uuid) TO authenticated;