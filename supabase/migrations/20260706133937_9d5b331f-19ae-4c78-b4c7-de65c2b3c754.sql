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