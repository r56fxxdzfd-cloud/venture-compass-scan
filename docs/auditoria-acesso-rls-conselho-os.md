# Auditoria e proposta de modelo de acesso/RLS — JV Darwin Growth

> Escopo desta entrega: revisão de desenho (nomenclatura, modelo de dados, permissões, RLS e impactos de frontend), **sem implementação funcional**, **sem migrations**.

## 1) Contexto operacional consolidado

A operação deve refletir a estrutura real da JV responsável pelo programa **Darwin Growth**:

- **JV**: sócios e equipe de operação do programa;
- **Programa**: Darwin Growth;
- **Comitês de Crescimento**: grupos de até 3–4 startups;
- **Startups participantes**: empresas acompanhadas;
- **Partners e conselheiros**: papéis operacionais e convidados;
- **Founders**: liderança da startup participante;
- **Modo demo**: ambiente isolado com dados fictícios.

Premissas de operação consideradas:
- Reuniões presenciais de **Comitê**;
- **Acompanhamento Individual** online;
- **Touchpoint do Comitê** online (grupo);
- **Reuniões Extraordinárias**;
- Diagnóstico profundo + acompanhamento quinzenal;
- Foco em startups top performers.

---

## 2) Nomenclatura recomendada (canonizada)

### Entidades
- **Programa**: `Darwin Growth`
- **Grupo**: `Comitê de Crescimento`
- **Empresas**: `Startups`

### Tipos de reunião (domínio council_meetings)
- `comite` → **Comitê**
- `acompanhamento_individual` → **Acompanhamento Individual**
- `touchpoint_comite` → **Touchpoint do Comitê**
- `extraordinaria` → **Reunião Extraordinária**

### Papéis (catálogo-alvo)
- `jv_partner` → **JV Partner**
- `jv_operator` → **JV Operator**
- `darwin_partner_admin` → **Darwin Partner Admin**
- `darwin_partner` → **Darwin Partner**
- `founder_growth_partner` → **Founder Growth Partner**
- `guest_growth_partner` → **Guest Growth Partner**
- `committee_president` → **Committee President**
- `committee_vice_president` → **Committee Vice-President**
- `founder_startup` → **Founder Startup**
- `demo_user` → **Demo User**

> Recomendação: manter slugs técnicos em `snake_case` e rótulos PT-BR/EN na camada de apresentação.

---

## 3) Modelo de dados atualizado (proposta)

## 3.1 Novas/tabelas-alvo

1. `programs`
   - `id`
   - `name` (ex.: Darwin Growth)
   - `slug` (ex.: `darwin-growth`)
   - `status` (`active`, `inactive`, `archived`)
   - `is_demo` (bool, default false)
   - `created_at`, `updated_at`

2. `committees`
   - `id`
   - `program_id` (FK `programs.id`)
   - `name` (ex.: Comitê Alpha)
   - `status`
   - `max_companies` (default 4)
   - `created_at`, `updated_at`

3. `committee_companies`
   - `id`
   - `committee_id` (FK `committees.id`)
   - `company_id` (FK `companies.id`)
   - `joined_at`
   - `left_at` (nullable)
   - unique ativo por `committee_id + company_id`

4. `program_memberships`
   - `id`
   - `program_id` (FK `programs.id`)
   - `user_id` (FK `auth.users.id`)
   - `role` (papéis de programa)
   - `status` (`pending`, `approved`, `inactive`)
   - `created_at`, `updated_at`

5. `committee_user_roles`
   - `id`
   - `committee_id` (FK `committees.id`)
   - `user_id` (FK `auth.users.id`)
   - `role` (papéis de comitê)
   - `status`
   - `created_at`, `updated_at`

6. `company_memberships`
   - `id`
   - `company_id` (FK `companies.id`)
   - `user_id` (FK `auth.users.id`)
   - `role` (ex.: `founder_startup`, `advisor`, etc.)
   - `status`
   - `created_at`, `updated_at`

## 3.2 Alterações em tabelas existentes

1. `companies`
   - adicionar `program_id` (FK `programs.id`)
   - adicionar `is_demo` (bool, default false)

2. (Opcional, recomendado) colunas de visibilidade por conteúdo crítico:
   - `visibility_scope` enum sugerido:
     - `program_internal`
     - `committee_internal`
     - `company_internal`
     - `shared_with_founders`

Aplicável inicialmente em:
- `council_meetings`
- `council_actions`
- `council_dimension_progress`
- (eventualmente) observações de `assessments`.

## 3.3 Regras de consistência

- `companies.program_id` deve ser coerente com `committee_companies` via `committees.program_id`.
- `companies.is_demo = true` exige vínculo a `programs.is_demo = true`.
- `demo_user` nunca deve ter membership em `programs.is_demo = false`.

---

## 4) Matriz de permissões por papel (proposta)

Legenda: C=criar, R=ler, U=editar, D=remover, M=gerir memberships.

- **JV Partner**
  - Escopo: programa
  - Permissões: C/R/U em startups, reuniões, ações, progresso; R em metodologia; M alto.

- **JV Operator**
  - Escopo: programa
  - Permissões: C/R/U operacional; sem D estrutural sensível; M operacional.

- **Darwin Partner Admin**
  - Escopo: programa/comitês atribuídos
  - Permissões: C/R/U em comitês/startups atribuídas; M em comitês atribuídos.

- **Darwin Partner**
  - Escopo: comitês atribuídos
  - Permissões: R amplo + C/U em agenda, ações, progresso e inputs de acompanhamento.

- **Founder Growth Partner**
  - Escopo: comitês/startups atribuídas
  - Permissões: R em conteúdo compartilhável; C/U em acompanhamentos definidos.

- **Guest Growth Partner**
  - Escopo: comitê e janela temporal da participação
  - Permissões: R restrito + C/U pontual quando explicitamente concedido.

- **Committee President**
  - Escopo: comitê
  - Permissões: C/R/U em reuniões/ações/progresso do comitê; validação de pautas.

- **Committee Vice-President**
  - Escopo: comitê
  - Permissões: semelhante ao President, sem algumas capacidades administrativas opcionais.

- **Founder Startup**
  - Escopo: própria startup
  - Permissões: R em conteúdo `shared_with_founders` e `company_internal` (quando definido), C/U em atualizações permitidas (ex.: status de ação atribuída).

- **Demo User**
  - Escopo: somente demo
  - Permissões: R (e opcionalmente C/U simulados) apenas em registros `is_demo = true`.

---

## 5) Escopo de acesso (programa/comitê/startup/conteúdo)

## 5.1 Por programa

Regra base: usuário precisa de `program_memberships.status = approved` no `program_id` do registro alvo.

## 5.2 Por comitê

Além do programa, para dados de comitê:
- membership em `committee_user_roles` **ou**
- papel de programa com privilégio transversal (ex.: `jv_partner`, `jv_operator`, `darwin_partner_admin`).

## 5.3 Por startup

Acesso quando:
- startup pertence ao programa do usuário, e
- usuário está vinculado via `company_memberships`, **ou** startup está em comitê ao qual ele pertence, **ou** possui papel transversal do programa.

## 5.4 Por conteúdo compartilhável vs interno

Usar `visibility_scope`:
- `program_internal`: apenas operação/parceiros do programa.
- `committee_internal`: apenas membros do comitê.
- `company_internal`: operação + membros da startup.
- `shared_with_founders`: inclui `founder_startup` da startup.

---

## 6) Regras para modo demo

1. Criar um programa dedicado, ex.: **Darwin Growth (Demo)**.
2. Todo registro demo deve estar em tenant demo:
   - `programs.is_demo = true`
   - `companies.is_demo = true`
3. `demo_user` acessa **somente** `is_demo = true`.
4. Bloquear mistura real/demo em joins e policies.
5. Exibir banner persistente na UI:
   - **“Modo Demo — dados fictícios do Darwin Growth”**.
6. Permitir rotina de reset de dados demo (futuro), sem impacto em dados reais.

---

## 7) Impacto no frontend

## 7.1 Menu lateral
- Filtrar entradas por papel e escopo real de membership.
- Destacar contexto ativo: Programa > Comitê (quando aplicável).

## 7.2 Dashboard
- KPIs por programa ativo do usuário.
- Recortes por comitê e startups vinculadas.
- No demo: dados somente do programa demo.

## 7.3 Startups/Organizações
- Renomear domínio visual para **Startups**.
- Lista filtrada por `program_id`, memberships e demo flag.

## 7.4 Central do Conselheiro
- Exibir comitês atribuídos + agendas relacionadas.
- Respeitar `visibility_scope` no detalhe de materiais.

## 7.5 Agenda
- Tipos de reunião canonizados:
  - Comitê
  - Acompanhamento Individual
  - Touchpoint do Comitê
  - Reunião Extraordinária
- Filtros por programa/comitê/startup.

## 7.6 Relatórios
- Visibilidade por escopo e papel (evitar acesso por URL direta fora do escopo).

## 7.7 Metodologia
- Conteúdo majoritariamente `program_internal`; separar leitura operacional vs administração metodológica.

## 7.8 Usuários
- Gestão orientada por memberships (programa/comitê/startup), não apenas role global.

---

## 8) Impacto em RLS (alvos solicitados)

## 8.1 `companies`
- SELECT/UPDATE condicionado a `program_memberships` + regra de comitê/startup/demo.

## 8.2 `assessments`
- Herdar acesso da `company` vinculada + `visibility_scope` quando aplicável.

## 8.3 `founders` / lideranças
- Acesso por `company_memberships` e papéis operacionais do programa/comitê.

## 8.4 `council_meetings`
- Acesso por `committee_id` + papel de programa/comitê; aplicar tipo de reunião canonizado.

## 8.5 `council_actions`
- Acesso derivado da reunião/company + `visibility_scope`.

## 8.6 `council_dimension_progress`
- Acesso por startup/comitê + escopo de visibilidade.

## 8.7 Config/metodologia (`config_versions`, `dimensions`, `questions`, `red_flags`)
- Leitura: papéis operacionais aprovados no programa.
- Escrita: papéis administrativos metodológicos (ex.: JV Partner / operador autorizado).
- Possível evolução para versionamento por programa.

---

## 9) Fases de implementação sugeridas

## Fase 1 — modelagem base sem bloquear acesso atual
- Introduzir tabelas novas (`programs`, `committees`, memberships, vínculos).
- Preencher relacionamentos iniciais mantendo compatibilidade com fluxo atual.
- Adicionar colunas `companies.program_id` e `companies.is_demo`.

## Fase 2 — RLS por programa/comitê/startup
- Criar helpers SQL de escopo (`has_program_access`, `has_committee_access`, `has_company_access`).
- Migrar policies progressivamente por domínio.

## Fase 3 — UI por papel
- Ajustar guards, menu, filtros e páginas para contexto de membership.

## Fase 4 — modo demo
- Criar tenant demo isolado, policies e banner persistente.

## Fase 5 — visibilidade granular de conteúdo
- Adotar `visibility_scope` nas entidades de conteúdo.
- Refinar compartilhamento com founders e convidados.

---

## 10) Observações finais

- Este documento substitui o enquadramento anterior baseado em “Conselho OS” por **Darwin Growth**.
- Não foram feitas alterações de código funcional nem migrations neste ciclo.
- Próximo passo recomendado: converter esta proposta em backlog técnico priorizado (DDL, backfill, policies, ajustes de frontend e plano de rollout).
