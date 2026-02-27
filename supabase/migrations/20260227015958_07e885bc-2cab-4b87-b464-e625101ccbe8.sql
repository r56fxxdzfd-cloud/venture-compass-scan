
-- Role enum
CREATE TYPE public.app_role AS ENUM ('jv_admin', 'jv_analyst', 'jv_viewer');

-- User roles table (security best practice - separate from profiles)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Helper: check if user has any JV role
CREATE OR REPLACE FUNCTION public.is_jv_member(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
  )
$$;

-- Helper: check if admin or analyst
CREATE OR REPLACE FUNCTION public.is_admin_or_analyst(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('jv_admin', 'jv_analyst')
  )
$$;

-- 1) profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Admins read all profiles" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'jv_admin'));
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- user_roles RLS
CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins read all roles" ON public.user_roles FOR SELECT USING (public.has_role(auth.uid(), 'jv_admin'));
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'jv_admin'));

-- 2) companies
CREATE TABLE public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  legal_name TEXT,
  cnpj TEXT,
  sector TEXT,
  stage TEXT CHECK (stage IN ('pre_seed', 'seed', 'series_a')),
  business_model TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "JV members read companies" ON public.companies FOR SELECT USING (public.is_jv_member(auth.uid()));
CREATE POLICY "Admin/analyst write companies" ON public.companies FOR INSERT WITH CHECK (public.is_admin_or_analyst(auth.uid()));
CREATE POLICY "Admin/analyst update companies" ON public.companies FOR UPDATE USING (public.is_admin_or_analyst(auth.uid()));
CREATE POLICY "Admin/analyst delete companies" ON public.companies FOR DELETE USING (public.is_admin_or_analyst(auth.uid()));

-- 3) config_versions
CREATE TABLE public.config_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_name TEXT NOT NULL,
  status TEXT CHECK (status IN ('draft', 'published', 'archived')) DEFAULT 'draft',
  config_json JSONB NOT NULL,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  published_at TIMESTAMPTZ
);
ALTER TABLE public.config_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "JV members read configs" ON public.config_versions FOR SELECT USING (public.is_jv_member(auth.uid()));
CREATE POLICY "Admins write configs" ON public.config_versions FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'jv_admin'));
CREATE POLICY "Admins update configs" ON public.config_versions FOR UPDATE USING (public.has_role(auth.uid(), 'jv_admin'));
CREATE POLICY "Admins delete configs" ON public.config_versions FOR DELETE USING (public.has_role(auth.uid(), 'jv_admin'));

-- 4) dimensions
CREATE TABLE public.dimensions (
  id TEXT NOT NULL,
  config_version_id UUID REFERENCES public.config_versions(id) ON DELETE CASCADE NOT NULL,
  label TEXT NOT NULL,
  sort_order INT DEFAULT 0,
  PRIMARY KEY (config_version_id, id)
);
ALTER TABLE public.dimensions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "JV members read dimensions" ON public.dimensions FOR SELECT USING (public.is_jv_member(auth.uid()));
CREATE POLICY "Admins write dimensions" ON public.dimensions FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'jv_admin'));
CREATE POLICY "Admins update dimensions" ON public.dimensions FOR UPDATE USING (public.has_role(auth.uid(), 'jv_admin'));
CREATE POLICY "Admins delete dimensions" ON public.dimensions FOR DELETE USING (public.has_role(auth.uid(), 'jv_admin'));

-- 5) questions
CREATE TABLE public.questions (
  id TEXT NOT NULL,
  config_version_id UUID REFERENCES public.config_versions(id) ON DELETE CASCADE NOT NULL,
  dimension_id TEXT NOT NULL,
  text TEXT NOT NULL,
  type TEXT DEFAULT 'likert',
  scale_id TEXT DEFAULT 'likert_1_5',
  tags JSONB DEFAULT '{}'::jsonb,
  tooltip JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  PRIMARY KEY (config_version_id, id)
);
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "JV members read questions" ON public.questions FOR SELECT USING (public.is_jv_member(auth.uid()));
CREATE POLICY "Admins write questions" ON public.questions FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'jv_admin'));
CREATE POLICY "Admins update questions" ON public.questions FOR UPDATE USING (public.has_role(auth.uid(), 'jv_admin'));
CREATE POLICY "Admins delete questions" ON public.questions FOR DELETE USING (public.has_role(auth.uid(), 'jv_admin'));

-- 6) deep_dive_prompts
CREATE TABLE public.deep_dive_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_version_id UUID REFERENCES public.config_versions(id) ON DELETE CASCADE NOT NULL,
  dimension_id TEXT NOT NULL,
  prompt TEXT NOT NULL,
  sort_order INT DEFAULT 0
);
ALTER TABLE public.deep_dive_prompts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "JV read deep_dive" ON public.deep_dive_prompts FOR SELECT USING (public.is_jv_member(auth.uid()));
CREATE POLICY "Admins write deep_dive" ON public.deep_dive_prompts FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'jv_admin'));
CREATE POLICY "Admins update deep_dive" ON public.deep_dive_prompts FOR UPDATE USING (public.has_role(auth.uid(), 'jv_admin'));
CREATE POLICY "Admins delete deep_dive" ON public.deep_dive_prompts FOR DELETE USING (public.has_role(auth.uid(), 'jv_admin'));

-- 7) red_flags
CREATE TABLE public.red_flags (
  code TEXT NOT NULL,
  config_version_id UUID REFERENCES public.config_versions(id) ON DELETE CASCADE NOT NULL,
  label TEXT NOT NULL,
  severity TEXT,
  triggers JSONB,
  actions JSONB,
  PRIMARY KEY (config_version_id, code)
);
ALTER TABLE public.red_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "JV read red_flags" ON public.red_flags FOR SELECT USING (public.is_jv_member(auth.uid()));
CREATE POLICY "Admins write red_flags" ON public.red_flags FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'jv_admin'));
CREATE POLICY "Admins update red_flags" ON public.red_flags FOR UPDATE USING (public.has_role(auth.uid(), 'jv_admin'));
CREATE POLICY "Admins delete red_flags" ON public.red_flags FOR DELETE USING (public.has_role(auth.uid(), 'jv_admin'));

-- 8) glossary_terms
CREATE TABLE public.glossary_terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_version_id UUID REFERENCES public.config_versions(id) ON DELETE CASCADE NOT NULL,
  term TEXT NOT NULL,
  definition TEXT NOT NULL,
  UNIQUE (config_version_id, term)
);
ALTER TABLE public.glossary_terms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "JV read glossary" ON public.glossary_terms FOR SELECT USING (public.is_jv_member(auth.uid()));
CREATE POLICY "Admins write glossary" ON public.glossary_terms FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'jv_admin'));
CREATE POLICY "Admins update glossary" ON public.glossary_terms FOR UPDATE USING (public.has_role(auth.uid(), 'jv_admin'));
CREATE POLICY "Admins delete glossary" ON public.glossary_terms FOR DELETE USING (public.has_role(auth.uid(), 'jv_admin'));

-- 9) simulator_presets
CREATE TABLE public.simulator_presets (
  id TEXT NOT NULL,
  config_version_id UUID REFERENCES public.config_versions(id) ON DELETE CASCADE NOT NULL,
  label TEXT NOT NULL,
  dimension_scores JSONB,
  numeric_context_defaults JSONB,
  expected_red_flags JSONB,
  PRIMARY KEY (config_version_id, id)
);
ALTER TABLE public.simulator_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "JV read presets" ON public.simulator_presets FOR SELECT USING (public.is_jv_member(auth.uid()));
CREATE POLICY "Admins write presets" ON public.simulator_presets FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'jv_admin'));
CREATE POLICY "Admins update presets" ON public.simulator_presets FOR UPDATE USING (public.has_role(auth.uid(), 'jv_admin'));
CREATE POLICY "Admins delete presets" ON public.simulator_presets FOR DELETE USING (public.has_role(auth.uid(), 'jv_admin'));

-- 10) assessments
CREATE TABLE public.assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) NOT NULL,
  config_version_id UUID REFERENCES public.config_versions(id) NOT NULL,
  status TEXT CHECK (status IN ('in_progress', 'completed')) DEFAULT 'in_progress',
  is_simulation BOOLEAN DEFAULT false,
  stage TEXT CHECK (stage IN ('pre_seed', 'seed', 'series_a')),
  business_model TEXT,
  customer_type TEXT,
  revenue_model TEXT,
  context_numeric JSONB DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);
ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "JV read assessments" ON public.assessments FOR SELECT USING (public.is_jv_member(auth.uid()));
CREATE POLICY "Admin/analyst write assessments" ON public.assessments FOR INSERT WITH CHECK (public.is_admin_or_analyst(auth.uid()));
CREATE POLICY "Admin/analyst update assessments" ON public.assessments FOR UPDATE USING (public.is_admin_or_analyst(auth.uid()));
CREATE POLICY "Admin/analyst delete assessments" ON public.assessments FOR DELETE USING (public.is_admin_or_analyst(auth.uid()));

-- 11) answers
CREATE TABLE public.answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID REFERENCES public.assessments(id) ON DELETE CASCADE NOT NULL,
  question_id TEXT NOT NULL,
  value INT,
  is_na BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (assessment_id, question_id)
);
ALTER TABLE public.answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "JV read answers" ON public.answers FOR SELECT USING (public.is_jv_member(auth.uid()));
CREATE POLICY "Admin/analyst write answers" ON public.answers FOR INSERT WITH CHECK (public.is_admin_or_analyst(auth.uid()));
CREATE POLICY "Admin/analyst update answers" ON public.answers FOR UPDATE USING (public.is_admin_or_analyst(auth.uid()));
CREATE POLICY "Admin/analyst delete answers" ON public.answers FOR DELETE USING (public.is_admin_or_analyst(auth.uid()));

-- 12) assessment_red_flags
CREATE TABLE public.assessment_red_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID REFERENCES public.assessments(id) ON DELETE CASCADE NOT NULL,
  red_flag_code TEXT NOT NULL,
  status TEXT CHECK (status IN ('triggered', 'resolved')) DEFAULT 'triggered',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (assessment_id, red_flag_code)
);
ALTER TABLE public.assessment_red_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "JV read assessment_red_flags" ON public.assessment_red_flags FOR SELECT USING (public.is_jv_member(auth.uid()));
CREATE POLICY "Admin/analyst write assessment_red_flags" ON public.assessment_red_flags FOR INSERT WITH CHECK (public.is_admin_or_analyst(auth.uid()));
CREATE POLICY "Admin/analyst update assessment_red_flags" ON public.assessment_red_flags FOR UPDATE USING (public.is_admin_or_analyst(auth.uid()));
CREATE POLICY "Admin/analyst delete assessment_red_flags" ON public.assessment_red_flags FOR DELETE USING (public.is_admin_or_analyst(auth.uid()));
