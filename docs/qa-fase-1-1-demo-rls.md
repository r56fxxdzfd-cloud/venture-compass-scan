# QA pós-implementação — Fase 1.1 RBAC (isolamento demo por RLS)

Data da validação: 2026-05-19

## Escopo
Validação de segurança e operação após a migration `20260519143000_phase1_1_demo_rls_isolation.sql`.

## 1) Validação `can_access_company`
Resultado da leitura da função SQL:
- `super_admin` => `true` para qualquer `company_id` válido.
- `jv_admin` => `true` para qualquer `company_id` válido.
- `demo_user` => `true` somente se `companies.is_demo = true`.
- `demo_user` => `false` para `companies.is_demo = false`.
- `user` comum não recebeu acesso novo direto; mantém caminho legado condicionado a `is_approved_member`.

Conclusão: regra principal de isolamento demo está correta no helper.

## 2) Acesso demo por UI
Não foi possível executar validação E2E visual nesta execução por ausência de dependências locais (`vite`/`vitest`/`eslint` não instalados no ambiente).

Status:
- `/app/startups`: **não validado em runtime**
- exclusão de Supertech/Learn Loop/BioNova/Domain IA (quando `is_demo=false`): **não validado em runtime**
- banner demo: **não validado em runtime**
- Dashboard/Central do Conselheiro/Agenda/Relatórios: **não validado em runtime**

Evidência indireta: a proteção de backend via RLS em `companies` + tabelas operacionais por `company_id` impede leitura de dados reais para `demo_user` mesmo em URL direta.

## 3) Acesso demo por URL direta
Não foi possível rodar teste de navegação autenticada no navegador neste ambiente.

Cobertura indireta confirmada por policy:
- `companies` (startup base)
- `assessments`
- `founders`
- `council_meetings`
- `council_actions`
- `council_dimension_progress`
- `founder_assessments` (indireta por founder/company)
- `founder_pillar_scores` (indireta por founder_assessment/founder)

Conclusão: backend bloqueia exposição de dados reais para `demo_user`; comportamento exato de UX (erro amigável/empty state) permanece pendente de teste manual em browser.

## 4) Operação Super Admin
Por regra SQL:
- possui acesso global por `is_super_admin` / `is_jv_admin` / `can_operate_platform`;
- mantém escrita em parâmetros sensíveis (`config_versions`, `dimensions`, `questions`, `red_flags`) via `can_manage_sensitive_parameters`.

Status: **aprovado por análise de policy**.

## 5) Operação JV Admin
Por regra SQL:
- acesso de leitura/escrita operacional preservado nas tabelas operacionais;
- sem escrita em parâmetros sensíveis (write/update/delete reservados a super admin nas tabelas sensíveis).

Status: **aprovado por análise de policy**.

## 6) Auditoria de tabelas não cobertas (vazamento potencial)
### Cobertas na Fase 1.1
- `companies`
- `assessments`
- `founders`
- `council_meetings`
- `council_actions`
- `council_dimension_progress`
- `founder_assessments`
- `founder_pillar_scores`

### Não cobertas explicitamente por isolamento demo por company
- `council_agenda_templates`: é global (sem `company_id`) e leitura para membros JV; risco de conter texto sensível se houver conteúdo real embutido.
  - Risco: **baixo-médio** (não expõe métricas operacionais por startup, mas pode expor conteúdo de conhecimento interno).
- `profiles` / `user_roles`: continuam com leitura administrativa (`jv_admin`) por design.
  - Risco: **baixo** para vazamento de dados de startup; **médio** para privacidade de dados de usuários se conta demo tiver papel inadequado.
- Buckets/storage (`attachments`, exports, transcripts, drafts, notes): **não há policy de storage nesta migration**.
  - Risco: **alto** se existir bucket público ou policy ampla para `authenticated` sem filtro de prefixo por tenant/demo.

## 7) Inserts/updates
Por policy da Fase 1.1:
- `demo_user` não possui `can_operate_platform` => não consegue inserir/editar/deletar dados operacionais.
- `jv_admin` mantém operação em dados operacionais.
- `jv_admin` não escreve parâmetros sensíveis.

Status: **aprovado por análise de policy**.

## 8) Critérios para liberação de demo externo controlado
Checklist mínimo antes de liberar:
1. Teste manual autenticado com `demo_user` em todas as URLs diretas críticas.
2. Auditoria e endurecimento de Storage policies (buckets de anexos/exports/transcripts).
3. Garantir que conta demo tenha apenas role `demo_user` + status aprovado, sem roles administrativas acumuladas.
4. Validar empty states e mensagens amigáveis no frontend para endpoints bloqueados por RLS.

## Matriz final por perfil (Fase 1.1)
- `super_admin`
  - leitura real+demo: **sim**
  - operação dados operacionais: **sim**
  - alteração parâmetros sensíveis: **sim**
- `jv_admin`
  - leitura real+demo: **sim**
  - operação dados operacionais: **sim**
  - alteração parâmetros sensíveis: **não**
- `demo_user`
  - leitura demo: **sim**
  - leitura real: **não**
  - escrita operacional: **não**
  - escrita sensível: **não**
- `user`
  - sem novos privilégios específicos introduzidos na Fase 1.1.

## Veredito
`demo_user` está **seguro no núcleo operacional via RLS de banco** para uso externo controlado, **com pendências importantes em validação runtime de UI e auditoria de Storage**.
