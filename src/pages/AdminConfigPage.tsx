import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Upload, Download, Check, Trash2, FileJson, Eye, ChevronDown, ChevronUp, Inbox, Pencil, Copy } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ConfigEditorPanel } from '@/components/config-editor/ConfigEditorPanel';
import type { ConfigVersion, ConfigJSON } from '@/types/darwin';

const REQUIRED_FIELDS = ['dimensions', 'questions', 'weights_by_stage', 'targets_by_stage', 'methodology', 'simulator'];

export default function AdminConfigPage() {
  const [versions, setVersions] = useState<ConfigVersion[]>([]);
  const [uploading, setUploading] = useState(false);
  const [validationError, setValidationError] = useState('');
  const [expandedPreview, setExpandedPreview] = useState<string | null>(null);
  const [expandedEditor, setExpandedEditor] = useState<string | null>(null);
  const [publishTarget, setPublishTarget] = useState<ConfigVersion | null>(null);
  const [creatingDraft, setCreatingDraft] = useState(false);
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

  const hasDraft = versions.some(v => v.status === 'draft');
  const publishedVersion = versions.find(v => v.status === 'published');

  // ---- Create draft from published ----
  const createDraftFromPublished = async () => {
    if (!publishedVersion) return;
    setCreatingDraft(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const name = `${publishedVersion.version_name}_edit_${today}`;
      const clonedJson = JSON.parse(JSON.stringify(publishedVersion.config_json));

      const { data, error } = await supabase.from('config_versions').insert({
        version_name: name,
        config_json: clonedJson,
        created_by: user?.id,
        status: 'draft',
      }).select().single();

      if (error) throw error;

      toast({ title: 'Draft criado com sucesso' });
      await fetchVersions();
      if (data) setExpandedEditor(data.id);
    } catch (err: any) {
      toast({ title: 'Erro ao criar draft', description: err.message, variant: 'destructive' });
    } finally {
      setCreatingDraft(false);
    }
  };

  // ---- Import (unchanged) ----
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setValidationError('');

    try {
      const text = await file.text();
      const json = JSON.parse(text) as ConfigJSON;

      const missing = REQUIRED_FIELDS.filter((f) => !(f in json));
      if (missing.length > 0) {
        setValidationError(`Campos obrigatórios ausentes: ${missing.join(', ')}`);
        setUploading(false);
        return;
      }

      const { data: cv, error } = await supabase.from('config_versions').insert({
        version_name: file.name.replace('.json', ''),
        config_json: json as any,
        created_by: user?.id,
      }).select().single();

      if (error) throw error;

      if (cv) {
        const versionId = cv.id;

        if (json.dimensions?.length) {
          await supabase.from('dimensions').insert(
            json.dimensions.map((d) => ({ id: d.id, config_version_id: versionId, label: d.label, sort_order: d.sort_order }))
          );
        }

        if (json.questions?.length) {
          await supabase.from('questions').insert(
            json.questions.map((q) => ({
              id: q.id, config_version_id: versionId, dimension_id: q.dimension_id, text: q.text,
              type: q.type || 'likert', scale_id: q.scale_id || 'likert_1_5',
              tags: (q.tags || {}) as any, tooltip: (q.tooltip || {}) as any,
              is_active: q.is_active !== false, sort_order: q.sort_order,
            }))
          );
        }

        if (json.deep_dive_prompts) {
          const dd = json.deep_dive_prompts;
          const deepDiveMap: Record<string, string[]> = {};
          if (Array.isArray(dd)) {
            dd.forEach((item: any) => {
              const dimId = item?.dimension_id;
              const pList = Array.isArray(item?.prompts) ? item.prompts : [];
              if (dimId) deepDiveMap[dimId] = pList;
            });
          } else if (typeof dd === 'object') {
            Object.entries(dd).forEach(([dimId, promptList]) => {
              deepDiveMap[dimId] = Array.isArray(promptList) ? promptList as string[] : [];
            });
          }
          const prompts: any[] = [];
          Object.entries(deepDiveMap).forEach(([dimId, pList]) => {
            pList.forEach((prompt, i) => {
              prompts.push({ config_version_id: versionId, dimension_id: dimId, prompt, sort_order: i });
            });
          });
          if (prompts.length) await supabase.from('deep_dive_prompts').insert(prompts);
        }

        if (json.red_flags?.length) {
          await supabase.from('red_flags').insert(
            json.red_flags.map((rf) => ({
              code: rf.code, config_version_id: versionId, label: rf.label,
              severity: rf.severity, triggers: rf.triggers as any, actions: rf.actions as any,
            }))
          );
        }

        if (json.glossary) {
          await supabase.from('glossary_terms').insert(
            Object.entries(json.glossary).map(([term, definition]) => ({
              config_version_id: versionId, term, definition: definition as string,
            }))
          );
        }

        if (json.simulator?.presets?.length) {
          await supabase.from('simulator_presets').insert(
            json.simulator.presets.map((p) => ({
              id: p.id, config_version_id: versionId, label: p.label,
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

  const confirmPublish = async () => {
    if (!publishTarget) return;
    await supabase.from('config_versions').update({ status: 'archived' }).eq('status', 'published');
    await supabase.from('config_versions').update({ status: 'published', published_at: new Date().toISOString() }).eq('id', publishTarget.id);
    toast({ title: 'Config publicada' });
    setPublishTarget(null);
    setExpandedEditor(null);
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

  const handleDelete = async (versionId: string) => {
    try {
      const tables = ['dimensions', 'questions', 'deep_dive_prompts', 'red_flags', 'glossary_terms', 'simulator_presets'] as const;
      for (const table of tables) {
        await supabase.from(table).delete().eq('config_version_id', versionId);
      }
      const { error } = await supabase.from('config_versions').delete().eq('id', versionId);
      if (error) throw error;
      toast({ title: 'Versão excluída com sucesso' });
      if (expandedEditor === versionId) setExpandedEditor(null);
      fetchVersions();
    } catch (err: any) {
      toast({ title: 'Erro ao excluir', description: err.message, variant: 'destructive' });
    }
  };

  const handleConfigUpdated = (versionId: string, newConfig: ConfigJSON) => {
    setVersions(prev => prev.map(v => v.id === versionId ? { ...v, config_json: newConfig } : v));
  };

  const statusColors: Record<string, string> = { draft: 'secondary', published: 'default', archived: 'outline' };

  const getPreviewInfo = (cfg: ConfigJSON) => {
    const dims = cfg.dimensions?.length || 0;
    const questions = cfg.questions?.filter(q => q.is_active !== false).length || 0;
    const redFlags = cfg.red_flags?.length || 0;
    const presets = cfg.simulator?.presets?.length || 0;
    return { dims, questions, redFlags, presets, dimNames: cfg.dimensions?.map(d => d.label) || [], presetNames: cfg.simulator?.presets?.map(p => p.label) || [] };
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
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
            <Input ref={fileRef} type="file" accept=".json" onChange={handleImport} disabled={uploading} />
            <Button variant="outline" disabled={uploading} onClick={() => fileRef.current?.click()}>
              <Upload className="mr-1 h-4 w-4" />
              {uploading ? 'Importando...' : 'Upload'}
            </Button>
          </div>
          {validationError && <p className="text-sm text-destructive">{validationError}</p>}
          <p className="text-xs text-muted-foreground">Campos obrigatórios: {REQUIRED_FIELDS.join(', ')}</p>
        </CardContent>
      </Card>

      {/* Create Draft button */}
      {!hasDraft && publishedVersion && (
        <Card className="border-dashed">
          <CardContent className="pt-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Nenhum draft disponível</p>
              <p className="text-xs text-muted-foreground">Crie um draft a partir da versão publicada para fazer edições visuais.</p>
            </div>
            <Button onClick={createDraftFromPublished} disabled={creatingDraft}>
              <Copy className="mr-1.5 h-4 w-4" />
              {creatingDraft ? 'Criando...' : 'Criar Draft para Edição'}
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Versões</CardTitle>
        </CardHeader>
        <CardContent>
          {versions.length === 0 ? (
            <div className="text-center py-8">
              <Inbox className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">Nenhuma versão importada. Faça upload de um arquivo JSON para começar.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {versions.map((v) => {
                const preview = getPreviewInfo(v.config_json);
                const isPreviewExpanded = expandedPreview === v.id;
                const isEditorExpanded = expandedEditor === v.id;
                const isDraft = v.status === 'draft';
                return (
                  <div key={v.id} className="rounded-lg border">
                    <div className="flex items-center justify-between p-3">
                      <div className="flex items-center gap-3">
                        <FileJson className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">{v.version_name}</p>
                          <p className="text-xs text-muted-foreground">{new Date(v.created_at).toLocaleDateString('pt-BR')}</p>
                        </div>
                        <Badge variant={statusColors[v.status] as any}>{v.status}</Badge>
                      </div>
                      <TooltipProvider>
                        <div className="flex gap-1">
                          {isDraft && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant={isEditorExpanded ? 'default' : 'outline'}
                                  size="sm"
                                  onClick={() => setExpandedEditor(isEditorExpanded ? null : v.id)}
                                >
                                  <Pencil className="h-3 w-3 mr-1" /> Editar
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Abrir editor visual de configuração</TooltipContent>
                            </Tooltip>
                          )}
                          {isDraft && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="sm" onClick={() => { setExpandedPreview(isPreviewExpanded ? null : v.id); if (isEditorExpanded) setExpandedEditor(null); }}>
                                  <Eye className="h-3 w-3 mr-1" />
                                  {isPreviewExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Pré-visualizar conteúdo da versão</TooltipContent>
                            </Tooltip>
                          )}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="sm" onClick={() => handleExport(v)}>
                                <Download className="h-3 w-3" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Exportar como JSON</TooltipContent>
                          </Tooltip>
                          {isDraft && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button size="sm" onClick={() => setPublishTarget(v)}>
                                  <Check className="mr-1 h-3 w-3" /> Publicar
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Ativar esta versão para novos diagnósticos</TooltipContent>
                            </Tooltip>
                          )}
                          {v.status !== 'published' && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Excluir versão "{v.version_name}"?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Isso removerá permanentemente esta versão e todos os dados relacionados. Esta ação não pode ser desfeita.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => handleDelete(v.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                        Excluir
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </TooltipTrigger>
                              <TooltipContent>Excluir esta versão permanentemente</TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </TooltipProvider>
                    </div>

                    {/* Preview panel */}
                    {isPreviewExpanded && !isEditorExpanded && (
                      <div className="border-t p-3 bg-muted/30 space-y-2">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                          <div><p className="text-lg font-bold">{preview.dims}</p><p className="text-[10px] text-muted-foreground">Dimensões</p></div>
                          <div><p className="text-lg font-bold">{preview.questions}</p><p className="text-[10px] text-muted-foreground">Perguntas</p></div>
                          <div><p className="text-lg font-bold">{preview.redFlags}</p><p className="text-[10px] text-muted-foreground">Red Flags</p></div>
                          <div><p className="text-lg font-bold">{preview.presets}</p><p className="text-[10px] text-muted-foreground">Presets</p></div>
                        </div>
                        {preview.dimNames.length > 0 && (
                          <div>
                            <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-1">Dimensões</p>
                            <div className="flex flex-wrap gap-1">
                              {preview.dimNames.map(n => <Badge key={n} variant="outline" className="text-[10px]">{n}</Badge>)}
                            </div>
                          </div>
                        )}
                        {preview.presetNames.length > 0 && (
                          <div>
                            <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-1">Presets</p>
                            <div className="flex flex-wrap gap-1">
                              {preview.presetNames.map(n => <Badge key={n} variant="secondary" className="text-[10px]">{n}</Badge>)}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Editor panel */}
                    {isEditorExpanded && isDraft && (
                      <ConfigEditorPanel
                        draftId={v.id}
                        initialConfig={v.config_json}
                        onConfigUpdated={(cfg) => handleConfigUpdated(v.id, cfg)}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Publish confirmation dialog */}
      <AlertDialog open={!!publishTarget} onOpenChange={(open) => { if (!open) setPublishTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Publicar "{publishTarget?.version_name}"?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>Isso arquivará a versão publicada atual e ativará esta versão para todos os novos diagnósticos.</p>
                {publishTarget && (() => {
                  const p = getPreviewInfo(publishTarget.config_json);
                  return (
                    <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
                      <p><strong>{p.dims}</strong> dimensões</p>
                      <p><strong>{p.questions}</strong> perguntas ativas</p>
                      <p><strong>{p.redFlags}</strong> red flags</p>
                      <p><strong>{p.presets}</strong> presets</p>
                    </div>
                  );
                })()}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmPublish}>Confirmar Publicação</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
