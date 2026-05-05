import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { motion } from 'framer-motion';
import { useTheme } from 'next-themes';
import { Moon, Sun, ArrowRight } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export default function LoginPage() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();

  const rejectedError = searchParams.get('error') === 'rejected';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isSignUp) {
        await signUp(email, password, fullName);
        toast({
          title: 'Cadastro realizado!',
          description: 'Aguarde a aprovação do administrador para acessar o sistema.',
        });
        navigate('/waiting-approval');
      } else {
        await signIn(email, password);
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('status')
            .eq('id', user.id)
            .single();

          if (profile?.status === 'pending') {
            navigate('/waiting-approval');
          } else if (profile?.status === 'rejected') {
            await supabase.auth.signOut();
            toast({ title: 'Acesso negado', description: 'Seu cadastro foi rejeitado.', variant: 'destructive' });
          } else {
            navigate('/app/dashboard');
          }
        }
      }
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Left side - premium branding */}
      <div
        className="hidden lg:flex lg:w-1/2 items-center justify-center p-16 relative overflow-hidden"
        style={{ background: 'var(--gradient-hero)' }}>
        
        {/* Aurora glow effects */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-[hsl(155_80%_50%/0.08)] blur-[120px] animate-glow-pulse" />
          <div className="absolute bottom-1/3 right-1/4 w-80 h-80 rounded-full bg-[hsl(263_85%_68%/0.06)] blur-[100px] animate-glow-pulse" style={{ animationDelay: '1.5s' }} />
        </div>

        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="max-w-lg relative z-10">
          
          <div className="flex items-center gap-4 mb-12">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[hsl(155_80%_50%)] to-[hsl(263_85%_68%)] shadow-lg">
              <span className="text-lg font-bold text-white font-heading">D</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white font-heading tracking-tight">Darwin</h1>
              <p className="text-sm text-white/50 tracking-wide">Startup Readiness</p>
            </div>
          </div>

          <h2 className="text-4xl font-bold text-white mb-6 font-heading leading-[1.1]">
            Diagnóstico completo de maturidade e plano de ação
          </h2>
          <p className="text-lg text-white/50 leading-relaxed mb-10">
            Conselhos coletivos para Startups — 9 dimensões, radar interativo, red flags automáticos e relatórios exportáveis.
          </p>

          {/* Feature pills */}
          <div className="flex flex-wrap gap-3">
            {['9 Dimensões', 'Radar Interativo', 'Red Flags', 'PDF Export'].map((f, i) => (
              <motion.span
                key={f}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + i * 0.1, duration: 0.4 }}
                className="inline-flex items-center rounded-full px-4 py-1.5 text-xs font-medium tracking-wide text-white/70 border border-white/10 bg-white/5 backdrop-blur-sm"
              >
                {f}
              </motion.span>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Right side - form */}
      <div className="flex flex-1 items-center justify-center p-8 bg-background relative">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-6 right-6 rounded-xl"
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                aria-label="Alternar tema"
              >
                {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{theme === 'dark' ? 'Mudar para modo claro' : 'Mudar para modo escuro'}</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="w-full max-w-[400px]">

          {/* Mobile branding */}
          <div className="lg:hidden flex items-center gap-3 mb-10 justify-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent shadow-md">
              <span className="text-sm font-bold text-white font-heading">D</span>
            </div>
            <div>
              <h1 className="text-xl font-bold font-heading">Darwin</h1>
              <p className="text-xs text-muted-foreground tracking-wide">Startup Readiness</p>
            </div>
          </div>

          {rejectedError && (
            <div className="mb-6 rounded-xl bg-destructive/10 border border-destructive/20 p-4 text-sm text-destructive">
              Seu cadastro foi rejeitado pelo administrador.
            </div>
          )}

          <Card className="border-0 shadow-xl bg-card/80 backdrop-blur-sm rounded-2xl">
            <CardHeader className="space-y-2 pb-2 pt-8 px-8">
              <h2 className="text-2xl font-semibold font-heading tracking-tight">
                {isSignUp ? 'Criar conta' : 'Entrar'}
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {isSignUp
                  ? 'Crie sua conta — acesso será liberado após aprovação'
                  : 'Acesse com suas credenciais'}
              </p>
            </CardHeader>
            <CardContent className="px-8 pb-8 pt-4">
              <form onSubmit={handleSubmit} className="space-y-5">
                {isSignUp && (
                  <div className="space-y-2">
                    <Label htmlFor="fullName" className="text-xs font-medium tracking-wide uppercase text-muted-foreground">Nome completo</Label>
                    <Input
                      id="fullName"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Seu nome"
                      required
                      className="h-12 rounded-xl border-border/60 bg-background/60 px-4 text-sm transition-all focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-xs font-medium tracking-wide uppercase text-muted-foreground">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    required
                    className="h-12 rounded-xl border-border/60 bg-background/60 px-4 text-sm transition-all focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-xs font-medium tracking-wide uppercase text-muted-foreground">Senha</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                    className="h-12 rounded-xl border-border/60 bg-background/60 px-4 text-sm transition-all focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full h-12 rounded-xl text-sm font-semibold tracking-wide shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all duration-300 gap-2"
                  disabled={loading}
                >
                  {loading ? 'Carregando...' : isSignUp ? 'Criar conta' : 'Entrar'}
                  {!loading && <ArrowRight className="h-4 w-4" />}
                </Button>
              </form>

              <div className="mt-6 text-center">
                <button
                  type="button"
                  className="text-sm text-muted-foreground hover:text-primary transition-colors duration-200"
                  onClick={() => setIsSignUp(!isSignUp)}
                >
                  {isSignUp ? 'Já tem conta? Entrar' : 'Não tem conta? Cadastre-se'}
                </button>
              </div>
            </CardContent>
          </Card>

          <p className="mt-6 text-center text-xs text-muted-foreground/60 tracking-wide">
            Acesso restrito à equipe JV
          </p>
        </motion.div>
      </div>
    </div>
  );
}
