

## Plan: Polish profissional do sistema CMJ/Darwin

Baseado na análise completa do codebase, aqui estão as melhorias que tornariam o sistema significativamente mais profissional:

### 1. Breadcrumbs de navegação contextual
Adicionar breadcrumbs no header do `AppLayout` que mostram o caminho atual (ex: "Startups > TechCo > Questionário"). Isso dá contexto de localização e facilita a navegação para trás.

- Criar componente `AppBreadcrumbs` que lê a rota atual e gera os links
- Integrar no `<header>` do `AppLayout`, ao lado do botão de menu mobile

### 2. Empty states e 404 mais polidos
A página 404 atual é genérica e em inglês. Melhorar com:
- Texto em português, ícone ilustrativo, botão estilizado de volta
- Mensagem contextual ("Página não encontrada")

### 3. Micro-interações e feedback visual
- Adicionar `focus-visible` rings consistentes nos botões de score do questionário (1-5)
- Hover states mais elaborados nos cards de startups (sutil lift com `translate-y` + sombra)
- Animação de entrada staggered nos cards do dashboard e lista de startups (já parcialmente implementado, mas pode melhorar consistência)

### 4. Footer discreto no sidebar com versão
- Adicionar indicador de versão/build no rodapé do sidebar (ex: "v1.0.0")
- Pequeno texto "CMJ/Darwin" como marca no footer

### 5. Skeleton no Questionário
A página de questionário retorna `null` quando `config` não carregou. Adicionar skeleton de carregamento consistente com as demais páginas.

### 6. Favicon e meta tags
- Atualizar o `<title>` no `index.html` para "CMJ/Darwin — Startup Readiness"
- Adicionar meta description e og tags básicas para aparência profissional quando compartilhado

### 7. Scroll-to-top automático na navegação
Ao trocar de página, o scroll não volta ao topo automaticamente. Adicionar componente `ScrollToTop` no router para resetar a posição.

### 8. Transição suave nos cards de métricas do Dashboard
Adicionar `counter animation` nos números do dashboard (0 -> valor final) com efeito de contagem.

---

### Resumo técnico de arquivos afetados

| Melhoria | Arquivos |
|---|---|
| Breadcrumbs | Novo `AppBreadcrumbs.tsx`, editar `AppLayout.tsx` |
| 404 polido | `NotFound.tsx` |
| Micro-interações | `QuestionnairePage.tsx`, `StartupsPage.tsx`, `index.css` |
| Footer sidebar | `AppLayout.tsx` |
| Skeleton questionário | `QuestionnairePage.tsx` |
| Meta tags | `index.html` |
| Scroll-to-top | Novo `ScrollToTop.tsx`, editar `App.tsx` |
| Counter animation | `DashboardPage.tsx` |

