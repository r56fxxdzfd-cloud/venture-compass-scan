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

const STAGE_OPTIONS = ['Validação', 'Tração', 'Crescimento', 'Expansão', 'Consolidação'];
const STEPS = 3;

const EMPTY: IntakePayload = {
  full_name: '', company_name: '', role: '', email: '', whatsapp: '', birth_date: '',
  summary: '', stage_label: '', headcount: '', revenue_2025: '', revenue_goal_2026: '',
};

// ---- Máscaras (sem libs) ----
const maskPhone = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};
const maskDate = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
};
const maskBRL = (v: string) => {
  const d = v.replace(/\D/g, '');
  if (!d) return '';
  return 'R$ ' + parseInt(d, 10).toLocaleString('pt-BR');
};
const maskDigits = (v: string) => v.replace(/\D/g, '').slice(0, 7);
const emailOk = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());

export default function IntakePage() {
  const { token } = useParams();
  const storageKey = `intake:${token}`;
  const [phase, setPhase] = useState<Phase>('loading');
  const [invalidReason, setInvalidReason] = useState<string>('');
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<IntakePayload>(EMPTY);
  const [error, setError] = useState('');

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) setForm({ ...EMPTY, ...JSON.parse(saved) });
    } catch { /* ignore */ }
  }, [storageKey]);

  useEffect(() => {
    if (phase === 'form') {
      try { localStorage.setItem(storageKey, JSON.stringify(form)); } catch { /* ignore */ }
    }
  }, [form, phase, storageKey]);

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
    if (s === 0) return !!form.full_name?.trim() && emailOk(form.email || '');
    if (s === 1) return !!form.company_name?.trim() && !!form.summary?.trim() && !!form.stage_label?.trim();
    return true;
  };
  const allValid =
    !!form.full_name?.trim() && emailOk(form.email || '') &&
    !!form.company_name?.trim() && !!form.summary?.trim() && !!form.stage_label?.trim();

  const handleSubmit = async () => {
    setError('');
    if (!allValid) { setError('Preencha os campos obrigatórios (com e-mail válido).'); return; }
    setPhase('submitting');
    // Preenche também as chaves canônicas que a edge function publicada valida.
    const contact = [form.email, form.whatsapp].filter((x) => x && x.trim()).join(' · ');
    const payload: IntakePayload = {
      ...form,
      founders: form.full_name,
      business_model: form.summary,
      stage: form.stage_label,
      contact,
    };
    const { data, error: fnError } = await supabase.functions.invoke('intake-submit', { body: { token, payload } });
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
          <span className="text-sm font-semibold tracking-wide">Darwin Growth — Cadastro inicial</span>
        </div>

        {phase === 'loading' && (
          <Card><CardContent className="flex items-center gap-3 py-10 justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /> Validando link...
          </CardContent></Card>
        )}

        {phase === 'invalid' && (
          <Card><CardContent className="py-10 text-center space-y-3">
            <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto" />
            <p className="text-sm text-muted-foreground">{invalidReason}</p>
          </CardContent></Card>
        )}

        {phase === 'done' && (
          <Card><CardContent className="py-10 text-center space-y-3">
            <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto" />
            <h2 className="text-lg font-semibold">Recebemos suas informações!</h2>
            <p className="text-sm text-muted-foreground">
              Obrigado. A equipe da Darwin Growth vai revisar e dar os próximos passos. Você já pode fechar esta página.
            </p>
          </CardContent></Card>
        )}

        {(phase === 'form' || phase === 'submitting') && (
          <Card>
            <CardHeader className="space-y-3">
              <CardTitle className="text-lg">
                {step === 0 ? 'Sobre você' : step === 1 ? 'Sobre a empresa' : 'Números'}
              </CardTitle>
              <Progress value={((step + 1) / STEPS) * 100} className="h-1.5" />
              <p className="text-xs text-muted-foreground">Passo {step + 1} de {STEPS}</p>
            </CardHeader>
            <CardContent className="space-y-4">
              {step === 0 && (
                <>
                  <Field label="Nome completo" required value={form.full_name || ''} onChange={(v) => set('full_name', v)} />
                  <Field label="Cargo atual na empresa" value={form.role || ''} onChange={(v) => set('role', v)} />
                  <Field label="E-mail" required type="email" inputMode="email" value={form.email || ''} onChange={(v) => set('email', v)} />
                  <Field label="WhatsApp" inputMode="tel" placeholder="(11) 99999-9999" value={form.whatsapp || ''} onChange={(v) => set('whatsapp', maskPhone(v))} />
                  <Field label="Data de nascimento" inputMode="numeric" placeholder="DD/MM/AAAA" value={form.birth_date || ''} onChange={(v) => set('birth_date', maskDate(v))} />
                </>
              )}

              {step === 1 && (
                <>
                  <Field label="Nome da empresa" required value={form.company_name || ''} onChange={(v) => set('company_name', v)} />
                  <div className="space-y-1.5">
                    <Label className="text-xs">Resumo da empresa <span className="text-destructive">*</span></Label>
                    <Textarea rows={3} value={form.summary || ''} placeholder="O que ela faz, qual problema resolve e para quem gera valor" onChange={(e) => set('summary', e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Em qual estágio a empresa se encontra? <span className="text-destructive">*</span></Label>
                    <Select value={form.stage_label || ''} onValueChange={(v) => set('stage_label', v)}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {STAGE_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              {step === 2 && (
                <>
                  <Field label="Quantos colaboradores a empresa possui?" inputMode="numeric" value={form.headcount || ''} onChange={(v) => set('headcount', maskDigits(v))} />
                  <Field label="Faturamento 2025" inputMode="numeric" placeholder="R$ 0" value={form.revenue_2025 || ''} onChange={(v) => set('revenue_2025', maskBRL(v))} />
                  <Field label="Meta de faturamento 2026" inputMode="numeric" placeholder="R$ 0" value={form.revenue_goal_2026 || ''} onChange={(v) => set('revenue_goal_2026', maskBRL(v))} />
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
          Seus dados são usados apenas para a avaliação da Darwin Growth.
        </p>
      </div>
    </div>
  );
}

function Field({
  label, value, onChange, required, type = 'text', placeholder, inputMode,
}: {
  label: string; value: string; onChange: (v: string) => void; required?: boolean;
  type?: string; placeholder?: string; inputMode?: 'text' | 'email' | 'tel' | 'numeric';
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label} {required && <span className="text-destructive">*</span>}</Label>
      <Input type={type} inputMode={inputMode} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
