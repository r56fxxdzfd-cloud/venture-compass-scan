import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Users } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import type { AppRole } from '@/types/darwin';

interface UserWithRole {
  id: string;
  full_name: string | null;
  created_at: string;
  role: AppRole | null;
  user_id: string;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const { toast } = useToast();

  const fetchUsers = async () => {
    const { data: profiles } = await supabase.from('profiles').select('*');
    const { data: roles } = await supabase.from('user_roles').select('*');

    if (profiles) {
      const mapped = profiles.map((p: any) => {
        const userRole = roles?.find((r: any) => r.user_id === p.id);
        return {
          id: p.id,
          full_name: p.full_name,
          created_at: p.created_at,
          role: userRole?.role || null,
          user_id: p.id,
        };
      });
      setUsers(mapped);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleRoleChange = async (userId: string, newRole: AppRole) => {
    // Upsert role
    const existing = users.find((u) => u.id === userId);

    if (existing?.role) {
      // Delete old role first
      await supabase.from('user_roles').delete().eq('user_id', userId);
    }

    const { error } = await supabase.from('user_roles').insert({
      user_id: userId,
      role: newRole,
    });

    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Role atualizada' });
      fetchUsers();
    }
  };

  const roleLabels: Record<AppRole, string> = {
    jv_admin: 'Admin',
    jv_analyst: 'Analista',
    jv_viewer: 'Visualizador',
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Users className="h-6 w-6" /> Usuários
        </h1>
        <p className="text-sm text-muted-foreground">Gerenciar acessos e roles da equipe JV</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          {users.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum usuário encontrado</p>
          ) : (
            <div className="space-y-3">
              {users.map((u) => (
                <div key={u.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <p className="text-sm font-medium">{u.full_name || 'Sem nome'}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(u.created_at).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div>
                          <Select
                            value={u.role || ''}
                            onValueChange={(val) => handleRoleChange(u.id, val as AppRole)}
                          >
                            <SelectTrigger className="w-40">
                              <SelectValue placeholder="Sem role" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="jv_admin">Admin</SelectItem>
                              <SelectItem value="jv_analyst">Analista</SelectItem>
                              <SelectItem value="jv_viewer">Visualizador</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>Alterar nível de acesso do usuário</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
