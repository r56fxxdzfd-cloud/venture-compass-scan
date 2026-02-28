import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { ConfigJSON } from '@/types/darwin';

export type SaveStatus = 'idle' | 'unsaved' | 'saving' | 'saved' | 'error';

export function useConfigAutoSave(draftId: string, onSaved?: (json: ConfigJSON) => void) {
  const [status, setStatus] = useState<SaveStatus>('idle');
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { toast } = useToast();

  const doSave = useCallback(async (json: ConfigJSON) => {
    setStatus('saving');
    const { data, error } = await supabase
      .from('config_versions')
      .update({ config_json: json as any })
      .eq('id', draftId)
      .select('config_json')
      .single();

    if (error) {
      setStatus('error');
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
      return;
    }

    setStatus('saved');
    if (data && onSaved) {
      onSaved(data.config_json as unknown as ConfigJSON);
    }
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    savedTimerRef.current = setTimeout(() => setStatus('idle'), 3000);
  }, [draftId, toast, onSaved]);

  const scheduleSave = useCallback((json: ConfigJSON) => {
    setStatus('unsaved');
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => doSave(json), 1500);
  }, [doSave]);

  const saveNow = useCallback((json: ConfigJSON) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    doSave(json);
  }, [doSave]);

  return { status, scheduleSave, saveNow };
}
