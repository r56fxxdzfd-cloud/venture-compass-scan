-- Fase 1 RBAC (Darwin Growth / Conselho OS)
-- Safe + idempotent migration focused on global roles and sensitive-parameter protection.

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'demo_user';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'user';

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'super_admin'::public.app_role
  );
$$;

CREATE OR REPLACE FUNCTION public.is_jv_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('jv_admin'::public.app_role, 'super_admin'::public.app_role)
  );
$$;

CREATE OR REPLACE FUNCTION public.is_demo_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'demo_user'::public.app_role
  );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_sensitive_parameters(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public
AS $$
  SELECT public.is_super_admin(_user_id);
$$;

CREATE OR REPLACE FUNCTION public.can_operate_platform(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public
AS $$
  SELECT public.is_super_admin(_user_id) OR public.has_role(_user_id, 'jv_admin'::public.app_role);
$$;

CREATE OR REPLACE FUNCTION public.can_access_demo_data(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public
AS $$
  SELECT public.is_demo_user(_user_id) OR public.can_operate_platform(_user_id);
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_analyst(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public
AS $$
  SELECT public.can_operate_platform(_user_id);
$$;

CREATE OR REPLACE FUNCTION public.is_jv_member(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN (
        'super_admin'::public.app_role,
        'jv_admin'::public.app_role,
        'jv_analyst'::public.app_role,
        'jv_viewer'::public.app_role,
        'demo_user'::public.app_role,
        'user'::public.app_role
      )
  );
$$;

-- Sensitive configuration write: super admin only.
DROP POLICY IF EXISTS "Admins write configs" ON public.config_versions;
DROP POLICY IF EXISTS "Admins update configs" ON public.config_versions;
DROP POLICY IF EXISTS "Admins delete configs" ON public.config_versions;

CREATE POLICY "Super admin write configs" ON public.config_versions
FOR INSERT
WITH CHECK (public.can_manage_sensitive_parameters(auth.uid()) AND public.is_approved_member(auth.uid()));

CREATE POLICY "Super admin update configs" ON public.config_versions
FOR UPDATE
USING (public.can_manage_sensitive_parameters(auth.uid()) AND public.is_approved_member(auth.uid()))
WITH CHECK (public.can_manage_sensitive_parameters(auth.uid()) AND public.is_approved_member(auth.uid()));

CREATE POLICY "Super admin delete configs" ON public.config_versions
FOR DELETE
USING (public.can_manage_sensitive_parameters(auth.uid()) AND public.is_approved_member(auth.uid()));

DROP POLICY IF EXISTS "Admins write dimensions" ON public.dimensions;
DROP POLICY IF EXISTS "Admins update dimensions" ON public.dimensions;
DROP POLICY IF EXISTS "Admins delete dimensions" ON public.dimensions;

CREATE POLICY "Super admin write dimensions" ON public.dimensions
FOR INSERT
WITH CHECK (public.can_manage_sensitive_parameters(auth.uid()) AND public.is_approved_member(auth.uid()));

CREATE POLICY "Super admin update dimensions" ON public.dimensions
FOR UPDATE
USING (public.can_manage_sensitive_parameters(auth.uid()) AND public.is_approved_member(auth.uid()))
WITH CHECK (public.can_manage_sensitive_parameters(auth.uid()) AND public.is_approved_member(auth.uid()));

CREATE POLICY "Super admin delete dimensions" ON public.dimensions
FOR DELETE
USING (public.can_manage_sensitive_parameters(auth.uid()) AND public.is_approved_member(auth.uid()));

DROP POLICY IF EXISTS "Admins write questions" ON public.questions;
DROP POLICY IF EXISTS "Admins update questions" ON public.questions;
DROP POLICY IF EXISTS "Admins delete questions" ON public.questions;

CREATE POLICY "Super admin write questions" ON public.questions
FOR INSERT
WITH CHECK (public.can_manage_sensitive_parameters(auth.uid()) AND public.is_approved_member(auth.uid()));

CREATE POLICY "Super admin update questions" ON public.questions
FOR UPDATE
USING (public.can_manage_sensitive_parameters(auth.uid()) AND public.is_approved_member(auth.uid()))
WITH CHECK (public.can_manage_sensitive_parameters(auth.uid()) AND public.is_approved_member(auth.uid()));

CREATE POLICY "Super admin delete questions" ON public.questions
FOR DELETE
USING (public.can_manage_sensitive_parameters(auth.uid()) AND public.is_approved_member(auth.uid()));

DROP POLICY IF EXISTS "Admins write red_flags" ON public.red_flags;
DROP POLICY IF EXISTS "Admins update red_flags" ON public.red_flags;
DROP POLICY IF EXISTS "Admins delete red_flags" ON public.red_flags;

CREATE POLICY "Super admin write red_flags" ON public.red_flags
FOR INSERT
WITH CHECK (public.can_manage_sensitive_parameters(auth.uid()) AND public.is_approved_member(auth.uid()));

CREATE POLICY "Super admin update red_flags" ON public.red_flags
FOR UPDATE
USING (public.can_manage_sensitive_parameters(auth.uid()) AND public.is_approved_member(auth.uid()))
WITH CHECK (public.can_manage_sensitive_parameters(auth.uid()) AND public.is_approved_member(auth.uid()));

CREATE POLICY "Super admin delete red_flags" ON public.red_flags
FOR DELETE
USING (public.can_manage_sensitive_parameters(auth.uid()) AND public.is_approved_member(auth.uid()));
