-- Drop existing user_roles policies
DROP POLICY IF EXISTS "Admins manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins read all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users read own roles" ON public.user_roles;

-- READ: super_admin and jv_admin can read all; any user can read own
CREATE POLICY "Super admin and JV admin read all roles"
ON public.user_roles FOR SELECT
USING (public.is_super_admin(auth.uid()) OR public.is_jv_admin(auth.uid()));

CREATE POLICY "Users read own role"
ON public.user_roles FOR SELECT
USING (auth.uid() = user_id);

-- WRITE: only super_admin, and never allow creating another super_admin
CREATE POLICY "Super admin insert roles"
ON public.user_roles FOR INSERT
WITH CHECK (
  public.is_super_admin(auth.uid())
  AND (
    role <> 'super_admin'
    OR NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'super_admin')
  )
);

CREATE POLICY "Super admin update roles"
ON public.user_roles FOR UPDATE
USING (public.is_super_admin(auth.uid()))
WITH CHECK (
  public.is_super_admin(auth.uid())
  AND (
    role <> 'super_admin'
    OR user_id IN (SELECT user_id FROM public.user_roles WHERE role = 'super_admin')
  )
);

CREATE POLICY "Super admin delete roles"
ON public.user_roles FOR DELETE
USING (
  public.is_super_admin(auth.uid())
  AND NOT (
    role = 'super_admin'
    AND (SELECT COUNT(*) FROM public.user_roles WHERE role = 'super_admin') <= 1
  )
);