import type { Assessment, AssessmentResult, ConfigJSON, Answer } from '@/types/darwin';
import {
  computeBlocks, getBlocks, getLevel, scoreTo100,
  generateOverallNarrative, getCompleteness, computeGaps, generateRoadmap,
} from '@/utils/report-helpers';
import { computeParetoActions, selectTop5, generateMeetingAgenda, compute2x2Matrix } from '@/utils/pareto-engine';

// Darwin palette (hex without #)
const C = {
  text: '111827',
  textMuted: '64748B',
  primary: '15803D',     // green-700 for print contrast
  accent: '7C3AED',      // purple-600
  warning: 'B45309',
  danger: 'B91C1C',
  border: 'CBD5E1',
  cardBg: 'F8FAFC',
  panelBg: 'F1F5F9',
};

const SEV_LABEL: Record<string, string> = {
  critical: 'Crítico', high: 'Crítico',
  medium_high: 'Atenção', medium: 'Atenção',
  low: 'Monitorar',
};
const SEV_COLOR: Record<string, string> = {
  critical: C.danger, high: C.danger,
  medium_high: C.warning, medium: C.warning, low: C.textMuted,
};

type ChartImage = { dataUrl: string; width: number; height: number } | null;

export async function exportReportToDOCX(opts: {
  assessment: Assessment;
  config: ConfigJSON;
  result: AssessmentResult;
  answers: Answer[];
  startupName: string;
  chartImages?: { radar?: ChartImage; matrix?: ChartImage; blocks?: ChartImage };
}) {
  const docx = await import('docx');
  const {
    Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
    HeadingLevel, AlignmentType, BorderStyle, WidthType, ShadingType,
    PageBreak, LevelFormat, ImageRun, Footer, PageNumber, Header,
  } = docx;

  const { assessment, config, result, answers, startupName, chartImages } = opts;
  const stage = assessment.stage || 'seed';
  const dateStr = new Date(assessment.created_at).toLocaleDateString('pt-BR');
  const completeness = getCompleteness(result);
  const overallPct = scoreTo100((result as any).overall_weighted ?? result.overall_score);
  const level = getLevel(overallPct);
  const blocks = computeBlocks(getBlocks(config), result.dimension_scores, config, stage);
  const narrative = generateOverallNarrative(result, config, stage, answers);
  const isSimulation = !!assessment.is_simulation;

  // ---- text helpers ----
  const t = (text: string, opts: any = {}) =>
    new TextRun({ text, font: 'Arial', ...opts });
  const p = (children: any[] | string, opts: any = {}) => {
    const runs = typeof children === 'string' ? [t(children)] : children;
    return new Paragraph({ children: runs, spacing: { after: 80, ...(opts.spacing || {}) }, ...opts });
  };
  const h2 = (text: string) => new Paragraph({
    children: [t(text, { bold: true, size: 28, color: C.text })],
    spacing: { before: 200, after: 120 },
    heading: HeadingLevel.HEADING_2,
    keepNext: true,
  });

  const border = { style: BorderStyle.SINGLE, size: 4, color: C.border };
  const cellBorders = { top: border, bottom: border, left: border, right: border };
  const noBorder = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
  const noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };

  // A "card" = single-cell table that CANNOT split across pages.
  const card = (children: any[], opts: { fill?: string; tableWidth?: number } = {}) => {
    const fill = opts.fill ?? C.cardBg;
    const tableWidth = opts.tableWidth ?? 9360;
    return new Table({
      width: { size: tableWidth, type: WidthType.DXA },
      columnWidths: [tableWidth],
      rows: [
        new TableRow({
          cantSplit: true,
          children: [
            new TableCell({
              borders: cellBorders,
              width: { size: tableWidth, type: WidthType.DXA },
              shading: { fill, type: ShadingType.CLEAR, color: 'auto' },
              margins: { top: 200, bottom: 200, left: 240, right: 240 },
              children,
            }),
          ],
        }),
      ],
    });
  };

  // Multi-column "card row" (each column is its own cell, each row cantSplit)
  const cardRow = (cols: any[][], fill = C.cardBg) => {
    const tableWidth = 9360;
    const n = cols.length;
    const colW = Math.floor(tableWidth / n);
    const widths = Array(n).fill(colW);
    widths[n - 1] = tableWidth - colW * (n - 1);
    return new Table({
      width: { size: tableWidth, type: WidthType.DXA },
      columnWidths: widths,
      rows: [
        new TableRow({
          cantSplit: true,
          children: cols.map((children, i) => new TableCell({
            borders: cellBorders,
            width: { size: widths[i], type: WidthType.DXA },
            shading: { fill, type: ShadingType.CLEAR, color: 'auto' },
            margins: { top: 200, bottom: 200, left: 200, right: 200 },
            children,
          })),
        }),
      ],
    });
  };

  // Spacer paragraph between cards (so consecutive tables aren't glued)
  const spacer = () => new Paragraph({ children: [t('')], spacing: { after: 160 } });

  // dataUrl (image/png base64) -> Uint8Array
  const dataUrlToBytes = (dataUrl: string): Uint8Array => {
    const b64 = dataUrl.split(',')[1] || '';
    const bin = atob(b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return arr;
  };

  // Build an embedded image paragraph scaled to the content width (max 600px).
  const imageParagraph = (img: ChartImage, maxWidthPx = 600): any | null => {
    if (!img) return null;
    const ratio = img.height / img.width;
    const w = Math.min(maxWidthPx, img.width);
    const h = Math.round(w * ratio);
    return new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new ImageRun({
        type: 'png',
        data: dataUrlToBytes(img.dataUrl),
        transformation: { width: w, height: h },
        altText: { title: 'Gráfico', description: 'Gráfico do relatório', name: 'chart' },
      } as any)],
    });
  };

  // ====== Build document body ======
  const body: any[] = [];

  // --- Cover / Header card
  body.push(card([
    p([t('DARWIN GROWTH', { bold: true, size: 18, color: C.primary, characterSpacing: 30 })]),
    p([t('Comitê de Crescimento', { size: 16, color: C.textMuted })]),
    new Paragraph({ children: [t('')], spacing: { after: 120 } }),
    p([t('Relatório de Diagnóstico', { size: 36, color: C.textMuted })]),
    p([t(startupName, { bold: true, size: 56, color: C.text })], { spacing: { after: 200 } }),
    p([
      t(`Estágio: ${String(stage).toUpperCase()}`, { size: 20, color: C.textMuted }),
      t('   ·   ', { size: 20, color: C.textMuted }),
      t(dateStr, { size: 20, color: C.textMuted }),
      t('   ·   ', { size: 20, color: C.textMuted }),
      t(`Confiança ${completeness.confidenceLabel}`, { size: 20, color: C.textMuted }),
    ]),
    ...(isSimulation ? [p([t('SIMULAÇÃO', { bold: true, color: C.danger, size: 24 })])] : []),
  ]));
  body.push(spacer());

  // --- Score Geral card
  body.push(card([
    p([t('Score Geral', { size: 22, color: C.textMuted })], { alignment: AlignmentType.CENTER }),
    p([t(String(overallPct), { bold: true, size: 96, color: C.primary })], { alignment: AlignmentType.CENTER, spacing: { after: 40 } }),
    p([t('de 100', { size: 18, color: C.textMuted })], { alignment: AlignmentType.CENTER }),
    p([t(level.label, { bold: true, size: 22, color: C.accent })], { alignment: AlignmentType.CENTER, spacing: { after: 200 } }),
    p([t(narrative, { size: 22, color: C.text })], { alignment: AlignmentType.CENTER }),
  ]));
  body.push(spacer());

  // --- KPI row (3 cards in one row)
  body.push(cardRow([
    [
      p([t('Score Geral', { size: 18, color: C.textMuted })], { alignment: AlignmentType.CENTER }),
      p([t(String(overallPct), { bold: true, size: 56, color: C.primary })], { alignment: AlignmentType.CENTER }),
      p([t(`/ 100 · ${level.label}`, { size: 16, color: C.textMuted })], { alignment: AlignmentType.CENTER }),
    ],
    [
      p([t('Red Flags', { size: 18, color: C.textMuted })], { alignment: AlignmentType.CENTER }),
      p([t(String(result.red_flags.length), { bold: true, size: 56, color: result.red_flags.length ? C.warning : C.primary })], { alignment: AlignmentType.CENTER }),
      p([t('identificados', { size: 16, color: C.textMuted })], { alignment: AlignmentType.CENTER }),
    ],
    [
      p([t('Completude', { size: 18, color: C.textMuted })], { alignment: AlignmentType.CENTER }),
      p([t(`${completeness.pct}%`, { bold: true, size: 56, color: C.accent })], { alignment: AlignmentType.CENTER }),
      p([t(`${completeness.answered}/${completeness.total} questões`, { size: 16, color: C.textMuted })], { alignment: AlignmentType.CENTER }),
    ],
  ], C.panelBg));
  body.push(spacer());

  // --- Performance por Bloco
  body.push(h2('Performance por Bloco'));
  body.push(cardRow(blocks.map(b => [
    p([t(b.label.toUpperCase(), { bold: true, size: 18, color: C.accent, characterSpacing: 20 })], { alignment: AlignmentType.CENTER }),
    p([t(String(b.score100), { bold: true, size: 72, color: C.primary })], { alignment: AlignmentType.CENTER }),
    p([t(b.level.label, { bold: true, size: 20, color: C.text })], { alignment: AlignmentType.CENTER, spacing: { after: 120 } }),
    p([t('Dimensão mais frágil:', { size: 16, color: C.textMuted })], { alignment: AlignmentType.CENTER }),
    p([t(b.lowestDim || '—', { italics: true, size: 18, color: C.text })], { alignment: AlignmentType.CENTER }),
  ])));
  body.push(spacer());

  // --- Red Flags (each = own card)
  body.push(h2('Red Flags'));
  if (result.red_flags.length === 0) {
    body.push(card([
      p([t('✓ Nenhum red flag ativo no momento.', { bold: true, size: 24, color: C.primary })], { alignment: AlignmentType.CENTER }),
    ]));
    body.push(spacer());
  } else {
    result.red_flags.forEach(rf => {
      const sev = SEV_LABEL[rf.severity] || 'Atenção';
      const sevColor = SEV_COLOR[rf.severity] || C.warning;
      body.push(card([
        p([t(sev.toUpperCase(), { bold: true, size: 18, color: sevColor, characterSpacing: 20 })]),
        p([t(rf.label, { bold: true, size: 24, color: C.text })]),
        ...((rf.actions || []).slice(0, 3).map(a => p([
          t('• ', { size: 20, color: sevColor }),
          t(a, { size: 20, color: C.text }),
        ]))),
      ]));
      body.push(spacer());
    });
  }

  // --- Matriz Risco × Impacto (textual)
  const matrixPoints = compute2x2Matrix(config, result, stage);
  if (matrixPoints.length > 0) {
    body.push(h2('Matriz Risco × Impacto'));
    body.push(card([
      p([t('Itens priorizados por risco e impacto potencial (10 mais relevantes).', { size: 18, color: C.textMuted })], { spacing: { after: 160 } }),
      ...matrixPoints.slice(0, 12).map((pt, i) => {
        const color = pt.type === 'red_flag' ? C.danger : C.primary;
        const tag = pt.type === 'red_flag' ? 'Red Flag' : 'Dimensão';
        return p([
          t(`${i + 1}. `, { bold: true, size: 20, color }),
          t(pt.label, { bold: true, size: 20, color: C.text }),
          t(`  ·  ${tag}  ·  Risco ${pt.risk}  ·  Impacto ${pt.impact}`, { size: 18, color: C.textMuted }),
        ]);
      }),
    ]));
    body.push(spacer());
  }

  // --- Quick Wins
  const scored = computeParetoActions(config, result, stage);
  const top5 = selectTop5(scored, result, config);
  body.push(h2('Quick Wins · Top 5 Ações'));
  if (top5.length === 0) {
    body.push(card([p([t('Sem ações disponíveis na biblioteca atual.', { size: 20, color: C.textMuted })])]));
    body.push(spacer());
  } else {
    top5.forEach((a, i) => {
      body.push(card([
        p([
          t(`${i + 1}. `, { bold: true, size: 22, color: C.primary }),
          t(a.title, { bold: true, size: 22, color: C.text }),
        ]),
        p([t(a.first_step || a.description || '', { size: 20, color: C.textMuted })]),
        p([
          t(`Esforço ${a.effort}`, { bold: true, size: 18, color: C.accent }),
          t('     ', {}),
          t(`${a.time_to_impact_days} dias para impacto`, { bold: true, size: 18, color: C.primary }),
        ]),
      ]));
      body.push(spacer());
    });
  }

  // --- Roadmap 6 meses
  const gaps = computeGaps(result.dimension_scores, config, stage);
  const roadmap = generateRoadmap(gaps, result.red_flags, config, result);
  if (roadmap.length > 0) {
    body.push(h2('Roadmap 6 Meses'));
    const waves = [
      { wave: 1 as const, label: 'WAVE 1 — 0-30 DIAS', color: C.danger },
      { wave: 2 as const, label: 'WAVE 2 — 31-90 DIAS', color: C.warning },
      { wave: 3 as const, label: 'WAVE 3 — 91-180 DIAS', color: C.primary },
    ];
    waves.forEach(w => {
      const items = roadmap.filter(r => r.wave === w.wave);
      if (items.length === 0) return;
      body.push(card([
        p([t(w.label, { bold: true, size: 20, color: w.color, characterSpacing: 20 })], { spacing: { after: 160 } }),
        ...items.flatMap(a => [
          p([t(a.source.toUpperCase(), { bold: true, size: 14, color: C.accent, characterSpacing: 10 })]),
          p([t(a.title, { bold: true, size: 20, color: C.text })]),
          p([t(a.rationale, { size: 16, color: C.textMuted })], { spacing: { after: 160 } }),
        ]),
      ]));
      body.push(spacer());
    });
  }

  // --- Pauta do próximo conselho
  const agenda = generateMeetingAgenda(config, result, stage, answers.map(a => ({
    question_id: a.question_id, dimension_id: '', score: a.value, value: a.value,
  })) as any);
  body.push(h2('Pauta · Próximo Conselho'));
  if (agenda.length === 0) {
    body.push(card([p([t('Sem tópicos prioritários identificados.', { size: 20, color: C.textMuted })])]));
    body.push(spacer());
  } else {
    agenda.slice(0, 5).forEach((it, i) => {
      body.push(card([
        p([
          t(`${i + 1}. `, { bold: true, size: 22, color: C.accent }),
          t(it.topic, { bold: true, size: 22, color: C.text }),
        ]),
        ...((it.deep_dive_prompts || []).slice(0, 3).map(pr => p([
          t('• ', { color: C.accent, size: 20 }),
          t(pr, { size: 20, color: C.textMuted }),
        ]))),
        ...(it.expected_decision ? [p([
          t('Decisão esperada: ', { bold: true, size: 18, color: C.primary }),
          t(it.expected_decision, { italics: true, size: 18, color: C.primary }),
        ])] : []),
      ]));
      body.push(spacer());
    });
  }

  // --- Deep Dive
  if (result.deep_dive_dimensions.length > 0 && config.deep_dive_prompts) {
    const dd: any = config.deep_dive_prompts;
    const ddMap: Record<string, any[]> = {};
    if (Array.isArray(dd)) {
      dd.forEach((it: any) => { if (it?.dimension_id) ddMap[it.dimension_id] = Array.isArray(it?.prompts) ? it.prompts : []; });
    } else if (dd && typeof dd === 'object') {
      Object.entries(dd).forEach(([k, v]) => { ddMap[k] = Array.isArray(v) ? (v as any[]) : []; });
    }
    const promptText = (q: any) => typeof q === 'string' ? q : (q?.prompt || q?.text || String(q));
    const triggeredRf = new Set(result.red_flags.map(r => r.code));
    body.push(h2('Deep Dive · Questões para Aprofundamento'));
    result.deep_dive_dimensions.forEach(dimId => {
      const dim = config.dimensions.find(d => d.id === dimId);
      if (!dim) return;
      const all = ddMap[dimId] || [];
      const ds = result.dimension_scores.find(d => d.dimension_id === dimId);
      const ds5 = ds?.score ?? 5;
      const rel = all.filter((q: any) => {
        if (typeof q !== 'object' || q === null) return true;
        if (q.show_if_rf && !triggeredRf.has(q.show_if_rf)) return false;
        if (q.show_if_score_below && ds5 >= q.show_if_score_below) return false;
        return true;
      });
      const prompts = (rel.length >= 2 ? rel : all).slice(0, 4).map(promptText);
      const lowQs = answers
        .filter(a => {
          const q = config.questions?.find(qq => qq.id === a.question_id);
          return q?.dimension_id === dimId && a.value !== null && a.value !== undefined && (a.value as number) <= 2;
        })
        .map(a => {
          const q = config.questions?.find(qq => qq.id === a.question_id);
          return q?.text || a.question_id;
        }).slice(0, 3);
      if (prompts.length === 0 && lowQs.length === 0) return;
      body.push(card([
        p([t(dim.label, { bold: true, size: 24, color: C.text })]),
        ...(lowQs.length ? [
          p([t('Pontos críticos identificados:', { bold: true, size: 18, color: C.danger })], { spacing: { before: 120 } }),
          ...lowQs.map(q => p([t('• ', { color: C.danger, size: 18 }), t(q, { size: 18, color: C.textMuted })])),
        ] : []),
        ...(prompts.length ? [
          p([t('Perguntas para aprofundamento:', { bold: true, size: 18, color: C.warning })], { spacing: { before: 120 } }),
          ...prompts.map(q => p([t('• ', { color: C.warning, size: 20 }), t(q, { size: 20, color: C.text })])),
        ] : []),
      ]));
      body.push(spacer());
    });
  }

  // --- Análise por Dimensão (table inside card; cantSplit row)
  body.push(h2('Análise por Dimensão'));
  const dims = [...result.dimension_scores].sort((a, b) => a.score - b.score);
  const tableWidth = 9360;
  const colW = [3800, 1300, 1500, 1500, 1260];
  const headerRow = new TableRow({
    tableHeader: true,
    cantSplit: true,
    children: ['Dimensão', 'Score', 'Benchmark', 'Cobertura', 'Nível'].map((h, i) => new TableCell({
      borders: cellBorders,
      width: { size: colW[i], type: WidthType.DXA },
      shading: { fill: C.panelBg, type: ShadingType.CLEAR, color: 'auto' },
      margins: { top: 100, bottom: 100, left: 120, right: 120 },
      children: [new Paragraph({
        children: [t(h, { bold: true, size: 18, color: C.text })],
        alignment: i === 0 ? AlignmentType.LEFT : AlignmentType.CENTER,
      })],
    })),
  });
  const dimRows = dims.map(d => {
    const s100 = scoreTo100(d.score);
    const t100 = scoreTo100(d.target);
    const lv = getLevel(s100);
    const cells = [
      { txt: d.label, align: AlignmentType.LEFT, color: C.text },
      { txt: String(s100), align: AlignmentType.CENTER, color: C.primary, bold: true },
      { txt: String(t100), align: AlignmentType.CENTER, color: C.textMuted },
      { txt: `${d.answered}/${d.total}`, align: AlignmentType.CENTER, color: C.textMuted },
      { txt: lv.label, align: AlignmentType.CENTER, color: C.accent },
    ];
    return new TableRow({
      cantSplit: true,
      children: cells.map((c, i) => new TableCell({
        borders: cellBorders,
        width: { size: colW[i], type: WidthType.DXA },
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        children: [new Paragraph({
          children: [t(c.txt, { size: 18, color: c.color, bold: !!c.bold })],
          alignment: c.align,
        })],
      })),
    });
  });
  body.push(new Table({
    width: { size: tableWidth, type: WidthType.DXA },
    columnWidths: colW,
    rows: [headerRow, ...dimRows],
  }));
  body.push(spacer());

  // --- Próximos passos
  body.push(h2('Próximos Passos'));
  body.push(card([
    p([t('1. Compartilhar este diagnóstico com o time fundador e o conselho.', { size: 20, color: C.text })]),
    p([t('2. Executar as Quick Wins priorizadas nas próximas 4 semanas.', { size: 20, color: C.text })]),
    p([t('3. Endereçar Red Flags ativos antes do próximo ciclo.', { size: 20, color: C.text })]),
    p([t('4. Reavaliar maturidade em 90 dias para medir evolução.', { size: 20, color: C.text })]),
    new Paragraph({ children: [t('')], spacing: { after: 120 } }),
    p([t('Darwin Growth · Comitê de Crescimento', { size: 16, color: C.textMuted })], { alignment: AlignmentType.CENTER }),
  ]));

  const doc = new Document({
    creator: 'Darwin Growth',
    title: `Relatório de Diagnóstico — ${startupName}`,
    styles: {
      default: { document: { run: { font: 'Arial', size: 22 } } },
      paragraphStyles: [
        { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 28, bold: true, font: 'Arial', color: C.text },
          paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 1 } },
      ],
    },
    sections: [{
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 1080, right: 1080, bottom: 1080, left: 1080, header: 540, footer: 540 },
        },
      },
      children: body,
    }],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${startupName}-diagnostico-${new Date().toISOString().slice(0, 10)}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
