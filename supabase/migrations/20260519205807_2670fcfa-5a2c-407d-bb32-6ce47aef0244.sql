
DO $$
DECLARE
  v_victor uuid;
  v_count int;
  v_super_count int;
BEGIN
  -- 1. Localizar Victor
  SELECT id INTO v_victor FROM auth.users WHERE email = 'victorplevy@icloud.com';
  IF v_victor IS NULL THEN
    RAISE EXCEPTION 'Victor (victorplevy@icloud.com) não encontrado. Abortando.';
  END IF;
  SELECT count(*) INTO v_count FROM auth.users WHERE email = 'victorplevy@icloud.com';
  IF v_count > 1 THEN
    RAISE EXCEPTION 'Mais de um usuário com email victorplevy@icloud.com. Abortando.';
  END IF;

  -- 2. Limpar todos os roles
  DELETE FROM public.user_roles;

  -- 3. Victor → super_admin
  INSERT INTO public.user_roles (user_id, role) VALUES (v_victor, 'super_admin');

  -- 4. Todos os demais usuários cadastrados (com profile) → demo_user
  INSERT INTO public.user_roles (user_id, role)
  SELECT p.id, 'demo_user'::public.app_role
  FROM public.profiles p
  WHERE p.id <> v_victor;

  -- 5. Validar super_admin único
  SELECT count(*) INTO v_super_count FROM public.user_roles WHERE role = 'super_admin';
  IF v_super_count <> 1 THEN
    RAISE EXCEPTION 'Quantidade de super_admin = %, esperado 1. Abortando.', v_super_count;
  END IF;

  -- 6. Marcar empresas demo
  UPDATE public.companies SET is_demo = true
  WHERE name IN ('Supertech', 'Learn Loop', 'BioNova', 'Domain IA');
END$$;
