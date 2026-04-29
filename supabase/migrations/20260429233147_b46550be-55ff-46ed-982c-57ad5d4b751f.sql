CREATE TABLE IF NOT EXISTS public.council_meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  meeting_date DATE NOT NULL,
  meeting_type TEXT NOT NULL CHECK (meeting_type IN ('collective','individual','extraordinary')),
  title TEXT,
  main_topic TEXT,
  related_dimensions TEXT[],
  attendees_counselors TEXT[],
  attendees_founders TEXT[],
  executive_summary TEXT,
  key_progress TEXT,
  key_blockers TEXT,
  decisions TEXT,
  recommendations TEXT,
  next_agenda TEXT,
  perceived_progress_score NUMERIC,
  counselor_confidence_score NUMERIC,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.council_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID REFERENCES public.council_meetings(id) ON DELETE CASCADE NOT NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  related_dimension TEXT,
  owner_name TEXT,
  due_date DATE,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low','medium','high')),
  impact TEXT CHECK (impact IN ('low','medium','high')),
  effort TEXT CHECK (effort IN ('low','medium','high')),
  status TEXT DEFAULT 'not_started' CHECK (status IN ('not_started','in_progress','completed','blocked','cancelled')),
  expected_evidence TEXT,
  counselor_notes TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.council_meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.council_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "JV read council_meetings" ON public.council_meetings FOR SELECT USING (public.is_jv_member(auth.uid()));
CREATE POLICY "Admin/analyst write council_meetings" ON public.council_meetings FOR INSERT WITH CHECK (public.is_admin_or_analyst(auth.uid()) AND public.is_approved_member(auth.uid()));
CREATE POLICY "Admin/analyst update council_meetings" ON public.council_meetings FOR UPDATE USING (public.is_admin_or_analyst(auth.uid()) AND public.is_approved_member(auth.uid()));
CREATE POLICY "Admin/analyst delete council_meetings" ON public.council_meetings FOR DELETE USING (public.is_admin_or_analyst(auth.uid()) AND public.is_approved_member(auth.uid()));

CREATE POLICY "JV read council_actions" ON public.council_actions FOR SELECT USING (public.is_jv_member(auth.uid()));
CREATE POLICY "Admin/analyst write council_actions" ON public.council_actions FOR INSERT WITH CHECK (public.is_admin_or_analyst(auth.uid()) AND public.is_approved_member(auth.uid()));
CREATE POLICY "Admin/analyst update council_actions" ON public.council_actions FOR UPDATE USING (public.is_admin_or_analyst(auth.uid()) AND public.is_approved_member(auth.uid()));
CREATE POLICY "Admin/analyst delete council_actions" ON public.council_actions FOR DELETE USING (public.is_admin_or_analyst(auth.uid()) AND public.is_approved_member(auth.uid()));

CREATE OR REPLACE FUNCTION public.sync_council_action_completed_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'completed' THEN
    NEW.completed_at := COALESCE(NEW.completed_at, now());
  ELSE
    NEW.completed_at := NULL;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_council_action_completed_at ON public.council_actions;
CREATE TRIGGER trg_sync_council_action_completed_at
BEFORE INSERT OR UPDATE OF status, completed_at ON public.council_actions
FOR EACH ROW
EXECUTE FUNCTION public.sync_council_action_completed_at();