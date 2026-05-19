-- Helper: is_demo_admin
CREATE OR REPLACE FUNCTION public.is_demo_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'demo_admin')
$$;

-- can_access_company: include demo_admin (demo-only)
CREATE OR REPLACE FUNCTION public.can_access_company(_company_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    public.is_super_admin(_user_id)
    OR public.is_jv_admin(_user_id)
    OR (
      (public.is_demo_user(_user_id) OR public.is_demo_admin(_user_id))
      AND EXISTS (SELECT 1 FROM public.companies c WHERE c.id = _company_id AND c.is_demo = true)
    )
$$;

-- can_operate_company: demo_admin can operate demo companies
CREATE OR REPLACE FUNCTION public.can_operate_company(_company_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    public.is_super_admin(_user_id)
    OR public.is_jv_admin(_user_id)
    OR (
      public.is_demo_admin(_user_id)
      AND EXISTS (SELECT 1 FROM public.companies c WHERE c.id = _company_id AND c.is_demo = true)
    )
$$;

-- Companies INSERT: demo_admin can only insert is_demo=true
DROP POLICY IF EXISTS "Operators write companies" ON public.companies;
CREATE POLICY "Operators write companies"
ON public.companies FOR INSERT TO public
WITH CHECK (
  public.is_super_admin(auth.uid())
  OR public.is_jv_admin(auth.uid())
  OR (public.is_demo_admin(auth.uid()) AND is_demo = true)
);

-- Companies UPDATE: prevent demo_admin from flipping is_demo to false
DROP POLICY IF EXISTS "Operators update companies" ON public.companies;
CREATE POLICY "Operators update companies"
ON public.companies FOR UPDATE TO public
USING (public.can_operate_company(id, auth.uid()))
WITH CHECK (
  public.is_super_admin(auth.uid())
  OR public.is_jv_admin(auth.uid())
  OR (public.is_demo_admin(auth.uid()) AND is_demo = true)
);
