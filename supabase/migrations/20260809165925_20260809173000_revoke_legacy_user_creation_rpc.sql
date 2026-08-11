/*
# Remove legacy user creation endpoint

1. Overview
- Removes remote execution access to the earlier SQL user-creation function.
- User creation now runs through the authenticated, superadmin-checked Edge Function.

2. Security
- Revokes EXECUTE from authenticated and anon for `admin_create_user`.
- Existing role-change and delete functions remain available only to authenticated callers and continue checking the caller's superadmin role internally.

3. Important Notes
- Existing users and profiles are unchanged.
- The protected user-management flow is the only supported way to create accounts from the panel.
*/

REVOKE EXECUTE ON FUNCTION admin_create_user(text,text,text,text) FROM anon, authenticated;