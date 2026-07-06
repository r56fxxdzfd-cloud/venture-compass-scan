import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Upload, Download, Check, Trash2, FileJson, Eye, ChevronDown, ChevronUp, Inbox, Pencil, Copy, Sparkles, AlertTriangle, CalendarDays, Plus } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ConfigEditorPanel } from '@/components/config-editor/ConfigEditorPanel';
import type { ConfigVersion, ConfigJSON, DemoDayDate } from '@/types/darwin';
import { BackToTopFooter } from '@/components/BackToTopFooter';

const REQUIRED_FIELDS = ['dimensions', 'questions', 'weights_by_stage', 'targets_by_stage', 'methodology', 'simulator'];
const MONTH_NUMBER_BY_PT_NAME: Record<string, string> = {
  janeiro: '01',
  fevereiro: '02',
  marco: '03',
  março: '03',
  abril: '04',
  maio: '05',
  junho: '06',
  julho: '07',
  agosto: '08',
  setembro: '09',
  outubro: '10',
  novembro: '11',
  dezembro: '12',
};

type VersionUsage = {
  count: number;
  latestGeneratedAt: string | null;
  companies: string[];
};

function parseDemoDayDateLabel(value: string) {
  const trimmed = value.trim().toLowerCase();
  const slashDate = trimmed.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
  if (slashDate) {
    const [, day, month, year] = slashDate;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  const longDate = trimmed.match(/\b(\d{1,2})(?:\s*(?:e|,)\s*\d{1,2})?\s+de\s+([a-zç]+)\s+de\s+(\d{4})\b/);
  if (!longDate) return null;
  const [, day, monthName, year] = longDate;
  const month = MONTH_NUMBER_BY_PT_NAME[monthName];
  return month ? `${year}-${month}-${day.padStart(2, '0')}` : null;
}

function isMissingSchemaFieldError(error: { code?: string; message?: string } | null) {
  return error?.code === 'PGRST204' || /schema cache/i.test(error?.message || '');
}

export default function AdminConfigPage() {
  const [versions, setVersions] = useState<ConfigVersion[]>([]);
  const [uploading, setUploading] = useState(false);
  const [validationError, setValidationError] = useState('');
  const [expandedPreview, setExpandedPreview] = useState<string | null>(null);
  const [expandedEditor, setExpandedEditor] = useState<string | null>(null);
  const [publishTarget, setPublishTarget] = useState<ConfigVersion | null>(null);
  const [creatingDraft, setCreatingDraft] = useState(false);
  const [versionUsage, setVersionUsage] = useState<Record<string, VersionUsage>>({});
  const [demoDayDates, setDemoDayDates] = useState<DemoDayDate[]>([]);
  const [demoDayForm, setDemoDayForm] = useState({ title: '', date_label: '', location_or_format: '' });
  const [savingDemoDay, setSavingDemoDay] = useState(false);
  const [debriefCalendarUrl, setDebriefCalendarUrl] = useState('');
  const [savingDebriefUrl, setSavingDebriefUrl] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { user, canManageSensitiveParameters, canOperatePlatform, isDemoUser } = useAuth();
  const { toast } = useToast();

  const fetchVersions = async () => {
    const { data } = await supabase
      .from('config_versions')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setVersions(data as unknown as ConfigVersion[]);

    const { data: assessmentRows } = await supabase
      .from('assessments')
      .select('id, config_version_id, created_at, company:companies(name)')
      .order('created_at', { ascending: false });

    if (assessmentRows) {
      const usage = (assessmentRows as any[]).reduce<Record<string, VersionUsage>>((acc, row) => {
        const versionId = row.config_version_id;
        if (!versionId) return acc;
        if (!acc[versionId]) acc[versionId] = { count: 0, latestGeneratedAt: null, companies: [] };
        acc[versionId].count += 1;
        if (!acc[versionId].latestGeneratedAt || row.created_at > acc[versionId].latestGeneratedAt) {
          acc[versionId].latestGeneratedAt = row.created_at;
        }
        const companyName = row.company?.name;
        if (companyName && !acc[versionId].companies.includes(companyName)) {
          acc[versionId].companies.push(companyName);
        }
        return acc;
      }, {});
      setVersionUsage(usage);
    }
  };

  const fetchProgramSettings = async () => {
    const [{ data: dates }, { data: setting }] = await Promise.all([
      supabase.from('demo_day_dates').select('*').order('date', { ascending: true }),
      supabase.from('app_settings').select('value').eq('key', 'debrief_calendar_url').maybeSingle(),
    ]);
    setDemoDayDates((dates || []) as DemoDayDate[]);
    setDebriefCalendarUrl(setting?.value || 'https://calendly.com/patricia-sepp-boardwise/diagnostico-inicial-darwin-growth?month=2026-07');
  };

  useEffect(() => {
    fetchVersions();
    fetchProgramSettings();
  }, []);

  const hasDraft = versions.some(v => v.status === 'draft');
  const latestDraft = versions.find(v => v.status === 'draft');
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

  const createDemoDayDate = async () => {
    const derivedDate = parseDemoDayDateLabel(demoDayForm.date_label);
    if (!demoDayForm.title.trim() || !demoDayForm.date_label.trim()) {
      toast({ title: 'Informe título e texto das datas do Demo Day', variant: 'destructive' });
      return;
    }
    if (!derivedDate) {
      toast({ title: 'Use um texto de datas com dia, mês e ano', description: 'Exemplo: 22 e 23 de julho de 2026.', variant: 'destructive' });
      return;
    }
    setSavingDemoDay(true);
    const insertPayload = {
      title: demoDayForm.title.trim(),
      date: derivedDate,
      date_label: demoDayForm.date_label.trim() || null,
      location_or_format: demoDayForm.location_or_format || null,
      is_active: true,
    };
    let { error } = await supabase.from('demo_day_dates').insert(insertPayload);
    if (isMissingSchemaFieldError(error)) {
      const { date_label: _dateLabel, ...legacyPayload } = insertPayload;
      const retry = await supabase.from('demo_day_dates').insert(legacyPayload);
      error = retry.error;
    }
    setSavingDemoDay(false);
    if (error) {
      toast({ title: 'Erro ao criar data', description: error.message, variant: 'destructive' });
      return;
    }
    setDemoDayForm({ title: '', date_label: '', location_or_format: '' });
    toast({ title: 'Data de Demo Day criada' });
    fetchProgramSettings();
  };

  const toggleDemoDayDate = async (date: DemoDayDate) => {
    const { error } = await supabase.from('demo_day_dates').update({ is_active: !date.is_active }).eq('id', date.id);
    if (error) {
      toast({ title: 'Erro ao atualizar data', description: error.message, variant: 'destructive' });
      return;
    }
    fetchProgramSettings();
  };

  const saveDebriefUrl = async () => {
    setSavingDebriefUrl(true);
    const { error } = await supabase.from('app_settings').update({ value: debriefCalendarUrl }).eq('key', 'debrief_calendar_url');
    setSavingDebriefUrl(false);
    if (error) {
      toast({ title: 'Erro ao salvar Calendly', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Link de devolutiva atualizado' });
  };

  const statusColors: Record<string, string> = { draft: 'secondary', published: 'default', archived: 'outline' };
  const statusLabels: Record<string, string> = { draft: 'draft', published: 'publicada', archived: 'arquivada' };
  const formatDate = (value?: string | null) => value ? new Date(value).toLocaleDateString('pt-BR') : '—';

  const getPreviewInfo = (cfg: ConfigJSON) => {
    const dims = cfg.dimensions?.length || 0;
    const questions = cfg.questions?.filter(q => q.is_active !== false).length || 0;
    const redFlags = cfg.red_flags?.length || 0;
    const presets = cfg.simulator?.presets?.length || 0;
    return { dims, questions, redFlags, presets, dimNames: cfg.dimensions?.map(d => d.label) || [], presetNames: cfg.simulator?.presets?.map(p => p.label) || [] };
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-primary/10 via-violet-500/5 to-transparent p-7 sm:p-8">
        <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-primary/15 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-16 h-56 w-56 rounded-full bg-violet-500/15 blur-3xl pointer-events-none" />
        <div className="relative space-y-3 max-w-2xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-semibold tracking-[0.16em] text-primary uppercase">
            <Sparkles className="h-3 w-3" /> Governança Metodológica
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">Configuração</h1>
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">Gerenciar versões de config — dimensões, perguntas, pesos e demais parâmetros do diagnóstico.</p>
        </div>
      </section>

      {latestDraft && (
        <Card className="border-amber-500/30 bg-amber-500/[0.06]">
          <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <div className="space-y-1">
                <p className="text-sm font-semibold">Existe draft não publicado</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  O draft <strong>{latestDraft.version_name}</strong> foi criado/editado em {formatDate(latestDraft.created_at)}.{' '}
                  Novos diagnósticos continuam usando a versão publicada <strong>{publishedVersion?.version_name || 'não definida'}</strong>
                  {publishedVersion?.published_at ? ` (${formatDate(publishedVersion.published_at)})` : ''}, até que o draft seja publicado.
                </p>
              </div>
            </div>
            {canManageSensitiveParameters && (
              <Button variant="outline" size="sm" onClick={() => setExpandedEditor(latestDraft.id)}>
                <Pencil className="mr-1.5 h-3.5 w-3.5" /> Abrir draft
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="executive-surface">
        <CardHeader>
          <CardTitle className="text-base">Importar Config</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <Input ref={fileRef} type="file" accept=".json" onChange={handleImport} disabled={uploading || !canManageSensitiveParameters} />
            <Button variant="outline" disabled={uploading} onClick={() => fileRef.current?.click()}>
              <Upload className="mr-1 h-4 w-4" />
              {uploading ? 'Importando...' : 'Upload'}
            </Button>
          </div>
          {validationError && <p className="text-sm text-destructive">{validationError}</p>}
          <p className="text-xs text-muted-foreground">Campos obrigatórios: {REQUIRED_FIELDS.join(', ')}</p>
        </CardContent>
      </Card>

      <Card className="executive-surface">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarDays className="h-4 w-4 text-primary" /> Fluxo do empreendedor
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label className="text-xs">Link externo de devolutiva</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input value={debriefCalendarUrl} onChange={(event) => setDebriefCalendarUrl(event.target.value)} disabled={!canOperatePlatform} />
              <Button variant="outline" onClick={saveDebriefUrl} disabled={!canOperatePlatform || savingDebriefUrl}>
                {savingDebriefUrl ? 'Salvando...' : 'Salvar link'}
              </Button>
            </div>
          </div>

          <div className="rounded-lg border p-3">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Datas de Demo Day</p>
                <p className="text-xs text-muted-foreground">Datas ativas aparecem para o empreendedor antes do diagnóstico.</p>
              </div>
            </div>
            {demoDayDates.length === 0 ? (
              <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">Nenhuma data configurada.</p>
            ) : (
              <div className="space-y-2">
                {demoDayDates.map((date) => (
                  <div key={date.id} className="flex flex-col gap-2 rounded-md border px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium">{date.title}</p>
                        <Badge variant={date.is_active ? 'default' : 'outline'}>{date.is_active ? 'Ativa' : 'Inativa'}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {date.date_label || formatDate(date.date)}
                        {date.location_or_format ? ` · ${date.location_or_format}` : ''}
                      </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => toggleDemoDayDate(date)} disabled={!canOperatePlatform}>
                      {date.is_active ? 'Desativar' : 'Ativar'}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {canOperatePlatform && (
            <div className="grid gap-3 rounded-lg border border-dashed p-3 sm:grid-cols-6">
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs">Título</Label>
                <Input value={demoDayForm.title} onChange={(event) => setDemoDayForm({ ...demoDayForm, title: event.target.value })} placeholder="Demo Day São Paulo - Opção 1" />
              </div>
              <div className="space-y-1 sm:col-span-4">
                <Label className="text-xs">Texto das datas</Label>
                <Input value={demoDayForm.date_label} onChange={(event) => setDemoDayForm({ ...demoDayForm, date_label: event.target.value })} placeholder="22 e 23 de julho de 2026" />
              </div>
              <div className="space-y-1 sm:col-span-5">
                <Label className="text-xs">Local / formato</Label>
                <Input value={demoDayForm.location_or_format} onChange={(event) => setDemoDayForm({ ...demoDayForm, location_or_format: event.target.value })} placeholder="Online, presencial ou local" />
              </div>
              <div className="flex items-end">
                <Button className="w-full" onClick={createDemoDayDate} disabled={savingDemoDay}>
                  <Plus className="mr-1 h-4 w-4" /> {savingDemoDay ? 'Criando...' : 'Criar'}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Draft button */}
      {canManageSensitiveParameters && !hasDraft && publishedVersion && (
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
                const usage = versionUsage[v.id] || { count: 0, latestGeneratedAt: null, companies: [] };
                return (
                  <div key={v.id} className="rounded-lg border">
                    <div className="flex items-center justify-between p-3">
                      <div className="flex items-center gap-3">
                        <FileJson className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">{v.version_name}</p>
                          <p className="text-xs text-muted-foreground">
                            Criada/editada em {formatDate(v.created_at)}
                            {v.published_at ? ` • publicada em ${formatDate(v.published_at)}` : ''}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {usage.count} diagnóstico{usage.count === 1 ? '' : 's'} vinculado{usage.count === 1 ? '' : 's'}
                            {usage.latestGeneratedAt ? ` • último em ${formatDate(usage.latestGeneratedAt)}` : ''}
                            {usage.companies.length > 0 ? ` • ${usage.companies.slice(0, 3).join(', ')}${usage.companies.length > 3 ? ` +${usage.companies.length - 3}` : ''}` : ''}
                          </p>
                        </div>
                        <Badge variant={statusColors[v.status] as any}>{statusLabels[v.status] || v.status}</Badge>
                      </div>
                      <TooltipProvider>
                        <div className="flex gap-1">
                          {canManageSensitiveParameters && isDraft && (
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
                          {canManageSensitiveParameters && isDraft && (
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
                          {canManageSensitiveParameters && isDraft && (
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
                    {canManageSensitiveParameters && isEditorExpanded && isDraft && (
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
      <BackToTopFooter />
    </div>
  );
}
