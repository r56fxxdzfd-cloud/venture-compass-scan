
-- 1) can_access_company: include jv_analyst (read access)
CREATE OR REPLACE FUNCTION public.can_access_company(_company_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    public.is_super_admin(_user_id)
    OR public.is_jv_admin(_user_id)
    OR (
      public.has_role(_user_id, 'jv_analyst')
      AND public.is_approved_member(_user_id)
    )
    OR (
      (public.is_demo_user(_user_id) OR public.is_demo_admin(_user_id))
      AND EXISTS (SELECT 1 FROM public.companies c WHERE c.id = _company_id AND c.is_demo = true)
    )
$$;

-- 2) Tighten council_agenda_templates SELECT: require approved member
DROP POLICY IF EXISTS "JV read council_agenda_templates" ON public.council_agenda_templates;
CREATE POLICY "JV read council_agenda_templates"
ON public.council_agenda_templates
FOR SELECT
USING (public.is_jv_member(auth.uid()) AND public.is_approved_member(auth.uid()));

-- 3) Harden admin RPCs to enforce role internally
CREATE OR REPLACE FUNCTION public.get_user_email(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT au.email
  FROM auth.users au
  WHERE au.id = _user_id
    AND (public.is_super_admin(auth.uid()) OR public.is_jv_admin(auth.uid()));
$$;

CREATE OR REPLACE FUNCTION public.get_unconfirmed_user_ids()
RETURNS TABLE(user_id uuid)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT au.id
  FROM auth.users au
  WHERE au.email_confirmed_at IS NULL
    AND (public.is_super_admin(auth.uid()) OR public.is_jv_admin(auth.uid()));
$$;

-- 4) Lock down EXECUTE on SECURITY DEFINER functions

-- Revoke from PUBLIC and anon on all definer helpers (defense-in-depth)
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_jv_admin(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_jv_member(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_demo_user(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_demo_admin(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_admin_or_analyst(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_approved_member(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_access_company(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_operate_company(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_user_email(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_unconfirmed_user_ids() FROM PUBLIC, anon;

-- Trigger-only functions: revoke from everyone except postgres/service_role
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_founder_assessment_cooldown() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_council_action_completed_at() FROM PUBLIC, anon, authenticated;
