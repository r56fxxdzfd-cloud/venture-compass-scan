
-- Step 2: Add approval columns to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS requested_at TIMESTAMPTZ DEFAULT now(),
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS approved_by UUID;

-- Step 3: Set ALL existing profiles to approved (they predate this feature)
UPDATE public.profiles SET status = 'approved', approved_at = now() WHERE status = 'pending';

-- Step 4: Create is_approved_member function
CREATE OR REPLACE FUNCTION public.is_approved_member(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id
    WHERE ur.user_id = _user_id AND p.status = 'approved'
  )
$$;

-- Step 5: Create is_super_admin function
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'super_admin'
  )
$$;

-- Step 6: Update RLS on companies
DROP POLICY IF EXISTS "JV members read companies" ON public.companies;
CREATE POLICY "Approved members read companies" ON public.companies
  FOR SELECT USING (is_approved_member(auth.uid()));

DROP POLICY IF EXISTS "Admin/analyst write companies" ON public.companies;
CREATE POLICY "Admin/analyst write companies" ON public.companies
  FOR INSERT WITH CHECK (is_admin_or_analyst(auth.uid()) AND is_approved_member(auth.uid()));

DROP POLICY IF EXISTS "Admin/analyst update companies" ON public.companies;
CREATE POLICY "Admin/analyst update companies" ON public.companies
  FOR UPDATE USING (is_admin_or_analyst(auth.uid()) AND is_approved_member(auth.uid()));

DROP POLICY IF EXISTS "Admin/analyst delete companies" ON public.companies;
CREATE POLICY "Admin/analyst delete companies" ON public.companies
  FOR DELETE USING (is_admin_or_analyst(auth.uid()) AND is_approved_member(auth.uid()));

-- Step 7: Update RLS on assessments
DROP POLICY IF EXISTS "JV read assessments" ON public.assessments;
CREATE POLICY "Approved read assessments" ON public.assessments
  FOR SELECT USING (is_approved_member(auth.uid()));

DROP POLICY IF EXISTS "Admin/analyst write assessments" ON public.assessments;
CREATE POLICY "Admin/analyst write assessments" ON public.assessments
  FOR INSERT WITH CHECK (is_admin_or_analyst(auth.uid()) AND is_approved_member(auth.uid()));

DROP POLICY IF EXISTS "Admin/analyst update assessments" ON public.assessments;
CREATE POLICY "Admin/analyst update assessments" ON public.assessments
  FOR UPDATE USING (is_admin_or_analyst(auth.uid()) AND is_approved_member(auth.uid()));

DROP POLICY IF EXISTS "Admin/analyst delete assessments" ON public.assessments;
CREATE POLICY "Admin/analyst delete assessments" ON public.assessments
  FOR DELETE USING (is_admin_or_analyst(auth.uid()) AND is_approved_member(auth.uid()));

-- Step 8: Update RLS on answers
DROP POLICY IF EXISTS "JV read answers" ON public.answers;
CREATE POLICY "Approved read answers" ON public.answers
  FOR SELECT USING (is_approved_member(auth.uid()));

DROP POLICY IF EXISTS "Admin/analyst write answers" ON public.answers;
CREATE POLICY "Admin/analyst write answers" ON public.answers
  FOR INSERT WITH CHECK (is_admin_or_analyst(auth.uid()) AND is_approved_member(auth.uid()));

DROP POLICY IF EXISTS "Admin/analyst update answers" ON public.answers;
CREATE POLICY "Admin/analyst update answers" ON public.answers
  FOR UPDATE USING (is_admin_or_analyst(auth.uid()) AND is_approved_member(auth.uid()));

DROP POLICY IF EXISTS "Admin/analyst delete answers" ON public.answers;
CREATE POLICY "Admin/analyst delete answers" ON public.answers
  FOR DELETE USING (is_admin_or_analyst(auth.uid()) AND is_approved_member(auth.uid()));

-- Step 9: Update RLS on config_versions
DROP POLICY IF EXISTS "JV members read configs" ON public.config_versions;
CREATE POLICY "Approved members read configs" ON public.config_versions
  FOR SELECT USING (is_approved_member(auth.uid()));

DROP POLICY IF EXISTS "Admins write configs" ON public.config_versions;
CREATE POLICY "Admins write configs" ON public.config_versions
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'jv_admin'::app_role) AND is_approved_member(auth.uid()));

DROP POLICY IF EXISTS "Admins update configs" ON public.config_versions;
CREATE POLICY "Admins update configs" ON public.config_versions
  FOR UPDATE USING (has_role(auth.uid(), 'jv_admin'::app_role) AND is_approved_member(auth.uid()));

DROP POLICY IF EXISTS "Admins delete configs" ON public.config_versions;
CREATE POLICY "Admins delete configs" ON public.config_versions
  FOR DELETE USING (has_role(auth.uid(), 'jv_admin'::app_role) AND is_approved_member(auth.uid()));

-- Step 10: Update remaining read-only tables
DROP POLICY IF EXISTS "JV read assessment_red_flags" ON public.assessment_red_flags;
CREATE POLICY "Approved read assessment_red_flags" ON public.assessment_red_flags
  FOR SELECT USING (is_approved_member(auth.uid()));

DROP POLICY IF EXISTS "Admin/analyst write assessment_red_flags" ON public.assessment_red_flags;
CREATE POLICY "Admin/analyst write assessment_red_flags" ON public.assessment_red_flags
  FOR INSERT WITH CHECK (is_admin_or_analyst(auth.uid()) AND is_approved_member(auth.uid()));

DROP POLICY IF EXISTS "Admin/analyst update assessment_red_flags" ON public.assessment_red_flags;
CREATE POLICY "Admin/analyst update assessment_red_flags" ON public.assessment_red_flags
  FOR UPDATE USING (is_admin_or_analyst(auth.uid()) AND is_approved_member(auth.uid()));

DROP POLICY IF EXISTS "Admin/analyst delete assessment_red_flags" ON public.assessment_red_flags;
CREATE POLICY "Admin/analyst delete assessment_red_flags" ON public.assessment_red_flags
  FOR DELETE USING (is_admin_or_analyst(auth.uid()) AND is_approved_member(auth.uid()));

DROP POLICY IF EXISTS "JV members read dimensions" ON public.dimensions;
CREATE POLICY "Approved read dimensions" ON public.dimensions
  FOR SELECT USING (is_approved_member(auth.uid()));

DROP POLICY IF EXISTS "JV members read questions" ON public.questions;
CREATE POLICY "Approved read questions" ON public.questions
  FOR SELECT USING (is_approved_member(auth.uid()));

DROP POLICY IF EXISTS "JV read red_flags" ON public.red_flags;
CREATE POLICY "Approved read red_flags" ON public.red_flags
  FOR SELECT USING (is_approved_member(auth.uid()));

DROP POLICY IF EXISTS "JV read deep_dive" ON public.deep_dive_prompts;
CREATE POLICY "Approved read deep_dive" ON public.deep_dive_prompts
  FOR SELECT USING (is_approved_member(auth.uid()));

DROP POLICY IF EXISTS "JV read glossary" ON public.glossary_terms;
CREATE POLICY "Approved read glossary" ON public.glossary_terms
  FOR SELECT USING (is_approved_member(auth.uid()));

DROP POLICY IF EXISTS "JV read presets" ON public.simulator_presets;
CREATE POLICY "Approved read presets" ON public.simulator_presets
  FOR SELECT USING (is_approved_member(auth.uid()));

-- Step 11: Profiles RLS updates
DROP POLICY IF EXISTS "Admins read all profiles" ON public.profiles;
CREATE POLICY "Admins read all profiles" ON public.profiles
  FOR SELECT USING (is_super_admin(auth.uid()) OR has_role(auth.uid(), 'jv_admin'::app_role));

CREATE POLICY "Super admin update profiles" ON public.profiles
  FOR UPDATE USING (is_super_admin(auth.uid()));

-- Step 12: Update handle_new_user trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, status, requested_at)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), 'pending', now());
  RETURN NEW;
END;
$$;
