import type { Assessment, AssessmentResult, ConfigJSON, Answer } from '@/types/darwin';
import {
  computeBlocks,
  getBlocks,
  getLevel,
  scoreTo100,
  generateOverallNarrative,
  getCompleteness,
  computeGaps,
  generateRoadmap,
} from '@/utils/report-helpers';
import { computeParetoActions, selectTop5, generateMeetingAgenda, compute2x2Matrix } from '@/utils/pareto-engine';



// Darwin palette (kept in sync with theme)
const C = {
  bg: '0B1220',
  panel: '111827',
  panelLight: '1F2937',
  text: 'E5E7EB',
  textMuted: '94A3B8',
  primary: '4ADE80',
  accent: 'A78BFA',
  warning: 'F59E0B',
  danger: 'EF4444',
  border: '334155',
};

const SLIDE_W = 13.333;
const SLIDE_H = 7.5;
const MARGIN = 0.5;

const SEV_COLOR: Record<string, string> = {
  critical: C.danger,
  high: C.danger,
  medium_high: C.warning,
  medium: C.warning,
  low: C.textMuted,
};
const SEV_LABEL: Record<string, string> = {
  critical: 'Crítico',
  high: 'Crítico',
  medium_high: 'Atenção',
  medium: 'Atenção',
  low: 'Monitorar',
};

export async function exportReportToPPTX(opts: {
  assessment: Assessment;
  config: ConfigJSON;
  result: AssessmentResult;
  answers: Answer[];
  startupName: string;
}) {
  const PptxGenJS = (await import('pptxgenjs')).default;
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE'; // 13.333 x 7.5
  pptx.theme = { headFontFace: 'Calibri', bodyFontFace: 'Calibri' };

  const { assessment, config, result, startupName, answers } = opts;
  const stage = assessment.stage || 'seed';
  const isSimulation = !!assessment.is_simulation;
  const dateStr = new Date(assessment.created_at).toLocaleDateString('pt-BR');
  const completeness = getCompleteness(result);

  const overallPct = scoreTo100(result.overall_weighted ?? result.overall_score);
  const level = getLevel(overallPct);
  const blocks = computeBlocks(getBlocks(config), result.dimension_scores, config, stage);
  const narrative = generateOverallNarrative(result, config, stage);

  // --- Shared helpers ---
  const bgFill = { color: C.bg };
  const addBg = (s: any) => s.background = bgFill;

  const addHeader = (slide: any, title: string, subtitle?: string) => {
    slide.addText(title, {
      x: MARGIN, y: 0.35, w: SLIDE_W - MARGIN * 2, h: 0.55,
      fontSize: 28, bold: true, color: C.text, fontFace: 'Calibri',
    });
    if (subtitle) {
      slide.addText(subtitle, {
        x: MARGIN, y: 0.92, w: SLIDE_W - MARGIN * 2, h: 0.35,
        fontSize: 14, color: C.textMuted,
      });
    }
    // Accent strip
    slide.addShape(pptx.ShapeType.rect, {
      x: MARGIN, y: 1.32, w: 0.6, h: 0.06, fill: { color: C.primary }, line: { color: C.primary },
    });
  };

  const addFooter = (slide: any, pageNum: number, totalPages: number) => {
    slide.addText('Darwin · Diagnóstico de Maturidade', {
      x: MARGIN, y: SLIDE_H - 0.4, w: 6, h: 0.3,
      fontSize: 9, color: C.textMuted,
    });
    slide.addText(`${startupName} · ${dateStr} · ${pageNum}/${totalPages}`, {
      x: SLIDE_W - 6 - MARGIN, y: SLIDE_H - 0.4, w: 6, h: 0.3,
      fontSize: 9, color: C.textMuted, align: 'right',
    });
    if (isSimulation) {
      slide.addText('SIMULAÇÃO', {
        x: SLIDE_W / 2 - 3, y: SLIDE_H / 2 - 0.6, w: 6, h: 1.2,
        fontSize: 80, bold: true, color: C.danger, align: 'center', transparency: 85, rotate: -20,
      });
    }
  };

  const card = (slide: any, x: number, y: number, w: number, h: number, fillColor = C.panel) => {
    slide.addShape(pptx.ShapeType.roundRect, {
      x, y, w, h, fill: { color: fillColor }, line: { color: C.border, width: 1 }, rectRadius: 0.08,
    });
  };

  // ===== SLIDE 1: Capa =====
  const s1 = pptx.addSlide(); addBg(s1);
  s1.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: SLIDE_W, h: 0.18, fill: { color: C.primary }, line: { color: C.primary },
  });
  s1.addText('DARWIN', {
    x: MARGIN, y: 0.6, w: 6, h: 0.5,
    fontSize: 18, bold: true, color: C.primary, charSpacing: 4,
  });
  s1.addText('Relatório de Diagnóstico', {
    x: MARGIN, y: 2.0, w: SLIDE_W - MARGIN * 2, h: 0.8,
    fontSize: 36, color: C.textMuted,
  });
  s1.addText(startupName, {
    x: MARGIN, y: 2.8, w: SLIDE_W - MARGIN * 2, h: 1.4,
    fontSize: 60, bold: true, color: C.text,
  });
  // Score callout
  card(s1, MARGIN, 4.6, 4.5, 2.1, C.panelLight);
  s1.addText('Score Geral', { x: MARGIN + 0.3, y: 4.75, w: 4, h: 0.4, fontSize: 14, color: C.textMuted });
  s1.addText(String(overallPct), {
    x: MARGIN + 0.3, y: 5.1, w: 2.5, h: 1.4, fontSize: 72, bold: true, color: C.primary,
  });
  s1.addText('/ 100', { x: MARGIN + 2.5, y: 5.7, w: 1.5, h: 0.5, fontSize: 18, color: C.textMuted });
  s1.addText(level.label, {
    x: MARGIN + 0.3, y: 6.25, w: 4, h: 0.4, fontSize: 16, bold: true, color: C.accent,
  });

  s1.addText(`Estágio: ${stage.toUpperCase()}   ·   ${dateStr}   ·   Confiança: ${completeness.confidenceLabel}`, {
    x: 5.5, y: 6.3, w: SLIDE_W - 5.5 - MARGIN, h: 0.4,
    fontSize: 12, color: C.textMuted, align: 'right',
  });

  // ===== SLIDE 2: Sumário executivo =====
  const s2 = pptx.addSlide(); addBg(s2);
  addHeader(s2, 'Sumário Executivo', `${startupName} · ${dateStr}`);
  // Narrative card
  card(s2, MARGIN, 1.6, SLIDE_W - MARGIN * 2, 3.2);
  s2.addText(narrative, {
    x: MARGIN + 0.3, y: 1.8, w: SLIDE_W - MARGIN * 2 - 0.6, h: 2.85,
    fontSize: 14, color: C.text, valign: 'top', paraSpaceAfter: 6,
  });
  // KPI row
  const kpiW = (SLIDE_W - MARGIN * 2 - 0.4) / 3;
  const kpis = [
    { label: 'Score Geral', value: String(overallPct), sub: `/ 100 · ${level.label}`, color: C.primary },
    { label: 'Red Flags', value: String(result.red_flags.length), sub: 'identificados', color: result.red_flags.length > 0 ? C.warning : C.primary },
    { label: 'Completude', value: `${completeness.pct}%`, sub: `${completeness.answered}/${completeness.total} questões`, color: C.accent },
  ];
  kpis.forEach((k, i) => {
    const x = MARGIN + i * (kpiW + 0.2);
    card(s2, x, 5.0, kpiW, 1.7, C.panelLight);
    s2.addText(k.label, { x: x + 0.2, y: 5.1, w: kpiW - 0.4, h: 0.35, fontSize: 12, color: C.textMuted });
    s2.addText(k.value, { x: x + 0.2, y: 5.4, w: kpiW - 0.4, h: 0.9, fontSize: 44, bold: true, color: k.color });
    s2.addText(k.sub, { x: x + 0.2, y: 6.3, w: kpiW - 0.4, h: 0.35, fontSize: 11, color: C.textMuted });
  });

  // ===== SLIDE 3: Blocos =====
  const s3 = pptx.addSlide(); addBg(s3);
  addHeader(s3, 'Performance por Bloco', 'Visão consolidada de Crescimento, Fundamentos e Execução');
  const bW = (SLIDE_W - MARGIN * 2 - 0.4) / 3;
  blocks.forEach((b, i) => {
    const x = MARGIN + i * (bW + 0.2);
    card(s3, x, 1.8, bW, 4.6);
    s3.addText(b.label.toUpperCase(), {
      x: x + 0.3, y: 2.0, w: bW - 0.6, h: 0.4, fontSize: 14, bold: true, color: C.accent, charSpacing: 2,
    });
    s3.addText(String(b.score100), {
      x: x + 0.3, y: 2.5, w: bW - 0.6, h: 1.6, fontSize: 80, bold: true, color: C.primary, align: 'center',
    });
    s3.addText(b.level.label, {
      x: x + 0.3, y: 4.2, w: bW - 0.6, h: 0.4, fontSize: 16, bold: true, color: C.text, align: 'center',
    });
    s3.addText(`Dimensão mais frágil:`, {
      x: x + 0.3, y: 4.95, w: bW - 0.6, h: 0.3, fontSize: 11, color: C.textMuted,
    });
    s3.addText(b.lowestDim || '—', {
      x: x + 0.3, y: 5.25, w: bW - 0.6, h: 0.9, fontSize: 13, color: C.text, italic: true,
    });
  });

  // ===== SLIDE 3b: Radar — Atual vs Benchmark vs Potencial =====
  const sRadar = pptx.addSlide(); addBg(sRadar);
  addHeader(sRadar, 'Radar · Atual vs Benchmark vs Potencial', 'Visão das 9 dimensões em um único panorama');
  const radarDims = result.dimension_scores;
  const radarLabels = radarDims.map(d => d.label);
  const radarActual = radarDims.map(d => Number(scoreTo100(d.score)));
  const radarBench = radarDims.map(d => Number(scoreTo100(d.target)));
  const potentialMap = (() => {
    const targets = config.targets_by_stage?.[stage] || {};
    const m: Record<string, number> = {};
    radarDims.forEach(d => {
      const raw = (targets as any)[d.dimension_id];
      const num = typeof raw === 'number' ? raw : (raw?.benchmark ?? raw?.target ?? d.target);
      m[d.dimension_id] = scoreTo100(Math.max(num, d.target, d.score));
    });
    return m;
  })();
  const radarPotential = radarDims.map(d => Number(potentialMap[d.dimension_id]));
  card(sRadar, MARGIN, 1.6, SLIDE_W - MARGIN * 2, 5.4);
  sRadar.addChart(pptx.ChartType.radar, [
    { name: 'Atual', labels: radarLabels, values: radarActual },
    { name: 'Benchmark', labels: radarLabels, values: radarBench },
    { name: 'Potencial', labels: radarLabels, values: radarPotential },
  ], {
    x: MARGIN + 0.2, y: 1.75, w: SLIDE_W - MARGIN * 2 - 0.4, h: 5.1,
    radarStyle: 'standard',
    chartColors: [C.primary, C.textMuted, C.accent],
    showLegend: true, legendPos: 'b', legendColor: C.text, legendFontSize: 11,
    catAxisLabelColor: C.text, catAxisLabelFontSize: 10,
    valAxisLabelColor: C.textMuted, valAxisLabelFontSize: 9,
    valAxisMinVal: 0, valAxisMaxVal: 100,
    plotArea: { fill: { color: C.panel } },
  });

  // ===== SLIDE 4: Dimensões table =====
  const s4 = pptx.addSlide(); addBg(s4);

  addHeader(s4, 'Análise por Dimensão', 'Score atual vs. benchmark de estágio');
  const dims = [...result.dimension_scores].sort((a, b) => a.score - b.score);
  const rows: any[][] = [[
    { text: 'Dimensão', options: { bold: true, color: C.text, fill: { color: C.panelLight } } },
    { text: 'Score', options: { bold: true, color: C.text, fill: { color: C.panelLight }, align: 'center' } },
    { text: 'Benchmark', options: { bold: true, color: C.text, fill: { color: C.panelLight }, align: 'center' } },
    { text: 'Cobertura', options: { bold: true, color: C.text, fill: { color: C.panelLight }, align: 'center' } },
    { text: 'Nível', options: { bold: true, color: C.text, fill: { color: C.panelLight }, align: 'center' } },
  ]];
  dims.forEach(d => {
    const s100 = scoreTo100(d.score);
    const t100 = scoreTo100(d.target);
    const lv = getLevel(s100);
    rows.push([
      { text: d.label, options: { color: C.text, fill: { color: C.panel } } },
      { text: String(s100), options: { color: C.primary, bold: true, fill: { color: C.panel }, align: 'center' } },
      { text: String(t100), options: { color: C.textMuted, fill: { color: C.panel }, align: 'center' } },
      { text: `${d.answered}/${d.total}`, options: { color: C.textMuted, fill: { color: C.panel }, align: 'center' } },
      { text: lv.label, options: { color: C.accent, fill: { color: C.panel }, align: 'center' } },
    ]);
  });
  s4.addTable(rows, {
    x: MARGIN, y: 1.6, w: SLIDE_W - MARGIN * 2,
    colW: [5.0, 1.5, 1.6, 1.6, 2.633].slice(0, 5),
    fontSize: 12, fontFace: 'Calibri', border: { type: 'solid', color: C.border, pt: 0.5 },
    rowH: 0.35,
  });

  // ===== SLIDE 5: Red Flags =====
  const rfs = result.red_flags;
  const rfPages = Math.max(1, Math.ceil(rfs.length / 6));
  for (let p = 0; p < rfPages; p++) {
    const slide = pptx.addSlide(); addBg(slide);
    addHeader(slide, `Red Flags ${rfPages > 1 ? `(${p + 1}/${rfPages})` : ''}`,
      rfs.length === 0 ? 'Nenhum red flag identificado' : `${rfs.length} red flag(s) identificado(s)`);
    const slice = rfs.slice(p * 6, p * 6 + 6);
    if (slice.length === 0) {
      card(slide, MARGIN, 2.5, SLIDE_W - MARGIN * 2, 2.5);
      slide.addText('✓ Nenhum red flag ativo no momento.', {
        x: MARGIN, y: 3.5, w: SLIDE_W - MARGIN * 2, h: 0.6,
        fontSize: 20, color: C.primary, align: 'center', bold: true,
      });
    } else {
      const cols = 2;
      const colW = (SLIDE_W - MARGIN * 2 - 0.3) / cols;
      const rowH = 1.55;
      slice.forEach((rf, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = MARGIN + col * (colW + 0.3);
        const y = 1.7 + row * (rowH + 0.2);
        card(slide, x, y, colW, rowH);
        // Severity stripe
        slide.addShape(pptx.ShapeType.rect, {
          x, y, w: 0.1, h: rowH, fill: { color: SEV_COLOR[rf.severity] || C.warning }, line: { color: SEV_COLOR[rf.severity] || C.warning },
        });
        slide.addText(SEV_LABEL[rf.severity] || 'Atenção', {
          x: x + 0.25, y: y + 0.1, w: colW - 0.4, h: 0.3,
          fontSize: 10, bold: true, color: SEV_COLOR[rf.severity] || C.warning, charSpacing: 2,
        });
        slide.addText(rf.label, {
          x: x + 0.25, y: y + 0.4, w: colW - 0.4, h: 0.5,
          fontSize: 13, bold: true, color: C.text,
        });
        const action = (rf.actions && rf.actions[0]) || '—';
        slide.addText(`Ação: ${action}`, {
          x: x + 0.25, y: y + 0.92, w: colW - 0.4, h: 0.55,
          fontSize: 11, color: C.textMuted,
        });
      });
    }
  }

  // ===== SLIDE 6: Quick Wins =====
  const scored = computeParetoActions(config, result, stage);
  const top5 = selectTop5(scored, result, config);
  const s6 = pptx.addSlide(); addBg(s6);
  addHeader(s6, 'Quick Wins · Top 5 Ações', 'Maior impacto · menor esforço · próximas 4 semanas');
  const rowH6 = 0.92;
  top5.forEach((a, i) => {
    const y = 1.7 + i * (rowH6 + 0.12);
    card(s6, MARGIN, y, SLIDE_W - MARGIN * 2, rowH6);
    // Number badge
    slide_badge(pptx, s6, MARGIN + 0.15, y + 0.18, 0.6, 0.6, String(i + 1), C.primary);
    s6.addText(a.title, {
      x: MARGIN + 0.95, y: y + 0.1, w: SLIDE_W - MARGIN * 2 - 3.2, h: 0.4,
      fontSize: 14, bold: true, color: C.text,
    });
    s6.addText(a.first_step || a.description || '', {
      x: MARGIN + 0.95, y: y + 0.45, w: SLIDE_W - MARGIN * 2 - 3.2, h: 0.4,
      fontSize: 11, color: C.textMuted,
    });
    // Pills (effort + days)
    const pillX = SLIDE_W - MARGIN - 2.1;
    s6.addShape(pptx.ShapeType.roundRect, {
      x: pillX, y: y + 0.18, w: 0.9, h: 0.42, fill: { color: C.panelLight }, line: { color: C.border }, rectRadius: 0.06,
    });
    s6.addText(`Esforço ${a.effort}`, {
      x: pillX, y: y + 0.18, w: 0.9, h: 0.42, fontSize: 10, color: C.accent, align: 'center', bold: true,
    });
    s6.addShape(pptx.ShapeType.roundRect, {
      x: pillX + 1.0, y: y + 0.18, w: 1.05, h: 0.42, fill: { color: C.panelLight }, line: { color: C.border }, rectRadius: 0.06,
    });
    s6.addText(`${a.time_to_impact_days}d`, {
      x: pillX + 1.0, y: y + 0.18, w: 1.05, h: 0.42, fontSize: 10, color: C.primary, align: 'center', bold: true,
    });
  });
  if (top5.length === 0) {
    s6.addText('Sem ações disponíveis na biblioteca atual.', {
      x: MARGIN, y: 3.5, w: SLIDE_W - MARGIN * 2, h: 0.5, fontSize: 16, color: C.textMuted, align: 'center',
    });
  }

  // ===== SLIDE 7: Pauta do Conselho =====
  const agenda = generateMeetingAgenda(config, result, stage, answers.map(a => ({
    question_id: a.question_id, dimension_id: '', score: a.value, value: a.value,
  })) as any);
  const s7 = pptx.addSlide(); addBg(s7);
  addHeader(s7, 'Pauta · Próximo Conselho', 'Tópicos priorizados para a próxima reunião');
  const itemH = (SLIDE_H - 2.4) / Math.max(1, Math.min(agenda.length, 3));
  agenda.slice(0, 3).forEach((it, i) => {
    const y = 1.7 + i * (itemH + 0.1);
    card(s7, MARGIN, y, SLIDE_W - MARGIN * 2, itemH - 0.1);
    slide_badge(pptx, s7, MARGIN + 0.2, y + 0.2, 0.55, 0.55, String(i + 1), C.accent);
    s7.addText(it.topic, {
      x: MARGIN + 0.9, y: y + 0.15, w: SLIDE_W - MARGIN * 2 - 1.2, h: 0.5,
      fontSize: 16, bold: true, color: C.text,
    });
    const prompts = (it.deep_dive_prompts || []).slice(0, 2).map(p => `• ${p}`).join('\n');
    s7.addText(prompts, {
      x: MARGIN + 0.9, y: y + 0.7, w: SLIDE_W - MARGIN * 2 - 1.2, h: itemH - 1.3,
      fontSize: 12, color: C.textMuted, valign: 'top',
    });
    if (it.expected_decision) {
      s7.addText(`Decisão esperada: ${it.expected_decision}`, {
        x: MARGIN + 0.9, y: y + itemH - 0.65, w: SLIDE_W - MARGIN * 2 - 1.2, h: 0.4,
        fontSize: 11, italic: true, color: C.primary,
      });
    }
  });
  if (agenda.length === 0) {
    s7.addText('Sem tópicos prioritários identificados.', {
      x: MARGIN, y: 3.5, w: SLIDE_W - MARGIN * 2, h: 0.5, fontSize: 16, color: C.textMuted, align: 'center',
    });
  }

  // ===== SLIDE 8: Encerramento =====
  const s8 = pptx.addSlide(); addBg(s8);
  s8.addShape(pptx.ShapeType.rect, {
    x: 0, y: SLIDE_H - 0.18, w: SLIDE_W, h: 0.18, fill: { color: C.primary }, line: { color: C.primary },
  });
  s8.addText('Próximos Passos', {
    x: MARGIN, y: 1.8, w: SLIDE_W - MARGIN * 2, h: 0.8,
    fontSize: 42, bold: true, color: C.text,
  });
  s8.addText(
    [
      '1. Compartilhar este diagnóstico com o time fundador e o conselho.',
      '2. Executar as Quick Wins priorizadas nas próximas 4 semanas.',
      '3. Endereçar Red Flags ativos antes do próximo ciclo.',
      '4. Reavaliar maturidade em 90 dias para medir evolução.',
    ].join('\n'),
    { x: MARGIN, y: 3.0, w: SLIDE_W - MARGIN * 2, h: 3.0, fontSize: 18, color: C.text, paraSpaceAfter: 12 }
  );
  s8.addText('Darwin · Conselho OS', {
    x: MARGIN, y: SLIDE_H - 0.9, w: SLIDE_W - MARGIN * 2, h: 0.4,
    fontSize: 12, color: C.textMuted, align: 'center',
  });

  // Add footers to all slides
  const total = (pptx as any).slides?.length ?? 8;
  (pptx as any).slides?.forEach((slide: any, idx: number) => {
    addFooter(slide, idx + 1, total);
  });

  const fileName = `${startupName}-diagnostico-${new Date().toISOString().slice(0, 10)}.pptx`;
  await pptx.writeFile({ fileName });
}

function slide_badge(pptx: any, slide: any, x: number, y: number, w: number, h: number, text: string, color: string) {
  slide.addShape(pptx.ShapeType.ellipse, {
    x, y, w, h, fill: { color }, line: { color },
  });
  slide.addText(text, {
    x, y, w, h, fontSize: 16, bold: true, color: '0B1220', align: 'center', valign: 'middle',
  });
}
