import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, LogOut, Clock } from 'lucide-react';
import { motion } from 'framer-motion';

export default function WaitingApprovalPage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate('/login', { replace: true });
      return;
    }

    const checkStatus = async () => {
      setChecking(true);
      const { data } = await supabase
        .from('profiles')
        .select('status')
        .eq('id', user.id)
        .single();

      if (data?.status === 'approved') {
        navigate('/app/dashboard', { replace: true });
      } else if (data?.status === 'rejected') {
        await signOut();
        navigate('/login?error=rejected', { replace: true });
      }
      setChecking(false);
    };

    checkStatus();
    const interval = setInterval(checkStatus, 30000);
    return () => clearInterval(interval);
  }, [user, navigate, signOut]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <Card className="border-0 shadow-lg">
          <CardContent className="pt-8 pb-8 text-center space-y-6">
            <div className="flex justify-center">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Clock className="h-8 w-8 text-primary" />
              </div>
            </div>

            <div className="space-y-2">
              <h1 className="text-xl font-bold">Cadastro em análise</h1>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Seu acesso está aguardando aprovação do administrador.
                Você receberá um email quando sua conta for liberada.
              </p>
            </div>

            {user?.email && (
              <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg py-2 px-4 inline-block">
                {user.email}
              </p>
            )}

            {checking && (
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Verificando status...
              </div>
            )}

            <Button variant="outline" onClick={handleSignOut} className="gap-2">
              <LogOut className="h-4 w-4" />
              Sair
            </Button>

            <p className="text-[10px] text-muted-foreground/50">
              Status verificado automaticamente a cada 30 segundos
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
