/*
# Habilitar cuentas de clientes

1. Cambios principales
- Agrega el rol `user` para clientes en `user_profiles`.
- Mantiene los roles `superadmin` y `admin` para el equipo interno.
- Permite que el disparador de registro use el rol indicado por el sistema de autenticación.

2. Seguridad
- Los clientes se crean con rol `user` y no reciben acceso al panel administrativo.
- Los administradores existentes conservan su rol actual.

3. Compatibilidad
- No elimina usuarios ni datos existentes.
- El cambio es compatible con los perfiles ya creados y con la creación de administradores desde el panel.
*/

ALTER TABLE public.user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_role_check;

ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_role_check
  CHECK (role IN ('superadmin', 'admin', 'user'));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (user_id, email, display_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', ''),
    COALESCE(NEW.raw_app_meta_data->>'role', 'user')
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();