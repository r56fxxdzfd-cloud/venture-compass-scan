import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle2, Loader2, AlertTriangle, Building2 } from 'lucide-react';
import type { IntakePayload } from '@/types/darwin';

type Phase = 'loading' | 'invalid' | 'form' | 'submitting' | 'done';

const EMPTY: IntakePayload = {
  company_name: '', legal_name: '', cnpj: '', sector: '',
  founders: '', stage: '', business_model: '', contact: '',
  runway_months: '', burn_monthly: '', headcount: '', metrics: '', notes: '',
};

const REQUIRED: (keyof IntakePayload)[] = ['company_name', 'founders', 'stage', 'business_model', 'contact'];
const STEPS = 3;

export default function IntakePage() {
  const { token } = useParams();
  const storageKey = `intake:${token}`;
  const [phase, setPhase] = useState<Phase>('loading');
  const [invalidReason, setInvalidReason] = useState<string>('');
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<IntakePayload>(EMPTY);
  const [error, setError] = useState('');

  // Carrega rascunho local (autosave)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) setForm({ ...EMPTY, ...JSON.parse(saved) });
    } catch { /* ignore */ }
  }, [storageKey]);

  // Autosave
  useEffect(() => {
    if (phase === 'form') {
      try { localStorage.setItem(storageKey, JSON.stringify(form)); } catch { /* ignore */ }
    }
  }, [form, phase, storageKey]);

  // Valida o token na montagem
  useEffect(() => {
    let active = true;
    const validate = async () => {
      if (!token) { setPhase('invalid'); setInvalidReason('Link inválido.'); return; }
      const { data, error: fnError } = await supabase.functions.invoke('intake-validate', { body: { token } });
      if (!active) return;
      if (fnError || !data) { setPhase('invalid'); setInvalidReason('Não foi possível validar este link.'); return; }
      if (data.valid) { setPhase('form'); return; }
      setPhase('invalid');
      setInvalidReason(
        data.status === 'expired' ? 'Este link expirou.'
        : data.status === 'submitted' ? 'Este formulário já foi enviado. Obrigado!'
        : data.status === 'imported' ? 'Este formulário já foi processado. Obrigado!'
        : 'Link inválido ou não encontrado.',
      );
    };
    validate();
    return () => { active = false; };
  }, [token]);

  const set = (k: keyof IntakePayload, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const stepValid = (s: number): boolean => {
    if (s === 0) return !!form.company_name?.trim();
    if (s === 1) return !!form.founders?.trim() && !!form.stage?.trim() && !!form.business_model?.trim() && !!form.contact?.trim();
    return true;
  };
  const allValid = REQUIRED.every((k) => !!form[k]?.toString().trim());

  const handleSubmit = async () => {
    setError('');
    if (!allValid) { setError('Preencha os campos obrigatórios.'); return; }
    setPhase('submitting');
    const { data, error: fnError } = await supabase.functions.invoke('intake-submit', { body: { token, payload: form } });
    if (fnError || !data?.ok) {
      setPhase('form');
      setError(data?.error || 'Não foi possível enviar. Tente novamente.');
      return;
    }
    try { localStorage.removeItem(storageKey); } catch { /* ignore */ }
    setPhase('done');
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-xl">
        <div className="mb-6 flex items-center gap-2 justify-center text-muted-foreground">
          <Building2 className="h-5 w-5" />
          <span className="text-sm font-semibold tracking-wide">Conselho OS — Cadastro inicial</span>
        </div>

        {phase === 'loading' && (
          <Card><CardContent className="flex items-center gap-3 py-10 justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /> Validando link...
          </CardContent></Card>
        )}

        {phase === 'invalid' && (
          <Card>
            <CardContent className="py-10 text-center space-y-3">
              <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto" />
              <p className="text-sm text-muted-foreground">{invalidReason}</p>
            </CardContent>
          </Card>
        )}

        {phase === 'done' && (
          <Card>
            <CardContent className="py-10 text-center space-y-3">
              <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto" />
              <h2 className="text-lg font-semibold">Recebemos suas informações!</h2>
              <p className="text-sm text-muted-foreground">
                Obrigado. A equipe do conselho vai revisar e dar os próximos passos. Você já pode fechar esta página.
              </p>
            </CardContent>
          </Card>
        )}

        {(phase === 'form' || phase === 'submitting') && (
          <Card>
            <CardHeader className="space-y-3">
              <CardTitle className="text-lg">
                {step === 0 ? 'Sobre a empresa' : step === 1 ? 'Negócio e contato' : 'Dados complementares (opcional)'}
              </CardTitle>
              <Progress value={((step + 1) / STEPS) * 100} className="h-1.5" />
              <p className="text-xs text-muted-foreground">Passo {step + 1} de {STEPS}</p>
            </CardHeader>
            <CardContent className="space-y-4">
              {step === 0 && (
                <>
                  <Field label="Nome da empresa" required value={form.company_name || ''} onChange={(v) => set('company_name', v)} />
                  <Field label="Razão social" value={form.legal_name || ''} onChange={(v) => set('legal_name', v)} />
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="CNPJ" value={form.cnpj || ''} onChange={(v) => set('cnpj', v)} />
                    <Field label="Setor" value={form.sector || ''} onChange={(v) => set('sector', v)} />
                  </div>
                </>
              )}

              {step === 1 && (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Fundadores <span className="text-destructive">*</span></Label>
                    <Textarea rows={2} value={form.founders || ''} placeholder="Nomes e papéis dos fundadores" onChange={(e) => set('founders', e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Estágio <span className="text-destructive">*</span></Label>
                    <Select value={form.stage || ''} onValueChange={(v) => set('stage', v)}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pre_seed">Pre-Seed</SelectItem>
                        <SelectItem value="seed">Seed</SelectItem>
                        <SelectItem value="series_a">Series A</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Modelo de negócio <span className="text-destructive">*</span></Label>
                    <Textarea rows={2} value={form.business_model || ''} placeholder="Como a empresa gera valor e receita" onChange={(e) => set('business_model', e.target.value)} />
                  </div>
                  <Field label="Contato (e-mail ou telefone)" required value={form.contact || ''} onChange={(v) => set('contact', v)} />
                </>
              )}

              {step === 2 && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Runway (meses)" value={form.runway_months || ''} onChange={(v) => set('runway_months', v)} />
                    <Field label="Burn mensal (R$)" value={form.burn_monthly || ''} onChange={(v) => set('burn_monthly', v)} />
                  </div>
                  <Field label="Headcount" value={form.headcount || ''} onChange={(v) => set('headcount', v)} />
                  <div className="space-y-1.5">
                    <Label className="text-xs">Métricas principais</Label>
                    <Textarea rows={2} value={form.metrics || ''} placeholder="MRR, churn, CAC, etc. (opcional)" onChange={(e) => set('metrics', e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Observações</Label>
                    <Textarea rows={2} value={form.notes || ''} placeholder="Algo mais que devemos saber? (opcional)" onChange={(e) => set('notes', e.target.value)} />
                  </div>
                </>
              )}

              {error && <p className="text-xs text-destructive">{error}</p>}

              <div className="flex items-center justify-between pt-2">
                <Button variant="outline" disabled={step === 0 || phase === 'submitting'} onClick={() => setStep((s) => Math.max(0, s - 1))}>
                  Voltar
                </Button>
                {step < STEPS - 1 ? (
                  <Button disabled={!stepValid(step)} onClick={() => setStep((s) => s + 1)}>Continuar</Button>
                ) : (
                  <Button disabled={!allValid || phase === 'submitting'} onClick={handleSubmit}>
                    {phase === 'submitting' ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Enviando...</> : 'Enviar'}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <p className="mt-4 text-center text-[11px] text-muted-foreground/60">
          Seus dados são usados apenas para a avaliação do conselho.
        </p>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, required }: { label: string; value: string; onChange: (v: string) => void; required?: boolean }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label} {required && <span className="text-destructive">*</span>}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
