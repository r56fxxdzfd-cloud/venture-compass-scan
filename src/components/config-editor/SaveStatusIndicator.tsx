import { Check, AlertCircle, Loader2, Circle } from 'lucide-react';
import type { SaveStatus } from '@/hooks/useConfigAutoSave';

const statusConfig: Record<SaveStatus, { icon: React.ReactNode; label: string; className: string }> = {
  idle: { icon: null, label: '', className: '' },
  unsaved: { icon: <Circle className="h-2.5 w-2.5 fill-muted-foreground" />, label: 'Não salvo', className: 'text-muted-foreground' },
  saving: { icon: <Loader2 className="h-3 w-3 animate-spin" />, label: 'Salvando...', className: 'text-muted-foreground' },
  saved: { icon: <Check className="h-3 w-3" />, label: 'Salvo', className: 'text-green-600 dark:text-green-400' },
  error: { icon: <AlertCircle className="h-3 w-3" />, label: 'Erro ao salvar', className: 'text-destructive' },
};

export function SaveStatusIndicator({ status }: { status: SaveStatus }) {
  const cfg = statusConfig[status];
  if (!cfg.icon) return null;
  return (
    <span className={`flex items-center gap-1 text-xs ${cfg.className}`}>
      {cfg.icon}
      {cfg.label}
    </span>
  );
}
