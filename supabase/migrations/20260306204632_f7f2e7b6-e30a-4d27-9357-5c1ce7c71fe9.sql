
CREATE OR REPLACE FUNCTION public.get_unconfirmed_user_ids()
RETURNS TABLE(user_id uuid)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT au.id AS user_id
  FROM auth.users au
  WHERE au.email_confirmed_at IS NULL;
$$;
