import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { friendlySupabaseError } from '@/utils/supabase-errors';
import { Download, Eye, FileText, Loader2, Pencil, Plus, Trash2, Upload } from 'lucide-react';
import type {
  StartupDocument,
  StartupDocumentCategory,
  StartupDocumentRelatedEntityType,
  StartupDocumentVisibility,
} from '@/types/darwin';

const DOCUMENT_BUCKET = 'startup-documents';

const CATEGORY_LABELS: Record<StartupDocumentCategory, string> = {
  diagnostic_external: 'Diagnóstico externo',
  pitch_deck: 'Pitch deck',
  financial: 'Financeiro',
  commercial: 'Comercial',
  product: 'Produto',
  legal_corporate: 'Jurídico / societário',
  board_meeting: 'Reunião de conselho',
  action_plan: 'Plano de ação',
  other: 'Outro',
};

const VISIBILITY_LABELS: Record<StartupDocumentVisibility, string> = {
  internal_only: 'Interno',
  startup_and_internal: 'Startup + interno',
};

const RELATED_TYPE_LABELS: Record<StartupDocumentRelatedEntityType, string> = {
  diagnostic: 'Diagnóstico',
  red_flag: 'Red flag',
  meeting: 'Reunião',
  action_plan: 'Plano de ação',
};

const DOCUMENT_CATEGORIES = Object.entries(CATEGORY_LABELS) as [StartupDocumentCategory, string][];

type AssociationOption = {
  value: string;
  label: string;
  group: string;
  related_entity_type: StartupDocumentRelatedEntityType;
  related_entity_id: string;
};

type DocumentForm = {
  file: File | null;
  document_category: StartupDocumentCategory;
  description: string;
  visibility: StartupDocumentVisibility;
  relatedKey: string;
};

type EditForm = Omit<DocumentForm, 'file'>;

const emptyDocumentForm: DocumentForm = {
  file: null,
  document_category: 'other',
  description: '',
  visibility: 'internal_only',
  relatedKey: 'none',
};

function formatDateTimeBR(value?: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function formatDateOnlyBR(value?: string | null) {
  if (!value) return '-';
  const [year, month, day] = value.split('-');
  if (!year || !month || !day) return '-';
  return `${day}/${month}/${year}`;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileExtension(fileName: string) {
  return fileName.split('.').pop()?.toLowerCase() || 'arquivo';
}

function sanitizeFileName(fileName: string) {
  return fileName.trim().replace(/[^a-zA-Z0-9._-]/g, '-').replace(/-+/g, '-').slice(0, 140) || 'documento';
}

function makeStoragePath(companyId: string, fileName: string) {
  const uniqueId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${companyId}/${uniqueId}-${sanitizeFileName(fileName)}`;
}

function parseRelatedKey(relatedKey: string): Pick<StartupDocument, 'related_entity_type' | 'related_entity_id'> {
  if (relatedKey === 'none') return { related_entity_type: null, related_entity_id: null };
  const [type, id] = relatedKey.split(':');
  if (!type || !id) return { related_entity_type: null, related_entity_id: null };
  return {
    related_entity_type: type as StartupDocumentRelatedEntityType,
    related_entity_id: id,
  };
}

function getRelatedKey(doc: StartupDocument) {
  if (!doc.related_entity_type || !doc.related_entity_id) return 'none';
  return `${doc.related_entity_type}:${doc.related_entity_id}`;
}

function getRelatedLabel(doc: StartupDocument, options: AssociationOption[]) {
  if (!doc.related_entity_type || !doc.related_entity_id) return '-';
  const key = `${doc.related_entity_type}:${doc.related_entity_id}`;
  return options.find((option) => option.value === key)?.label || RELATED_TYPE_LABELS[doc.related_entity_type] || doc.related_entity_type;
}

export function StartupDocumentsSection({
  companyId,
  canUpload,
  canEdit,
  canDelete,
  isInternalUser,
}: {
  companyId: string;
  canUpload: boolean;
  canEdit: boolean;
  canDelete: boolean;
  isInternalUser: boolean;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [documents, setDocuments] = useState<StartupDocument[]>([]);
  const [uploaderNames, setUploaderNames] = useState<Record<string, string>>({});
  const [associationOptions, setAssociationOptions] = useState<AssociationOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [form, setForm] = useState<DocumentForm>(emptyDocumentForm);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [editDoc, setEditDoc] = useState<StartupDocument | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({
    document_category: 'other',
    description: '',
    visibility: 'internal_only',
    relatedKey: 'none',
  });
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const groupedAssociationOptions = useMemo(() => {
    return associationOptions.reduce<Record<string, AssociationOption[]>>((acc, option) => {
      acc[option.group] = acc[option.group] || [];
      acc[option.group].push(option);
      return acc;
    }, {});
  }, [associationOptions]);

  const resetForm = () => {
    setForm(emptyDocumentForm);
    setFileInputKey((key) => key + 1);
  };

  const loadDocuments = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('startup_documents')
      .select('*')
      .eq('startup_id', companyId)
      .order('created_at', { ascending: false });

    if (error) {
      toast({ title: 'Erro ao carregar documentos', description: friendlySupabaseError(error.message), variant: 'destructive' });
      setLoading(false);
      return;
    }

    const rows = (data || []) as StartupDocument[];
    setDocuments(rows);

    const uploaderIds = Array.from(new Set(rows.map((doc) => doc.uploaded_by_user_id).filter(Boolean)));
    if (uploaderIds.length > 0) {
      const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', uploaderIds);
      const names: Record<string, string> = {};
      (profiles || []).forEach((profile) => {
        names[profile.id] = profile.full_name || 'Usuário';
      });
      setUploaderNames(names);
    } else {
      setUploaderNames({});
    }

    setLoading(false);
  };

  const loadAssociationOptions = async () => {
    const [{ data: assessmentRows }, { data: meetingRows }, { data: actionRows }] = await Promise.all([
      supabase.from('assessments').select('id, created_at, status').eq('company_id', companyId).order('created_at', { ascending: false }),
      supabase.from('council_meetings').select('id, meeting_date, title').eq('company_id', companyId).order('meeting_date', { ascending: false }),
      supabase.from('action_items').select('id, title, status').eq('company_id', companyId).order('created_at', { ascending: false }),
    ]);

    const assessmentIds = (assessmentRows || []).map((assessment) => assessment.id);
    const { data: redFlagRows } = assessmentIds.length > 0
      ? await supabase
        .from('assessment_red_flags')
        .select('id, assessment_id, red_flag_code, status')
        .in('assessment_id', assessmentIds)
      : { data: [] };

    const options: AssociationOption[] = [
      ...(assessmentRows || []).map((assessment) => ({
        value: `diagnostic:${assessment.id}`,
        group: 'Diagnósticos',
        label: `${formatDateTimeBR(assessment.created_at)} - ${assessment.status === 'completed' ? 'concluído' : 'rascunho'}`,
        related_entity_type: 'diagnostic' as const,
        related_entity_id: assessment.id,
      })),
      ...(redFlagRows || []).map((redFlag) => ({
        value: `red_flag:${redFlag.id}`,
        group: 'Red flags',
        label: `${redFlag.red_flag_code} - ${redFlag.status || 'ativo'}`,
        related_entity_type: 'red_flag' as const,
        related_entity_id: redFlag.id,
      })),
      ...(meetingRows || []).map((meeting) => ({
        value: `meeting:${meeting.id}`,
        group: 'Reuniões',
        label: `${formatDateOnlyBR(meeting.meeting_date)} - ${meeting.title || 'Reunião'}`,
        related_entity_type: 'meeting' as const,
        related_entity_id: meeting.id,
      })),
      ...(actionRows || []).map((action) => ({
        value: `action_plan:${action.id}`,
        group: 'Plano de ação',
        label: `${action.title} - ${action.status}`,
        related_entity_type: 'action_plan' as const,
        related_entity_id: action.id,
      })),
    ];

    setAssociationOptions(options);
  };

  useEffect(() => {
    loadDocuments();
    loadAssociationOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  const handleUpload = async () => {
    if (!user) return;
    if (!form.file) {
      toast({ title: 'Selecione um arquivo', variant: 'destructive' });
      return;
    }

    const file = form.file;
    const filePath = makeStoragePath(companyId, file.name);
    const visibility = isInternalUser ? form.visibility : 'internal_only';
    const related = parseRelatedKey(form.relatedKey);
    setUploading(true);

    const { error: uploadError } = await supabase.storage
      .from(DOCUMENT_BUCKET)
      .upload(filePath, file, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      });

    if (uploadError) {
      setUploading(false);
      toast({ title: 'Erro ao enviar arquivo', description: friendlySupabaseError(uploadError.message), variant: 'destructive' });
      return;
    }

    const { error: insertError } = await supabase.from('startup_documents').insert({
      startup_id: companyId,
      uploaded_by_user_id: user.id,
      file_name: file.name,
      file_url: filePath,
      file_type: getFileExtension(file.name),
      mime_type: file.type || 'application/octet-stream',
      file_size: file.size,
      document_category: form.document_category,
      description: form.description.trim() || null,
      visibility,
      related_entity_type: related.related_entity_type,
      related_entity_id: related.related_entity_id,
    });

    if (insertError) {
      await supabase.storage.from(DOCUMENT_BUCKET).remove([filePath]);
      setUploading(false);
      toast({ title: 'Erro ao salvar documento', description: friendlySupabaseError(insertError.message), variant: 'destructive' });
      return;
    }

    setUploading(false);
    setUploadOpen(false);
    resetForm();
    toast({
      title: 'Documento adicionado',
      description: visibility === 'internal_only' && !isInternalUser ? 'O arquivo entrou como interno para revisão.' : undefined,
    });
    loadDocuments();
  };

  const handleOpen = async (doc: StartupDocument) => {
    setOpeningId(doc.id);
    const { data, error } = await supabase.storage.from(DOCUMENT_BUCKET).createSignedUrl(doc.file_url, 300);
    setOpeningId(null);
    if (error || !data?.signedUrl) {
      toast({ title: 'Erro ao abrir documento', description: friendlySupabaseError(error?.message || 'URL indisponivel.'), variant: 'destructive' });
      return;
    }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  };

  const handleDownload = async (doc: StartupDocument) => {
    setDownloadingId(doc.id);
    const { data, error } = await supabase.storage.from(DOCUMENT_BUCKET).download(doc.file_url);
    setDownloadingId(null);
    if (error || !data) {
      toast({ title: 'Erro ao baixar documento', description: friendlySupabaseError(error?.message || 'Arquivo indisponivel.'), variant: 'destructive' });
      return;
    }

    const url = URL.createObjectURL(data);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = doc.file_name;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const openEdit = (doc: StartupDocument) => {
    setEditDoc(doc);
    setEditForm({
      document_category: doc.document_category,
      description: doc.description || '',
      visibility: doc.visibility,
      relatedKey: getRelatedKey(doc),
    });
  };

  const handleSaveEdit = async () => {
    if (!editDoc) return;
    const related = parseRelatedKey(editForm.relatedKey);
    setSavingEdit(true);
    const { error } = await supabase
      .from('startup_documents')
      .update({
        document_category: editForm.document_category,
        description: editForm.description.trim() || null,
        visibility: editForm.visibility,
        related_entity_type: related.related_entity_type,
        related_entity_id: related.related_entity_id,
      })
      .eq('id', editDoc.id);
    setSavingEdit(false);

    if (error) {
      toast({ title: 'Erro ao salvar documento', description: friendlySupabaseError(error.message), variant: 'destructive' });
      return;
    }

    setEditDoc(null);
    toast({ title: 'Documento atualizado' });
    loadDocuments();
  };

  const handleDelete = async (doc: StartupDocument) => {
    const ok = window.confirm(`Excluir "${doc.file_name}"?`);
    if (!ok) return;

    setDeletingId(doc.id);
    const { error: storageError } = await supabase.storage.from(DOCUMENT_BUCKET).remove([doc.file_url]);
    if (storageError) {
      setDeletingId(null);
      toast({ title: 'Erro ao excluir arquivo', description: friendlySupabaseError(storageError.message), variant: 'destructive' });
      return;
    }

    const { error } = await supabase.from('startup_documents').delete().eq('id', doc.id);
    setDeletingId(null);
    if (error) {
      toast({ title: 'Erro ao excluir documento', description: friendlySupabaseError(error.message), variant: 'destructive' });
      return;
    }

    setDocuments((prev) => prev.filter((item) => item.id !== doc.id));
    toast({ title: 'Documento excluído' });
  };

  return (
    <Card className="executive-panel">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="executive-section-title text-xs">Contexto da startup</p>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4 text-primary" /> Documentos de apoio
            </CardTitle>
          </div>
          {canUpload && (
            <Button size="sm" onClick={() => setUploadOpen(true)}>
              <Plus className="mr-1 h-3.5 w-3.5" /> Adicionar documento
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : documents.length === 0 ? (
          <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            Nenhum documento anexado ainda.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Visibilidade</TableHead>
                  <TableHead>Associação</TableHead>
                  <TableHead>Enviado por</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell className="min-w-56">
                      <div className="font-medium">{doc.file_name}</div>
                      <div className="text-xs text-muted-foreground">{doc.file_type.toUpperCase()} - {formatFileSize(doc.file_size)}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="whitespace-nowrap">{CATEGORY_LABELS[doc.document_category]}</Badge>
                    </TableCell>
                    <TableCell className="max-w-64">
                      <p className="line-clamp-2 text-sm text-muted-foreground">{doc.description || '-'}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant={doc.visibility === 'internal_only' ? 'outline' : 'default'} className="whitespace-nowrap">
                        {VISIBILITY_LABELS[doc.visibility]}
                      </Badge>
                    </TableCell>
                    <TableCell className="min-w-40 text-sm text-muted-foreground">{getRelatedLabel(doc, associationOptions)}</TableCell>
                    <TableCell className="min-w-32 text-sm">
                      {uploaderNames[doc.uploaded_by_user_id] || (doc.uploaded_by_user_id === user?.id ? 'Você' : 'Usuário')}
                    </TableCell>
                    <TableCell className="min-w-32 text-sm text-muted-foreground">{formatDateTimeBR(doc.created_at)}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpen(doc)} disabled={openingId === doc.id}>
                          {openingId === doc.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
                          <span className="sr-only">Visualizar</span>
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDownload(doc)} disabled={downloadingId === doc.id}>
                          {downloadingId === doc.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                          <span className="sr-only">Baixar</span>
                        </Button>
                        {canEdit && (
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(doc)}>
                            <Pencil className="h-3.5 w-3.5" />
                            <span className="sr-only">Editar</span>
                          </Button>
                        )}
                        {canDelete && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => handleDelete(doc)}
                            disabled={deletingId === doc.id}
                          >
                            {deletingId === doc.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                            <span className="sr-only">Excluir</span>
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <Dialog open={uploadOpen} onOpenChange={(open) => {
        setUploadOpen(open);
        if (!open) resetForm();
      }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Adicionar documento</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Arquivo</Label>
              <Input key={fileInputKey} type="file" onChange={(event) => setForm((prev) => ({ ...prev, file: event.target.files?.[0] || null }))} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">Tipo</Label>
                <Select value={form.document_category} onValueChange={(value) => setForm((prev) => ({ ...prev, document_category: value as StartupDocumentCategory }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DOCUMENT_CATEGORIES.map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Visibilidade</Label>
                {isInternalUser ? (
                  <Select value={form.visibility} onValueChange={(value) => setForm((prev) => ({ ...prev, visibility: value as StartupDocumentVisibility }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="internal_only">Interno</SelectItem>
                      <SelectItem value="startup_and_internal">Startup + interno</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="flex h-10 items-center rounded-md border px-3 text-sm text-muted-foreground">Interno até revisão</div>
                )}
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Descrição curta</Label>
              <Textarea rows={2} value={form.description} maxLength={240} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Associação opcional</Label>
              <AssociationSelect
                value={form.relatedKey}
                groupedOptions={groupedAssociationOptions}
                onChange={(value) => setForm((prev) => ({ ...prev, relatedKey: value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadOpen(false)}>Cancelar</Button>
            <Button onClick={handleUpload} disabled={uploading || !form.file}>
              {uploading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Upload className="mr-1 h-4 w-4" />}
              {uploading ? 'Enviando...' : 'Adicionar documento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editDoc} onOpenChange={(open) => {
        if (!open) setEditDoc(null);
      }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Editar documento</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-md border bg-secondary/30 px-3 py-2 text-sm font-medium">{editDoc?.file_name}</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">Tipo</Label>
                <Select value={editForm.document_category} onValueChange={(value) => setEditForm((prev) => ({ ...prev, document_category: value as StartupDocumentCategory }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DOCUMENT_CATEGORIES.map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Visibilidade</Label>
                <Select value={editForm.visibility} onValueChange={(value) => setEditForm((prev) => ({ ...prev, visibility: value as StartupDocumentVisibility }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="internal_only">Interno</SelectItem>
                    <SelectItem value="startup_and_internal">Startup + interno</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Descrição curta</Label>
              <Textarea rows={2} value={editForm.description} maxLength={240} onChange={(event) => setEditForm((prev) => ({ ...prev, description: event.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Associação opcional</Label>
              <AssociationSelect
                value={editForm.relatedKey}
                groupedOptions={groupedAssociationOptions}
                onChange={(value) => setEditForm((prev) => ({ ...prev, relatedKey: value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDoc(null)}>Cancelar</Button>
            <Button onClick={handleSaveEdit} disabled={savingEdit}>
              {savingEdit ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function AssociationSelect({
  value,
  groupedOptions,
  onChange,
}: {
  value: string;
  groupedOptions: Record<string, AssociationOption[]>;
  onChange: (value: string) => void;
}) {
  const groupNames = Object.keys(groupedOptions);

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="none">Sem associação</SelectItem>
        {groupNames.length > 0 && <SelectSeparator />}
        {groupNames.map((groupName) => (
          <SelectGroup key={groupName}>
            <SelectLabel>{groupName}</SelectLabel>
            {groupedOptions[groupName].map((option) => (
              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}
