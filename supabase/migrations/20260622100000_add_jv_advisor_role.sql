-- FASE 1 RBAC — papel jv_advisor (Conselho OS / Darwin Growth)
-- Postgres exige que um novo valor de enum seja commitado em sua própria
-- transação antes de poder ser referenciado por literais/policies. Por isso
-- este ADD VALUE vive em migration isolada, anterior às que usam o valor.
-- Idempotente.

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'jv_advisor';
