-- Fase 1.1 RBAC (realinhamento para ambiente demo)
-- Objetivo:
-- 1) Preservar Victor como único super_admin
-- 2) Rebaixar todos os demais usuários para demo_user
-- 3) Marcar empresas demo conhecidas com is_demo=true
-- Segurança:
-- - Script idempotente
-- - Sem criação/remoção de usuários
-- - Sem alteração de schema
-- - Aborta se Victor não for encontrado por identificador seguro

BEGIN;

DO $$
DECLARE
  v_victor_email constant text := 'victorplevy@icloud.com';
  v_victor_user_id uuid;
  v_super_admin_count integer;
  v_demo_companies text[] := ARRAY['Supertech', 'Learn Loop', 'BioNova', 'Domain IA'];
  v_missing_demo_companies text[];
BEGIN
  -- 1) Identificar Victor de forma segura (auth.users é a fonte primária de identidade)
  SELECT u.id
    INTO v_victor_user_id
  FROM auth.users u
  WHERE lower(u.email) = lower(v_victor_email)
  ORDER BY u.created_at ASC
  LIMIT 1;

  IF v_victor_user_id IS NULL THEN
    RAISE EXCEPTION
      USING MESSAGE = format(
        'ABORTADO: Victor não encontrado em auth.users para email "%s". Substitua o identificador (email/UUID) no script antes de executar.',
        v_victor_email
      );
  END IF;

  -- 2) Garantir Victor como super_admin (idempotente)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_victor_user_id, 'super_admin'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  -- Opcional defensivo: manter apenas super_admin para Victor
  DELETE FROM public.user_roles ur
  WHERE ur.user_id = v_victor_user_id
    AND ur.role <> 'super_admin'::public.app_role;

  -- 3) Para todos os demais usuários já cadastrados:
  --    remover roles legadas/administrativas e garantir demo_user.
  WITH all_other_users AS (
    SELECT p.id AS user_id
    FROM public.profiles p
    WHERE p.id <> v_victor_user_id
  ), deleted_roles AS (
    DELETE FROM public.user_roles ur
    USING all_other_users ou
    WHERE ur.user_id = ou.user_id
    RETURNING ur.user_id
  )
  INSERT INTO public.user_roles (user_id, role)
  SELECT ou.user_id, 'demo_user'::public.app_role
  FROM all_other_users ou
  ON CONFLICT (user_id, role) DO NOTHING;

  -- 4) Marcar empresas demo existentes (sem criar empresas ausentes)
  UPDATE public.companies c
  SET is_demo = true
  WHERE lower(c.name) IN (
    lower('Supertech'),
    lower('Learn Loop'),
    lower('BioNova'),
    lower('Domain IA')
  );

  -- Registrar aviso se alguma empresa demo esperada não existir
  SELECT array_agg(dc.name)
    INTO v_missing_demo_companies
  FROM unnest(v_demo_companies) AS dc(name)
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.companies c
    WHERE lower(c.name) = lower(dc.name)
  );

  IF v_missing_demo_companies IS NOT NULL THEN
    RAISE NOTICE 'Empresas demo não encontradas (nenhuma criada automaticamente): %', v_missing_demo_companies;
  END IF;

  -- 5) Guard rail: deve restar exatamente 1 super_admin (Victor)
  SELECT count(*)
    INTO v_super_admin_count
  FROM public.user_roles ur
  WHERE ur.role = 'super_admin'::public.app_role;

  IF v_super_admin_count <> 1 THEN
    RAISE EXCEPTION 'ABORTADO: esperado exatamente 1 super_admin após ajuste, encontrado=%', v_super_admin_count;
  END IF;
END
$$;

COMMIT;

-- =====================================================================
-- QUERIES DE VALIDAÇÃO (executar após commit)
-- =====================================================================

-- 1) Usuários e roles atuais
SELECT
  p.id AS user_id,
  p.full_name,
  u.email,
  array_agg(ur.role ORDER BY ur.role) AS roles
FROM public.profiles p
LEFT JOIN auth.users u ON u.id = p.id
LEFT JOIN public.user_roles ur ON ur.user_id = p.id
GROUP BY p.id, p.full_name, u.email
ORDER BY
  CASE WHEN lower(coalesce(u.email, '')) = lower('victorplevy@icloud.com') THEN 0 ELSE 1 END,
  coalesce(u.email, p.full_name, p.id::text);

-- 2) Confirmar super_admin único
SELECT
  count(*) AS super_admin_count,
  array_agg(ur.user_id) AS super_admin_user_ids
FROM public.user_roles ur
WHERE ur.role = 'super_admin'::public.app_role;

-- 3) Empresas atualmente marcadas como demo
SELECT c.id, c.name, c.is_demo
FROM public.companies c
WHERE c.is_demo = true
ORDER BY c.name;

-- 4) Confirmar status das empresas demo-alvo
SELECT c.id, c.name, c.is_demo
FROM public.companies c
WHERE lower(c.name) IN (
  lower('Supertech'),
  lower('Learn Loop'),
  lower('BioNova'),
  lower('Domain IA')
)
ORDER BY c.name;
