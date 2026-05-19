
-- Add demo_user to app_role enum if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = 'public.app_role'::regtype AND enumlabel = 'demo_user'
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'demo_user';
  END IF;
END$$;

-- Add is_demo column to companies (default false, non-null)
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
