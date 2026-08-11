/*
# Fix automatic user profile creation

1. Overview
- Makes the auth-to-profile trigger use an explicit schema and search path.
- Prevents a profile trigger lookup from interrupting normal Supabase account creation.

2. Modified Functions
- `handle_new_user()` now runs with `search_path = public` and explicitly references `public.user_profiles`.

3. Security
- The trigger remains SECURITY DEFINER and only copies the newly created user's own auth fields into the matching profile row.
- No public execute grant is added.

4. Important Notes
- This change preserves existing profiles and does not remove users or rate data.
*/

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (user_id, email, display_name, role)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', ''), COALESCE(NEW.raw_app_meta_data->>'role', 'admin'))
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();