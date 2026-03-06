import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Users, CheckCircle, XCircle, Clock, Shield, MailWarning } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import type { AppRole } from '@/types/darwin';

interface UserWithRole {
  id: string;
  full_name: string | null;
  created_at: string;
  status: string;
  requested_at: string | null;
  approved_at: string | null;
  role: AppRole | null;
  email_confirmed: boolean;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [approveModal, setApproveModal] = useState<{ open: boolean; userId: string; name: string }>({ open: false, userId: '', name: '' });
  const [selectedRole, setSelectedRole] = useState<AppRole>('jv_viewer');
  const { toast } = useToast();
  const { user: currentUser, isSuperAdmin } = useAuth();

  const fetchUsers = async () => {
    const [{ data: profiles }, { data: roles }, { data: unconfirmed }] = await Promise.all([
      supabase.from('profiles').select('*'),
      supabase.from('user_roles').select('*'),
      supabase.rpc('get_unconfirmed_user_ids'),
    ]);

    const unconfirmedSet = new Set((unconfirmed || []).map((u: any) => u.user_id));

    if (profiles) {
      const mapped = profiles.map((p: any) => {
        const userRoles = roles?.filter((r: any) => r.user_id === p.id) || [];
        const bestRole = userRoles.find((r: any) => r.role === 'super_admin') || userRoles[0];
        return {
          id: p.id,
          full_name: p.full_name,
          created_at: p.created_at,
          status: p.status || 'pending',
          requested_at: p.requested_at,
          approved_at: p.approved_at,
          role: (bestRole?.role as AppRole) || null,
          email_confirmed: !unconfirmedSet.has(p.id),
        };
      });
      setUsers(mapped);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const pendingUsers = users.filter(u => u.status === 'pending');
  const activeUsers = users.filter(u => u.status === 'approved');
  const rejectedUsers = users.filter(u => u.status === 'rejected');

  const handleApprove = async () => {
    if (!currentUser) return;

    // First update profile status
    const { error: profileError } = await supabase.from('profiles').update({
      status: 'approved',
      approved_at: new Date().toISOString(),
      approved_by: currentUser.id,
    }).eq('id', approveModal.userId);

    if (profileError) {
      toast({ title: 'Erro', description: profileError.message, variant: 'destructive' });
      return;
    }

    // Then set user role
    await supabase.from('user_roles').delete().eq('user_id', approveModal.userId);
    const { error: roleError } = await supabase.from('user_roles').insert({
      user_id: approveModal.userId,
      role: selectedRole,
    });

    if (roleError) {
      toast({ title: 'Erro ao definir role', description: roleError.message, variant: 'destructive' });
    } else {
      toast({ title: 'Usuário aprovado', description: `Acesso liberado como ${roleLabels[selectedRole]}.` });
    }

    setApproveModal({ open: false, userId: '', name: '' });
    setSelectedRole('jv_viewer');
    fetchUsers();
  };

  const handleReject = async (userId: string) => {
    const { error } = await supabase.from('profiles').update({
      status: 'rejected',
    }).eq('id', userId);

    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Usuário rejeitado' });
      fetchUsers();
    }
  };

  const handleRoleChange = async (userId: string, newRole: AppRole) => {
    // Don't allow changing super_admin's own role
    if (userId === currentUser?.id) {
      toast({ title: 'Ação não permitida', description: 'Você não pode alterar sua própria role.', variant: 'destructive' });
      return;
    }

    await supabase.from('user_roles').delete().eq('user_id', userId);
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

  const handleSuspend = async (userId: string) => {
    if (userId === currentUser?.id) {
      toast({ title: 'Ação não permitida', description: 'Você não pode suspender a si mesmo.', variant: 'destructive' });
      return;
    }
    // Check if target is super_admin
    const targetUser = users.find(u => u.id === userId);
    if (targetUser?.role === 'super_admin') {
      toast({ title: 'Ação não permitida', description: 'Não é possível suspender o Super Admin.', variant: 'destructive' });
      return;
    }

    const { error } = await supabase.from('profiles').update({ status: 'rejected' }).eq('id', userId);
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Usuário suspenso' });
      fetchUsers();
    }
  };

  const roleLabels: Record<AppRole, string> = {
    super_admin: 'Super Admin',
    jv_admin: 'Admin',
    jv_analyst: 'Analista',
    jv_viewer: 'Visualizador',
  };

  const statusBadge = (status: string) => {
    if (status === 'approved') return <Badge variant="default" className="text-xs gap-1"><CheckCircle className="h-3 w-3" /> Ativo</Badge>;
    if (status === 'rejected') return <Badge variant="destructive" className="text-xs gap-1"><XCircle className="h-3 w-3" /> Rejeitado</Badge>;
    return <Badge variant="secondary" className="text-xs gap-1"><Clock className="h-3 w-3" /> Pendente</Badge>;
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Users className="h-6 w-6" /> Usuários
        </h1>
        <p className="text-sm text-muted-foreground">Gerenciar acessos e aprovações da equipe JV</p>
      </div>

      <Tabs defaultValue={pendingUsers.length > 0 ? 'pending' : 'active'}>
        <TabsList>
          <TabsTrigger value="pending" className="gap-1.5">
            Aguardando aprovação
            {pendingUsers.length > 0 && (
              <span className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-xs font-bold">
                {pendingUsers.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="active">Usuários ativos ({activeUsers.length})</TabsTrigger>
          {rejectedUsers.length > 0 && (
            <TabsTrigger value="rejected">Rejeitados ({rejectedUsers.length})</TabsTrigger>
          )}
        </TabsList>

        {/* Pending Tab */}
        <TabsContent value="pending">
          <Card>
            <CardContent className="pt-6">
              {pendingUsers.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhum cadastro pendente</p>
              ) : (
                <div className="space-y-3">
                  {pendingUsers.map((u) => (
                    <div key={u.id} className="flex items-center justify-between p-4 rounded-lg border bg-secondary/20">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">{u.full_name || 'Sem nome'}</p>
                          {!u.email_confirmed && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Badge variant="outline" className="text-xs gap-1 border-amber-500/50 text-amber-600">
                                    <MailWarning className="h-3 w-3" /> E-mail não confirmado
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent>O usuário ainda não clicou no link de confirmação enviado por e-mail</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Solicitado em {u.requested_at ? new Date(u.requested_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          onClick={() => setApproveModal({ open: true, userId: u.id, name: u.full_name || 'Usuário' })}
                          className="gap-1"
                        >
                          <CheckCircle className="h-3.5 w-3.5" /> Aprovar
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleReject(u.id)}
                          className="gap-1"
                        >
                          <XCircle className="h-3.5 w-3.5" /> Rejeitar
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Active Tab */}
        <TabsContent value="active">
          <Card>
            <CardContent className="pt-6">
              {activeUsers.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhum usuário ativo</p>
              ) : (
                <div className="space-y-3">
                  {activeUsers.map((u) => (
                    <div key={u.id} className="flex items-center justify-between p-3 rounded-lg border">
                      <div className="flex items-center gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium">{u.full_name || 'Sem nome'}</p>
                            {u.role === 'super_admin' && (
                              <Badge variant="outline" className="text-xs gap-1 border-primary/30">
                                <Shield className="h-3 w-3" /> Super Admin
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {u.approved_at ? `Aprovado em ${new Date(u.approved_at).toLocaleDateString('pt-BR')}` : new Date(u.created_at).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {u.role !== 'super_admin' && isSuperAdmin ? (
                          <>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div>
                                    <Select
                                      value={u.role || ''}
                                      onValueChange={(val) => handleRoleChange(u.id, val as AppRole)}
                                    >
                                      <SelectTrigger className="w-36">
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
                                <TooltipContent>Alterar nível de acesso</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            <Button size="sm" variant="outline" className="text-destructive" onClick={() => handleSuspend(u.id)}>
                              Suspender
                            </Button>
                          </>
                        ) : (
                          <Badge variant="outline" className="text-xs">
                            {u.role ? roleLabels[u.role] : 'Sem role'}
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Rejected Tab */}
        <TabsContent value="rejected">
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-3">
                {rejectedUsers.map((u) => (
                  <div key={u.id} className="flex items-center justify-between p-3 rounded-lg border opacity-60">
                    <div>
                      <p className="text-sm font-medium">{u.full_name || 'Sem nome'}</p>
                      <p className="text-xs text-muted-foreground">
                        Solicitado em {u.requested_at ? new Date(u.requested_at).toLocaleDateString('pt-BR') : 'N/A'}
                      </p>
                    </div>
                    {statusBadge('rejected')}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Approve Modal */}
      <Dialog open={approveModal.open} onOpenChange={(open) => setApproveModal(prev => ({ ...prev, open }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aprovar {approveModal.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Selecione o nível de acesso para este usuário:
            </p>
            <Select value={selectedRole} onValueChange={(val) => setSelectedRole(val as AppRole)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="jv_viewer">
                  <div>
                    <p className="font-medium">Visualizador</p>
                    <p className="text-xs text-muted-foreground">Pode visualizar relatórios e dashboards</p>
                  </div>
                </SelectItem>
                <SelectItem value="jv_analyst">
                  <div>
                    <p className="font-medium">Analista</p>
                    <p className="text-xs text-muted-foreground">Pode criar e editar diagnósticos</p>
                  </div>
                </SelectItem>
                <SelectItem value="jv_admin">
                  <div>
                    <p className="font-medium">Admin</p>
                    <p className="text-xs text-muted-foreground">Acesso total ao sistema e configurações</p>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveModal({ open: false, userId: '', name: '' })}>
              Cancelar
            </Button>
            <Button onClick={handleApprove} className="gap-1">
              <CheckCircle className="h-4 w-4" /> Aprovar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
