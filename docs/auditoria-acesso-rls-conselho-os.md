# Auditoria do modelo atual de acesso (Conselho OS)

Auditoria realizada no estado atual do repositório, sem mudanças de lógica de autorização.

## 1) Tabelas existentes relacionadas a usuários/acesso

### Encontradas
- `profiles`
- `user_roles`
- `companies`
- `assessments`
- `founders`
- `founder_assessments`
- `config_versions`
- `dimensions`
- `questions`
- `red_flags`
- `council_meetings`
- `council_actions`
- `council_dimension_progress`

### Não encontradas no schema atual
- `users` (como tabela app; usuários base ficam em `auth.users`)
- `memberships`
- `company_memberships`
- `organization_memberships`
- `program_memberships`

## 2) RLS atual (resumo)

- Leitura principal: `is_jv_member` (base histórica) e depois `is_approved_member` (hardening).
- Escrita operacional: `is_admin_or_analyst` + `is_approved_member` em boa parte das tabelas.
- Escrita de metodologia/config: `jv_admin` (com `super_admin` contemplado por helper atualizado).

### Políticas por domínio solicitado
- `companies`, `assessments`: leitura de aprovado; escrita admin/analyst aprovado.
- `founders`, `founder_assessments`: leitura de aprovado; escrita admin/analyst aprovado.
- `council_meetings`, `council_actions`, `council_dimension_progress`: leitura JV/approved; escrita admin/analyst aprovado.
- `config_versions`, `dimensions`, `questions`, `red_flags`: leitura de aprovado; escrita restrita a administração metodológica.
- `profiles`: próprio usuário lê/edita, admin lê todos, super admin pode atualizar perfis.
- `user_roles`: usuário lê os próprios roles, admin gerencia.

## 3) Helpers existentes

### SQL
- `has_role`
- `is_jv_member`
- `is_admin_or_analyst`
- `is_approved_member`
- `is_super_admin`
- trigger `handle_new_user()` para criar `profiles` pendente.

### Frontend/backend app
- `ProtectedRoute` por roles.
- `AuthContext` carregando `profiles` + `user_roles`.
- **Não encontrado** helper de escopo por empresa/programa (`requireCompanyMembership`, equivalente).

## 4) Frontend: pontos com suposição de acesso global

- Menu lateral e guardas de rota guiados por role global, sem membership por organização/programa.
- Dashboard carrega conjuntos amplos (`companies`, `assessments`, `council_*`, `config_versions`).
- Agenda/Central do Conselho com leitura global permitida por RLS atual.
- Relatórios/detalhes por URL (`:id`) dependem da RLS para negar acesso.
- Administração de metodologia e usuários separada por role global.

## 5) Riscos atuais

1. Conselheiro potencialmente enxerga organizações além do necessário (falta membership por empresa).
2. Não há isolamento de **modo demo** no modelo de autorização.
3. Membro de programa vs admin metodológico não está explicitamente modelado.
4. Acesso por URL direta pode funcionar para qualquer registro visível no recorte global da policy.
5. UI esconder opção não substitui política de escopo fino.

## 6) Modelo alvo proposto

- `global_role` (ex.: `super_admin`, `metodologico_admin`, `program_member`, `conselheiro`, `viewer`).
- `program_memberships(user_id, program_id, role_in_program, status)`.
- `company_memberships(user_id, company_id, role_in_company, status)`.
- `is_demo` + segregação explícita de tenant (`real`/`demo`) em RLS.
- Permissões por role + escopo de membership; metodologia separada de operação.

## 7) Fases sugeridas

### Fase 1 (mínimo seguro)
- Criar memberships (program/company) e ajustar RLS de leitura/escrita operacional para exigir escopo.

### Fase 2 (refinamento)
- Canonizar `global_role`, separar papel metodológico do operacional e alinhar frontend.

### Fase 3 (demo robusto)
- `is_demo`, políticas tenant-aware e dataset demo segregado/resetável.

## 8) Arquivos provavelmente impactados na implementação futura

- `supabase/migrations/*` (novas tabelas/funcs/policies)
- `src/integrations/supabase/types.ts`
- `src/contexts/AuthContext.tsx`
- `src/components/ProtectedRoute.tsx`
- `src/components/AppLayout.tsx`
- `src/pages/DashboardPage.tsx`
- `src/pages/AgendaPage.tsx`
- `src/pages/ReportPage.tsx`
- `src/pages/AdminConfigPage.tsx`
- `src/pages/MethodologyPage.tsx`
- `src/pages/AdminUsersPage.tsx`
- `supabase/functions/resend-confirmation/index.ts`
