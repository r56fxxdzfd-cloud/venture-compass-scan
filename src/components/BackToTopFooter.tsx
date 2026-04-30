import { ArrowUp } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function BackToTopFooter() {
  const handleBackToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="data-print-hide mt-6 flex justify-end print:hidden" data-print-hide="true">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleBackToTop}
        aria-label="Voltar ao topo da página"
        className="gap-2"
      >
        <ArrowUp className="h-4 w-4" aria-hidden="true" />
        Voltar ao topo
      </Button>
    </div>
  );
}
