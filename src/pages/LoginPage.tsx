import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { motion } from 'framer-motion';

export default function LoginPage() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isSignUp) {
        await signUp(email, password, fullName);
        toast({
          title: 'Conta criada',
          description: 'Verifique seu email para confirmar o cadastro.'
        });
      } else {
        await signIn(email, password);
        navigate('/app/dashboard');
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
      {/* Left side - branding */}
      <div
        className="hidden lg:flex lg:w-1/2 items-center justify-center p-12"
        style={{ background: 'var(--gradient-hero)' }}>

        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-md">

          <div className="flex items-center gap-3 mb-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent">
              <span className="text-lg font-black text-accent-foreground">ST
              </span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-primary-foreground">CMJ/ Darwin</h1>
              <p className="text-sm text-primary-foreground/60">Startup Readiness</p>
            </div>
          </div>
          <h2 className="text-3xl font-bold text-primary-foreground mb-4">
            Diagnóstico completo de prontidão para startups
          </h2>
          <p className="text-primary-foreground/70 leading-relaxed">
            9 dimensões, radar interativo, red flags automáticos e relatórios exportáveis.
            Tudo configurável pela sua equipe.
          </p>
        </motion.div>
      </div>

      {/* Right side - form */}
      <div className="flex flex-1 items-center justify-center p-6 bg-background">
        <motion.div initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="w-full max-w-sm">

          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
              <span className="text-sm font-black text-primary-foreground">D</span>
            </div>
            <div>
              <h1 className="text-xl font-bold">Darwin</h1>
              <p className="text-xs text-muted-foreground">Startup Readiness</p>
            </div>
          </div>

          <Card className="border-0 shadow-lg">
            <CardHeader className="space-y-1 pb-4">
              <h2 className="text-xl font-semibold">
                {isSignUp ? 'Criar conta' : 'Entrar'}
              </h2>
              <p className="text-sm text-muted-foreground">
                {isSignUp ?
                'Crie sua conta para acessar o sistema' :
                'Acesse com suas credenciais'}
              </p>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {isSignUp &&
                <div className="space-y-2">
                    <Label htmlFor="fullName">Nome completo</Label>
                    <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Seu nome"
                    required />

                  </div>
                }
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    required />

                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Senha</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6} />

                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Carregando...' : isSignUp ? 'Criar conta' : 'Entrar'}
                </Button>
              </form>

              <div className="mt-4 text-center">
                <button
                  type="button"
                  className="text-sm text-muted-foreground hover:text-primary transition-colors"
                  onClick={() => setIsSignUp(!isSignUp)}>

                  {isSignUp ?
                  'Já tem conta? Entrar' :
                  'Não tem conta? Cadastre-se'}
                </button>
              </div>
            </CardContent>
          </Card>

          <p className="mt-4 text-center text-xs text-muted-foreground">
            CMJ/Darwin — Acesso restrito à equipe JV
          </p>
        </motion.div>
      </div>
    </div>);

}