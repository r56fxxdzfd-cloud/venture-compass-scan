import { Fragment } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Check, X, Minus } from 'lucide-react';

type Level = 'full' | 'partial' | 'none';

const roles = [
  { key: 'super_admin', label: 'Super Admin', desc: 'Victor — controle total' },
  { key: 'jv_admin', label: 'JV Admin', desc: 'Operação ampla, sem alterar metodologia' },
  { key: 'jv_analyst', label: 'Membro do Comitê', desc: 'jv_analyst / jv_advisor — operação' },
  { key: 'demo_admin', label: 'Demo Admin', desc: 'Escreve apenas em dados demo' },
  { key: 'demo_user', label: 'Demo', desc: 'Somente leitura em dados demo' },
  { key: 'user', label: 'User', desc: 'Reservado para uso futuro' },
] as const;

type RoleKey = typeof roles[number]['key'];

const capabilities: { group: string; items: { label: string; perms: Record<RoleKey, Level | string> }[] }[] = [
  {
    group: 'Startups & Diagnósticos',
    items: [
      { label: 'Ver startups reais', perms: { super_admin: 'full', jv_admin: 'full', jv_analyst: 'full', demo_admin: 'none', demo_user: 'none', user: 'none' } },
      { label: 'Ver startups demo', perms: { super_admin: 'full', jv_admin: 'full', jv_analyst: 'full', demo_admin: 'full', demo_user: 'full', user: 'none' } },
      { label: 'Criar / editar startups reais', perms: { super_admin: 'full', jv_admin: 'full', jv_analyst: 'full', demo_admin: 'none', demo_user: 'none', user: 'none' } },
      { label: 'Criar / editar startups demo', perms: { super_admin: 'full', jv_admin: 'full', jv_analyst: 'full', demo_admin: 'full', demo_user: 'none', user: 'none' } },
      { label: 'Arquivar / excluir startup', perms: { super_admin: 'full', jv_admin: 'none', jv_analyst: 'none', demo_admin: 'none', demo_user: 'none', user: 'none' } },
      { label: 'Rodar / editar diagnósticos', perms: { super_admin: 'full', jv_admin: 'full', jv_analyst: 'full', demo_admin: 'partial', demo_user: 'none', user: 'none' } },
    ],
  },
  {
    group: 'Central do Conselheiro & Agenda',
    items: [
      { label: 'Ver reuniões e ações', perms: { super_admin: 'full', jv_admin: 'full', jv_analyst: 'full', demo_admin: 'partial', demo_user: 'partial', user: 'none' } },
      { label: 'Criar / editar reuniões', perms: { super_admin: 'full', jv_admin: 'full', jv_analyst: 'full', demo_admin: 'partial', demo_user: 'none', user: 'none' } },
      { label: 'Registrar ações e progresso', perms: { super_admin: 'full', jv_admin: 'full', jv_analyst: 'full', demo_admin: 'partial', demo_user: 'none', user: 'none' } },
    ],
  },
  {
    group: 'Relatórios & Exportações',
    items: [
      { label: 'Ver relatórios (real + demo)', perms: { super_admin: 'full', jv_admin: 'full', jv_analyst: 'full', demo_admin: 'partial', demo_user: 'partial', user: 'none' } },
      { label: 'Exportar PPT / Word', perms: { super_admin: 'full', jv_admin: 'full', jv_analyst: 'full', demo_admin: 'full', demo_user: 'full', user: 'none' } },
    ],
  },
  {
    group: 'Metodologia & Parâmetros sensíveis',
    items: [
      { label: 'Ver metodologia / configuração', perms: { super_admin: 'full', jv_admin: 'full', jv_analyst: 'full', demo_admin: 'full', demo_user: 'full', user: 'none' } },
      { label: 'Editar pesos, perguntas, red flags', perms: { super_admin: 'full', jv_admin: 'none', jv_analyst: 'none', demo_admin: 'none', demo_user: 'none', user: 'none' } },
      { label: 'Publicar versão de configuração', perms: { super_admin: 'full', jv_admin: 'none', jv_analyst: 'none', demo_admin: 'none', demo_user: 'none', user: 'none' } },
    ],
  },
  {
    group: 'Administração de usuários',
    items: [
      { label: 'Aprovar / rejeitar cadastros', perms: { super_admin: 'full', jv_admin: 'none', jv_analyst: 'none', demo_admin: 'none', demo_user: 'none', user: 'none' } },
      { label: 'Atribuir papéis (roles)', perms: { super_admin: 'full', jv_admin: 'none', jv_analyst: 'none', demo_admin: 'none', demo_user: 'none', user: 'none' } },
      { label: 'Atribuir advisor a empresas', perms: { super_admin: 'full', jv_admin: 'none', jv_analyst: 'none', demo_admin: 'none', demo_user: 'none', user: 'none' } },
    ],
  },
];

function Cell({ level }: { level: Level | string }) {
  if (level === 'full') return <Check className="h-4 w-4 text-emerald-500 mx-auto" aria-label="Total" />;
  if (level === 'partial') return <Minus className="h-4 w-4 text-amber-500 mx-auto" aria-label="Parcial / somente demo" />;
  if (level === 'none') return <X className="h-4 w-4 text-muted-foreground/50 mx-auto" aria-label="Sem acesso" />;
  return <span className="text-xs text-muted-foreground">{level}</span>;
}

export function PermissionsMatrix() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Matriz de permissões por papel</CardTitle>
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground pt-2">
          <span className="inline-flex items-center gap-1"><Check className="h-3.5 w-3.5 text-emerald-500" /> Acesso total</span>
          <span className="inline-flex items-center gap-1"><Minus className="h-3.5 w-3.5 text-amber-500" /> Parcial / limitado ao demo</span>
          <span className="inline-flex items-center gap-1"><X className="h-3.5 w-3.5 text-muted-foreground/50" /> Sem acesso</span>
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[240px]">Capacidade</TableHead>
              {roles.map((r) => (
                <TableHead key={r.key} className="text-center min-w-[120px]">
                  <div className="font-semibold text-foreground">{r.label}</div>
                  <div className="text-[10px] font-normal text-muted-foreground leading-tight mt-0.5">{r.desc}</div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {capabilities.map((group) => (
              <Fragment key={group.group}>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableCell colSpan={roles.length + 1} className="font-semibold text-xs uppercase tracking-wide text-muted-foreground py-2">
                    {group.group}
                  </TableCell>
                </TableRow>
                {group.items.map((item) => (
                  <TableRow key={item.label}>
                    <TableCell className="text-sm">{item.label}</TableCell>
                    {roles.map((r) => (
                      <TableCell key={r.key} className="text-center">
                        <Cell level={item.perms[r.key]} />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </Fragment>
            ))}
          </TableBody>
        </Table>
        <p className="text-xs text-muted-foreground mt-4 leading-relaxed">
          Regras aplicadas via RLS no backend: <strong>demo_user</strong> e <strong>demo_admin</strong> só enxergam empresas com <code>is_demo = true</code>.
          Apenas o <strong>Super Admin</strong> altera metodologia, aprova usuários e arquiva/exclui dados.
        </p>
      </CardContent>
    </Card>
  );
}
