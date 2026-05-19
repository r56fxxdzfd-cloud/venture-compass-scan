# Fase 1 — RBAC simples (Darwin Growth / Conselho OS)

## Decisão da Fase 1
- 1 Super Admin operacional (Victor) com controle total.
- Partners JV operam como `jv_admin`.
- `jv_admin` mantém acesso operacional amplo, mas sem alterar parâmetros sensíveis.
- `demo_user` acessa apenas modo demo (dados fictícios).
- `user` reservado para evolução futura.

## Roles globais suportadas
- `super_admin`
- `jv_admin`
- `demo_user`
- `user`

Compatibilidade mantida com roles legadas existentes (`jv_analyst`, `jv_viewer`) para evitar quebra de ambiente.

## Parâmetros sensíveis (Fase 1)
- metodologia
- perguntas
- pesos
- dimensões
- scoring/thresholds
- red flags
- `config_versions`
- prompts sistêmicos e publicação de metodologia
- qualquer lógica que altere interpretação/resultado de diagnóstico

## Helpers SQL criados/ajustados
- `public.is_super_admin(user_id uuid)`
- `public.is_jv_admin(user_id uuid)`
- `public.is_demo_user(user_id uuid)`
- `public.can_manage_sensitive_parameters(user_id uuid)`
- `public.can_operate_platform(user_id uuid)`
- `public.can_access_demo_data(user_id uuid)`

Regras implementadas:
- `can_manage_sensitive_parameters = true` apenas para `super_admin`.
- `can_operate_platform = true` para `super_admin` e `jv_admin`.
- `demo_user` não recebe permissões de operação ampla.

## Proteções aplicadas
- Adicionado `companies.is_demo boolean default false`.
- Escrita em tabelas sensíveis (`config_versions`, `dimensions`, `questions`, `red_flags`) restringida para `super_admin` via policy.
- Frontend de Configuração passou a modo leitura para não-super-admin.

## Super Admin único (Victor)
Nesta fase não foi criada constraint hard para “único super_admin” por risco operacional.

Promoção manual sugerida (executar com cuidado no SQL Editor):
```sql
-- exemplo por user_id
insert into public.user_roles (user_id, role)
values ('<UUID_DO_VICTOR>', 'super_admin')
on conflict (user_id, role) do nothing;
```

## Limitações conhecidas da Fase 1
- Sem memberships por startup/comitê.
- Sem visibilidade granular por comitê/conselheiro/founder.
- Sem rollout completo de RLS demo em todas as tabelas.

## Fase 2 (planejada)
- memberships por programa/comitê/startup;
- visibilidade granular por papel e escopo;
- isolamento real vs demo por políticas mais amplas;
- enforcement de “super_admin único” com fluxo seguro de rotação.

## Fase 1.1 — Isolamento de Demo User por RLS (2026-05-19)

Implementado via migration `20260519143000_phase1_1_demo_rls_isolation.sql`.

### Novo helper
- `public.can_access_company(company_id, user_id)` com regras:
  - `super_admin` e `jv_admin`: acesso total (real + demo);
  - `demo_user`: acesso somente quando `companies.is_demo = true`;
  - compatibilidade preservada para fluxo legado de `is_approved_member`.

### Tabelas protegidas no núcleo operacional
- `companies`
- `assessments`
- `founders`
- `council_meetings`
- `council_actions`
- `council_dimension_progress`
- `founder_assessments` (escopo indireto por founder/company)
- `founder_pillar_scores` (escopo indireto por founder_assessment/founder)

### Efeito prático
- `demo_user` isolado de dados reais no núcleo operacional.
- `demo_user` permanece read-only (sem `can_operate_platform`).
- Super Admin e JV Admin preservam operação interna.

### Pendências para hardening (fora da Fase 1.1)
- Auditoria e eventual isolamento de Storage buckets (anexos, exports, transcrições e rascunhos).
- Validação E2E de UX para rotas diretas bloqueadas por RLS (erro amigável/empty state).

### Critério de liberação para demo externo controlado
Liberar somente após:
1. validação manual autenticada de rotas diretas críticas com `demo_user`;
2. confirmação de policies de Storage sem vazamento para `demo_user`;
3. revisão de roles da conta demo (somente `demo_user`).
