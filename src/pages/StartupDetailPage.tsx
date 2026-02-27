import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, ClipboardList, ArrowLeft } from 'lucide-react';
import type { Company, Assessment } from '@/types/darwin';

export default function StartupDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin, isAnalyst, user } = useAuth();
  const [company, setCompany] = useState<Company | null>(null);
  const [assessments, setAssessments] = useState<Assessment[]>([]);

  const canWrite = isAdmin || isAnalyst;

  useEffect(() => {
    if (!id) return;
    supabase.from('companies').select('*').eq('id', id).single().then(({ data }) => {
      if (data) setCompany(data as Company);
    });
    supabase.from('assessments').select('*').eq('company_id', id).order('created_at', { ascending: false }).then(({ data }) => {
      if (data) setAssessments(data as Assessment[]);
    });
  }, [id]);

  const handleNewAssessment = async () => {
    // Get published config
    const { data: config } = await supabase
      .from('config_versions')
      .select('id')
      .eq('status', 'published')
      .single();

    if (!config) return;

    const { data, error } = await supabase.from('assessments').insert({
      company_id: id!,
      config_version_id: config.id,
      stage: company?.stage || 'seed',
      business_model: company?.business_model || null,
      created_by: user?.id,
    }).select().single();

    if (data) {
      navigate(`/app/assessments/${data.id}/questionnaire`);
    }
  };

  if (!company) return null;

  const stageLabels: Record<string, string> = { pre_seed: 'Pre-Seed', seed: 'Seed', series_a: 'Series A' };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/app/startups')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{company.name}</h1>
          <div className="flex gap-2 mt-1">
            {company.stage && <Badge variant="secondary">{stageLabels[company.stage] || company.stage}</Badge>}
            {company.sector && <Badge variant="outline">{company.sector}</Badge>}
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-sm">Informações</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-2">
            {company.legal_name && <p><span className="text-muted-foreground">Razão Social:</span> {company.legal_name}</p>}
            {company.cnpj && <p><span className="text-muted-foreground">CNPJ:</span> {company.cnpj}</p>}
            {company.business_model && <p><span className="text-muted-foreground">Modelo:</span> {company.business_model}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm">Diagnósticos</CardTitle>
            {canWrite && (
              <Button size="sm" onClick={handleNewAssessment}>
                <Plus className="mr-1 h-3 w-3" /> Novo
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {assessments.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum diagnóstico ainda</p>
            ) : (
              <div className="space-y-2">
                {assessments.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-secondary/50 transition-colors"
                    onClick={() => navigate(
                      a.status === 'completed'
                        ? `/app/assessments/${a.id}/report`
                        : `/app/assessments/${a.id}/questionnaire`
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <ClipboardList className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">
                        {new Date(a.created_at).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                    <Badge variant={a.status === 'completed' ? 'default' : 'secondary'}>
                      {a.status === 'completed' ? 'Concluído' : 'Em andamento'}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
