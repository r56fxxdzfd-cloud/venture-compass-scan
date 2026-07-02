import type { ConfigQuestion } from '@/types/darwin';
import { getQuestionTooltipExplanation } from '@/utils/question-tooltip';

type QuestionTooltipContentProps = {
  question: ConfigQuestion;
  includeFallbackExplanation?: boolean;
};

function safeString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

export function QuestionTooltipContent({
  question,
  includeFallbackExplanation = true,
}: QuestionTooltipContentProps) {
  const tooltip = question.tooltip;
  const explanation = getQuestionTooltipExplanation(question, { includeFallback: includeFallbackExplanation });
  const anchors = tooltip?.anchors ? Object.entries(tooltip.anchors) : [];
  const prioritizedAnchors = anchors.sort(([a], [b]) => {
    const preferredOrder = ['1', '3', '5'];
    const aIndex = preferredOrder.indexOf(a);
    const bIndex = preferredOrder.indexOf(b);
    if (aIndex >= 0 || bIndex >= 0) {
      return (aIndex >= 0 ? aIndex : preferredOrder.length) - (bIndex >= 0 ? bIndex : preferredOrder.length);
    }
    return Number(a) - Number(b);
  });

  return (
    <div className="space-y-2 text-xs leading-snug">
      {tooltip?.definition && (
        <section>
          <p className="font-semibold text-popover-foreground">O que significa</p>
          <p className="mt-0.5 text-popover-foreground/85">{tooltip.definition}</p>
        </section>
      )}

      {explanation && (
        <section>
          <p className="font-semibold text-popover-foreground">Como interpretar</p>
          <p className="mt-0.5 text-popover-foreground/85">{explanation}</p>
        </section>
      )}

      {tooltip?.why && (
        <section>
          <p className="font-semibold text-popover-foreground">Por que importa</p>
          <p className="mt-0.5 text-popover-foreground/85">{tooltip.why}</p>
        </section>
      )}

      {prioritizedAnchors.length > 0 && (
        <section>
          <p className="font-semibold text-popover-foreground">Referências para pontuar 1 / 3 / 5</p>
          <div className="mt-1 space-y-1">
            {prioritizedAnchors.map(([score, description]) => (
              <p key={score} className="text-popover-foreground/85">
                <span className="font-semibold text-popover-foreground">{score}:</span> {safeString(description)}
              </p>
            ))}
          </div>
        </section>
      )}

      {tooltip?.evidence_examples && tooltip.evidence_examples.length > 0 && (
        <section>
          <p className="font-semibold text-popover-foreground">Exemplos de evidências</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-popover-foreground/85">
            {tooltip.evidence_examples.map((example, index) => (
              <li key={`${example}-${index}`}>{example}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
