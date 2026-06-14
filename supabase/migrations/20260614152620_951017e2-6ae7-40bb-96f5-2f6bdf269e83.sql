
-- Fix 1: require approved profile for jv_admin/super_admin in company access
CREATE OR REPLACE FUNCTION public.can_access_company(_company_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (
      (public.is_super_admin(_user_id) OR public.is_jv_admin(_user_id))
      AND public.is_approved_member(_user_id)
    )
    OR (
      public.has_role(_user_id, 'jv_analyst')
      AND public.is_approved_member(_user_id)
    )
    OR (
      (public.is_demo_user(_user_id) OR public.is_demo_admin(_user_id))
      AND EXISTS (SELECT 1 FROM public.companies c WHERE c.id = _company_id AND c.is_demo = true)
    )
$$;

CREATE OR REPLACE FUNCTION public.can_operate_company(_company_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (
      (public.is_super_admin(_user_id) OR public.is_jv_admin(_user_id))
      AND public.is_approved_member(_user_id)
    )
    OR (
      public.is_demo_admin(_user_id)
      AND public.is_approved_member(_user_id)
      AND EXISTS (SELECT 1 FROM public.companies c WHERE c.id = _company_id AND c.is_demo = true)
    )
$$;

-- Fix 2: restrict is_jv_member to internal JV roles only
CREATE OR REPLACE FUNCTION public.is_jv_member(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('super_admin', 'jv_admin', 'jv_analyst')
  )
$$;
