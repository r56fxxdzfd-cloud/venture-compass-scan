import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Upload, Download, Check, Archive, FileJson } from 'lucide-react';
import type { ConfigVersion, ConfigJSON } from '@/types/darwin';

const REQUIRED_FIELDS = ['dimensions', 'questions', 'weights_by_stage', 'targets_by_stage', 'methodology', 'simulator'];

export default function AdminConfigPage() {
  const [versions, setVersions] = useState<ConfigVersion[]>([]);
  const [uploading, setUploading] = useState(false);
  const [validationError, setValidationError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchVersions = async () => {
    const { data } = await supabase
      .from('config_versions')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setVersions(data as unknown as ConfigVersion[]);
  };

  useEffect(() => { fetchVersions(); }, []);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setValidationError('');

    try {
      const text = await file.text();
      const json = JSON.parse(text) as ConfigJSON;

      // Validate
      const missing = REQUIRED_FIELDS.filter((f) => !(f in json));
      if (missing.length > 0) {
        setValidationError(`Campos obrigatórios ausentes: ${missing.join(', ')}`);
        setUploading(false);
        return;
      }

      // Insert config version
      const { data: cv, error } = await supabase.from('config_versions').insert({
        version_name: file.name.replace('.json', ''),
        config_json: json as any,
        created_by: user?.id,
      }).select().single();

      if (error) throw error;

      // Populate denormalized tables
      if (cv) {
        const versionId = cv.id;

        // Dimensions
        if (json.dimensions?.length) {
          await supabase.from('dimensions').insert(
            json.dimensions.map((d) => ({
              id: d.id,
              config_version_id: versionId,
              label: d.label,
              sort_order: d.sort_order,
            }))
          );
        }

        // Questions
        if (json.questions?.length) {
          await supabase.from('questions').insert(
            json.questions.map((q) => ({
              id: q.id,
              config_version_id: versionId,
              dimension_id: q.dimension_id,
              text: q.text,
              type: q.type || 'likert',
              scale_id: q.scale_id || 'likert_1_5',
              tags: (q.tags || {}) as any,
              tooltip: (q.tooltip || {}) as any,
              is_active: q.is_active !== false,
              sort_order: q.sort_order,
            }))
          );
        }

        // Deep dive prompts
        if (json.deep_dive_prompts) {
          const prompts: any[] = [];
          Object.entries(json.deep_dive_prompts).forEach(([dimId, promptList]) => {
            (promptList as string[]).forEach((prompt, i) => {
              prompts.push({
                config_version_id: versionId,
                dimension_id: dimId,
                prompt,
                sort_order: i,
              });
            });
          });
          if (prompts.length) await supabase.from('deep_dive_prompts').insert(prompts);
        }

        // Red flags
        if (json.red_flags?.length) {
          await supabase.from('red_flags').insert(
            json.red_flags.map((rf) => ({
              code: rf.code,
              config_version_id: versionId,
              label: rf.label,
              severity: rf.severity,
              triggers: rf.triggers as any,
              actions: rf.actions as any,
            }))
          );
        }

        // Glossary
        if (json.glossary) {
          await supabase.from('glossary_terms').insert(
            Object.entries(json.glossary).map(([term, definition]) => ({
              config_version_id: versionId,
              term,
              definition: definition as string,
            }))
          );
        }

        // Simulator presets
        if (json.simulator?.presets?.length) {
          await supabase.from('simulator_presets').insert(
            json.simulator.presets.map((p) => ({
              id: p.id,
              config_version_id: versionId,
              label: p.label,
              dimension_scores: p.dimension_scores as any,
              numeric_context_defaults: p.numeric_context_defaults as any,
              expected_red_flags: p.expected_red_flags as any,
            }))
          );
        }
      }

      toast({ title: 'Config importada como Draft' });
      fetchVersions();
    } catch (err: any) {
      toast({ title: 'Erro ao importar', description: err.message, variant: 'destructive' });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handlePublish = async (versionId: string) => {
    // Archive current published
    await supabase
      .from('config_versions')
      .update({ status: 'archived' })
      .eq('status', 'published');

    // Publish selected
    await supabase
      .from('config_versions')
      .update({ status: 'published', published_at: new Date().toISOString() })
      .eq('id', versionId);

    toast({ title: 'Config publicada' });
    fetchVersions();
  };

  const handleExport = (version: ConfigVersion) => {
    const blob = new Blob([JSON.stringify(version.config_json, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${version.version_name}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const statusColors: Record<string, string> = {
    draft: 'secondary',
    published: 'default',
    archived: 'outline',
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Configuração</h1>
        <p className="text-sm text-muted-foreground">Gerenciar versões de config (dimensões, perguntas, pesos, etc.)</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Importar Config</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <Input
              ref={fileRef}
              type="file"
              accept=".json"
              onChange={handleImport}
              disabled={uploading}
            />
            <Button variant="outline" disabled={uploading} onClick={() => fileRef.current?.click()}>
              <Upload className="mr-1 h-4 w-4" />
              {uploading ? 'Importando...' : 'Upload'}
            </Button>
          </div>
          {validationError && (
            <p className="text-sm text-destructive">{validationError}</p>
          )}
          <p className="text-xs text-muted-foreground">
            Campos obrigatórios: {REQUIRED_FIELDS.join(', ')}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Versões</CardTitle>
        </CardHeader>
        <CardContent>
          {versions.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma versão encontrada</p>
          ) : (
            <div className="space-y-3">
              {versions.map((v) => (
                <div key={v.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <FileJson className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{v.version_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(v.created_at).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    <Badge variant={statusColors[v.status] as any}>{v.status}</Badge>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => handleExport(v)}>
                      <Download className="h-3 w-3" />
                    </Button>
                    {v.status === 'draft' && (
                      <Button size="sm" onClick={() => handlePublish(v.id)}>
                        <Check className="mr-1 h-3 w-3" /> Publicar
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
