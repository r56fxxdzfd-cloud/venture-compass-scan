
UPDATE auth.users
SET email_confirmed_at = now()
WHERE email = 'murilo@darwinstartups.com' AND email_confirmed_at IS NULL;
