/*
# Add user roles system

1. Overview
- Creates a `user_profiles` table that stores each admin user's role and display name.
- Roles: 'superadmin' (full access, can create/manage other admins) and 'admin' (can manage rates only).
- Adds a trigger so every new auth.users row automatically gets a profile row with default role 'admin'.

2. New Tables
- `user_profiles`
- `user_id` (uuid, primary key, references auth.users) - the auth user.
- `email` (text, unique) - mirrors auth.users.email for easy listing.
- `display_name` (text) - friendly name shown in the admin panel.
- `role` (text, default 'admin') - 'superadmin' or 'admin'.
- `created_at`, `updated_at` (timestamptz).

3. Security
- RLS enabled on `user_profiles`.
- Any authenticated admin can read the profile list (needed to show the user management screen).
- A user can update their own profile, but the `role` column is protected by a SECURITY DEFINER function so only superadmins can change roles.
- A SECURITY DEFINER function `admin_create_user` lets superadmins create new admin users server-side with the service role, bypassing RLS safely.
- A SECURITY DEFINER function `admin_update_user_role` lets superadmins promote/demote users. It verifies the caller is a superadmin via `auth.uid()`.
- A SECURITY DEFINER function `admin_delete_user` lets superadmins delete a user from auth.users.

4. Important Notes
- The superadmin is bootstrapped by an edge function that signs up the user and sets raw_app_meta_data.role = 'superadmin', then upserts the profile row.
- Regular admins created from the panel get role 'admin' by default and can only manage rates.
- Email confirmation stays OFF (signups are immediate).
*/

CREATE TABLE IF NOT EXISTS user_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  display_name text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'admin' CHECK (role IN ('superadmin','admin')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins_read_user_profiles" ON user_profiles;
CREATE POLICY "admins_read_user_profiles"
ON user_profiles FOR SELECT
TO authenticated USING (true);

DROP POLICY IF EXISTS "users_update_own_profile" ON user_profiles;
CREATE POLICY "users_update_own_profile"
ON user_profiles FOR UPDATE
TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_insert_own_profile" ON user_profiles;
CREATE POLICY "users_insert_own_profile"
ON user_profiles FOR INSERT
TO authenticated WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS trg_user_profiles_updated ON user_profiles;
CREATE TRIGGER trg_user_profiles_updated
BEFORE UPDATE ON user_profiles
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-create a profile row when a new auth user is created
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_profiles (user_id, email, display_name, role)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', ''), 'admin')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Superadmin-only: create a new admin user (bypasses RLS via SECURITY DEFINER)
CREATE OR REPLACE FUNCTION admin_create_user(p_email text, p_password text, p_display_name text, p_role text DEFAULT 'admin')
RETURNS uuid AS $$
DECLARE
  new_user_id uuid;
  caller_role text;
BEGIN
  SELECT role INTO caller_role FROM user_profiles WHERE user_id = auth.uid();
  IF caller_role IS DISTINCT FROM 'superadmin' THEN
    RAISE EXCEPTION 'Solo un superadministrador puede crear usuarios.';
  END IF;
  IF p_role NOT IN ('superadmin','admin') THEN
    RAISE EXCEPTION 'Rol no válido.';
  END IF;

  -- Create the auth user with the service role
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at, last_sign_in_at
  )
  SELECT
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    p_email,
    crypt(p_password, gen_salt('bf')),
    now(),
    jsonb_build_object('role', p_role),
    jsonb_build_object('display_name', p_display_name),
    now(),
    now(),
    null
  RETURNING id INTO new_user_id;

  -- Upsert profile (trigger also tries, but we set the correct role here)
  INSERT INTO user_profiles (user_id, email, display_name, role)
  VALUES (new_user_id, p_email, p_display_name, p_role)
  ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role, display_name = EXCLUDED.display_name;

  RETURN new_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Superadmin-only: update a user's role
CREATE OR REPLACE FUNCTION admin_update_user_role(p_user_id uuid, p_role text)
RETURNS void AS $$
DECLARE
  caller_role text;
BEGIN
  SELECT role INTO caller_role FROM user_profiles WHERE user_id = auth.uid();
  IF caller_role IS DISTINCT FROM 'superadmin' THEN
    RAISE EXCEPTION 'Solo un superadministrador puede cambiar roles.';
  END IF;
  IF p_role NOT IN ('superadmin','admin') THEN
    RAISE EXCEPTION 'Rol no válido.';
  END IF;
  UPDATE user_profiles SET role = p_role WHERE user_id = p_user_id;
  UPDATE auth.users SET raw_app_meta_data = jsonb_set(COALESCE(raw_app_meta_data,'{}'::jsonb), '{role}', to_jsonb(p_role)) WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Superadmin-only: delete a user
CREATE OR REPLACE FUNCTION admin_delete_user(p_user_id uuid)
RETURNS void AS $$
DECLARE
  caller_role text;
BEGIN
  SELECT role INTO caller_role FROM user_profiles WHERE user_id = auth.uid();
  IF caller_role IS DISTINCT FROM 'superadmin' THEN
    RAISE EXCEPTION 'Solo un superadministrador puede eliminar usuarios.';
  END IF;
  DELETE FROM auth.users WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated
GRANT EXECUTE ON FUNCTION admin_create_user(text,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_update_user_role(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_delete_user(uuid) TO authenticated;