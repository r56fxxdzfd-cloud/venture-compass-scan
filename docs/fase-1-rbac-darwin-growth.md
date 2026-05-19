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
