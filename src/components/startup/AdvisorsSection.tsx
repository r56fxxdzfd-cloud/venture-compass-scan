import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { UserCog, X } from 'lucide-react';

interface AdvisorRow { assignmentId: string; advisorId: string; name: string; }
interface Candidate { id: string; name: string; }

/**
 * Seção "Conselheiros" — apenas admin/analyst (operadores) atribuem/desatribuem
 * advisors a uma startup. A lista de candidatos depende de leitura de profiles,
 * disponível para JV Admin/Super Admin (RLS de profiles).
 */
export function AdvisorsSection({ companyId }: { companyId: string }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [assigned, setAssigned] = useState<AdvisorRow[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selected, setSelected] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const [{ data: assigns }, { data: roleRows }] = await Promise.all([
      supabase.from('advisor_assignments').select('id, advisor_id').eq('company_id', companyId),
      supabase.from('user_roles').select('user_id').eq('role', 'jv_advisor'),
    ]);
    const advisorIds = Array.from(new Set([
      ...((assigns || []).map((a) => a.advisor_id)),
      ...((roleRows || []).map((r) => r.user_id)),
    ]));
    const namesById = new Map<string, string>();
    if (advisorIds.length) {
      const { data: profs } = await supabase.from('profiles').select('id, full_name').in('id', advisorIds);
      (profs || []).forEach((p) => namesById.set(p.id, p.full_name || 'Sem nome'));
    }
    setAssigned((assigns || []).map((a) => ({
      assignmentId: a.id,
      advisorId: a.advisor_id,
      name: namesById.get(a.advisor_id) || 'Conselheiro',
    })));
    const assignedIds = new Set((assigns || []).map((a) => a.advisor_id));
    setCandidates((roleRows || [])
      .map((r) => ({ id: r.user_id, name: namesById.get(r.user_id) || 'Sem nome' }))
      .filter((c: Candidate) => !assignedIds.has(c.id)));
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  const handleAssign = async () => {
    if (!selected) return;
    setSaving(true);
    const { error } = await supabase.from('advisor_assignments').insert({
      company_id: companyId,
      advisor_id: selected,
      created_by: user?.id,
    });
    setSaving(false);
    if (error) {
      toast({ title: 'Erro ao atribuir', description: error.message, variant: 'destructive' });
      return;
    }
    setSelected('');
    toast({ title: 'Conselheiro atribuído' });
    load();
  };

  const handleRemove = async (assignmentId: string) => {
    const { error } = await supabase.from('advisor_assignments').delete().eq('id', assignmentId);
    if (error) {
      toast({ title: 'Erro ao remover', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Conselheiro removido' });
    load();
  };

  return (
    <Card className="executive-panel">
      <CardHeader>
        <p className="executive-section-title text-xs">Governança do conselho</p>
        <CardTitle className="flex items-center gap-2 text-base">
          <UserCog className="h-4 w-4 text-primary" /> Conselheiros
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {assigned.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum conselheiro atribuído a esta organização.</p>
              ) : (
                assigned.map((a) => (
                  <Badge key={a.assignmentId} variant="secondary" className="gap-1.5 py-1 pl-2.5 pr-1">
                    {a.name}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-4 w-4 hover:bg-destructive/20"
                      onClick={() => handleRemove(a.assignmentId)}
                      aria-label={`Remover ${a.name}`}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>
                ))
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Select value={selected} onValueChange={setSelected}>
                <SelectTrigger className="w-64">
                  <SelectValue placeholder={candidates.length ? 'Selecionar conselheiro' : 'Nenhum conselheiro disponível'} />
                </SelectTrigger>
                <SelectContent>
                  {candidates.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={handleAssign} disabled={!selected || saving}>
                {saving ? 'Atribuindo...' : 'Atribuir'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Conselheiros (papel <span className="font-mono">jv_advisor</span>) só enxergam as organizações atribuídas aqui.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
