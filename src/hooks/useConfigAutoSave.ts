import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { ConfigJSON } from '@/types/darwin';

export type SaveStatus = 'idle' | 'unsaved' | 'saving' | 'saved' | 'error';

export function useConfigAutoSave(draftId: string, onSaved?: (json: ConfigJSON) => void) {
  const [status, setStatus] = useState<SaveStatus>('idle');
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const { toast } = useToast();

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    };
  }, []);

  const setStatusIfMounted = useCallback((nextStatus: SaveStatus) => {
    if (mountedRef.current) setStatus(nextStatus);
  }, []);

  const doSave = useCallback(async (json: ConfigJSON) => {
    setStatusIfMounted('saving');
    const { data, error } = await supabase
      .from('config_versions')
      .update({ config_json: json as any })
      .eq('id', draftId)
      .select('config_json')
      .single();

    if (error) {
      setStatusIfMounted('error');
      if (mountedRef.current) toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
      return;
    }

    setStatusIfMounted('saved');
    if (mountedRef.current && data && onSaved) {
      onSaved(data.config_json as unknown as ConfigJSON);
    }
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    savedTimerRef.current = setTimeout(() => setStatusIfMounted('idle'), 3000);
  }, [draftId, toast, onSaved, setStatusIfMounted]);

  const scheduleSave = useCallback((json: ConfigJSON) => {
    setStatusIfMounted('unsaved');
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => doSave(json), 1500);
  }, [doSave, setStatusIfMounted]);

  const saveNow = useCallback((json: ConfigJSON) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    doSave(json);
  }, [doSave]);

  return { status, scheduleSave, saveNow };
}
