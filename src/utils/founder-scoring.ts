// Founder Score scoring engine

export const PILLARS = [
  { number: 0, name: 'Execução e Ritmo', weight: 0, description: 'Diagnóstico de contexto — não entra no score.' },
  { number: 1, name: 'Pessoas & Autonomia do Time', weight: 0.20, description: 'Clareza de papéis, contratações-chave, retenção de talentos e autonomia.' },
  { number: 2, name: 'Execução Operacional em Ambiente Ambíguo', weight: 0.20, description: 'Ritmo de entregas, priorização real, redução de retrabalho.' },
  { number: 3, name: 'Liderança & Maturidade Decisória', weight: 0.20, description: 'Velocidade e qualidade de decisão, assunção de erros, postura.' },
  { number: 4, name: 'Gestão Financeira / Disciplina de Caixa', weight: 0.25, description: 'Burn rate, impacto financeiro, validação antes de apostas.' },
  { number: 5, name: 'Aprendizado & Evolução Estratégica', weight: 0.15, description: 'Articulação de aprendizados, testes com método, racional explícito.' },
] as const;

export const PILLAR_QUESTIONS: Record<number, string[]> = {
  0: [
    'Qual a cadência de entregas (semanal, quinzenal)?',
    'Existem rituais estabelecidos (weekly, OKRs, sprints)?',
    'O ritmo de execução é consistente ou irregular?',
  ],
  1: [
    'O time tem clareza de papéis críticos?',
    'Foram feitas as contratações-chave, ou evitadas corretamente para não encarecer o custo fixo?',
    'O founder demonstra capacidade de atrair e reter talentos?',
    'O founder consegue administrar conversas difíceis?',
    'O time funciona com menor dependência do founder?',
  ],
  2: [
    'O founder imprime ritmo consistente nas entregas?',
    'Demonstra capacidade de priorização real?',
    'Consegue reduzir retrabalho ao longo do tempo?',
    'Executa sem recorrer a microgerenciamento?',
  ],
  3: [
    'O founder decide mais rápido que no semestre anterior?',
    'Seu processo de decisão é estruturado (não apenas intuitivo)?',
    'Assume erros sem terceirizar culpa?',
    'Havendo erro, busca aprendizado e registra?',
    'Faz perguntas de maior qualidade a cada ciclo?',
    'Mantém postura firme sem confronto improdutivo?',
  ],
  4: [
    'Sabe exatamente quanto custa um mês vivo (burn rate)?',
    'Consegue ligar decisões operacionais a impacto financeiro direto?',
    'Evita apostas irreversíveis antes de ter validação suficiente?',
  ],
  5: [
    'Consegue articular claramente o que aprendeu no semestre?',
    'Aprende com dados do mercado real (clientes pagantes, não apenas hipóteses)?',
    'Testa hipóteses com método (não apenas reage)?',
    'Mudanças de direção têm racional explícito, não são reativas?',
  ],
};

export const SCORE_ANCHORS: Record<number, string> = {
  1: 'Inexistente / Reativo',
  2: 'Iniciando / Frágil',
  3: 'Básico funcionando',
  4: 'Consistente / Maduro',
  5: 'Referência / Escalável',
};

export function computePillarScoreUsed(scoreAuto: number | null, scoreJv: number | null): number | null {
  if (scoreAuto != null && scoreJv != null) return (scoreAuto + scoreJv) / 2;
  return scoreJv ?? scoreAuto ?? null;
}

export function computeFounderScore(pillarScores: { pillar_number: number; score_auto: number | null; score_jv: number | null }[]): {
  scoreAuto: number | null;
  scoreJv: number | null;
  scoreUsed: number | null;
} {
  const scored = pillarScores.filter(p => p.pillar_number >= 1 && p.pillar_number <= 5);
  
  let sumAuto = 0, sumJv = 0, sumUsed = 0;
  let hasAuto = false, hasJv = false, hasAny = false;
  
  for (const p of scored) {
    const pillar = PILLARS.find(pi => pi.number === p.pillar_number);
    if (!pillar) continue;
    const w = pillar.weight;
    
    if (p.score_auto != null) { sumAuto += w * p.score_auto; hasAuto = true; }
    if (p.score_jv != null) { sumJv += w * p.score_jv; hasJv = true; }
    
    const used = computePillarScoreUsed(p.score_auto, p.score_jv);
    if (used != null) { sumUsed += w * used; hasAny = true; }
  }
  
  return {
    scoreAuto: hasAuto ? Math.round(sumAuto * 20 * 10) / 10 : null,
    scoreJv: hasJv ? Math.round(sumJv * 20 * 10) / 10 : null,
    scoreUsed: hasAny ? Math.round(sumUsed * 20 * 10) / 10 : null,
  };
}

export function getFounderStageLabel(score: number): { label: string; color: string } {
  if (score >= 80) return { label: 'Founder em forte evolução', color: 'text-emerald-600' };
  if (score >= 65) return { label: 'Evolução positiva, com alertas', color: 'text-amber-600' };
  if (score >= 50) return { label: 'Risco de estagnação', color: 'text-orange-600' };
  return { label: 'Risco estrutural de liderança', color: 'text-destructive' };
}

export function getPillarLevel(scoreUsed: number): number {
  if (scoreUsed <= 2) return 1;
  if (scoreUsed < 4) return 2;
  return 3;
}

export function computePriorityScore(scoreUsed: number, weight: number): number {
  return (5 - scoreUsed) * weight;
}

export function getCurrentSemester(): string {
  const now = new Date();
  const year = now.getFullYear();
  const half = now.getMonth() < 6 ? 'S1' : 'S2';
  return `${year}-${half}`;
}

// Action recommendations per pillar per level
export const ACTION_RECOMMENDATIONS: Record<number, Record<number, { actions: string; delivery: string }>> = {
  1: {
    1: { actions: 'Papéis claros, dono+prazo combinados, 1:1 quinzenal', delivery: 'Papéis claros + ritual fixo de gestão' },
    2: { actions: 'Delegar por resultado, rituais leves (weekly), feedback simples', delivery: 'Delegação ativa documentada' },
    3: { actions: 'Contratar melhor, cultura de performance, sucessão de responsabilidades', delivery: 'Sucessão de 1 responsabilidade crítica' },
  },
  2: {
    1: { actions: 'Ritual semanal, definição de "done", lista única de prioridades', delivery: 'Ritual semanal + 2 semanas seguidas de execução documentada' },
    2: { actions: 'WIP limitado, sprint semanal simples, review de entregas', delivery: 'Sprint semanal com review' },
    3: { actions: 'Delegar execução, otimizar fluxo, automatizar acompanhamento', delivery: '1 processo automatizado ou delegado' },
  },
  3: {
    1: { actions: 'Critérios Impacto x Esforço, 3 prioridades/semana, "lista do não"', delivery: 'Framework simples de decisão + lista clara de "nãos"' },
    2: { actions: 'Registrar decisões + motivo, janela de decisão, kill list mensal', delivery: 'Log de decisões com 4 semanas de histórico' },
    3: { actions: 'Melhorar qualidade das apostas, comunicar trade-offs ao time', delivery: 'Trade-off comunicado em reunião de time' },
  },
  4: {
    1: { actions: 'Planilha de caixa + runway + custos fixos + metas de receita', delivery: 'Planilha viva de caixa + runway claro' },
    2: { actions: 'Margem mínima, cenários (base/ruim/ótimo), metas semanais/mensais', delivery: 'Cenário documentado com 3 versões' },
    3: { actions: 'Orçamento, investimento por ROI, governança financeira', delivery: 'Orçamento semestral com ROI por linha' },
  },
  5: {
    1: { actions: '1 hipótese por vez, definir métrica, registrar aprendizado', delivery: 'Backlog de hipóteses + 2 experimentos concluídos com lições' },
    2: { actions: 'Cadência de experimentos, critérios de stop/go, síntese do aprendizado', delivery: 'Cadência quinzenal de revisão de experimentos' },
    3: { actions: 'Escalar canal/estratégia vencedora, institucionalizar playbooks', delivery: '1 playbook documentado de canal ou estratégia validada' },
  },
};
