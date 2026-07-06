-- Expand intake status values used by the public onboarding flow.
-- Older deployments only allowed pending/submitted/imported/expired, which
-- makes the Edge Functions fail when persisting registration_started and later
-- pipeline states.

ALTER TABLE public.intake_submissions
  DROP CONSTRAINT IF EXISTS intake_submissions_status_check;

ALTER TABLE public.intake_submissions
  ADD CONSTRAINT intake_submissions_status_check
  CHECK (
    status IN (
      'pending',
      'registration_started',
      'registration_completed',
      'diagnosis_started',
      'diagnosis_completed',
      'submitted',
      'imported',
      'expired'
    )
  );
