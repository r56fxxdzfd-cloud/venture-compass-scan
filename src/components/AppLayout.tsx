import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTheme } from 'next-themes';
import { useAuth } from '@/contexts/AuthContext';
import {
  LayoutDashboard, Building2, SlidersHorizontal, BookOpen,
  Settings, Users, LogOut, Menu, Moon, Sun } from
'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AppBreadcrumbs } from '@/components/AppBreadcrumbs';

const navItems = [
{ label: 'Dashboard', icon: LayoutDashboard, href: '/app/dashboard' },
{ label: 'Startups', icon: Building2, href: '/app/startups' },
{ label: 'Simulador', icon: SlidersHorizontal, href: '/app/simulator' },
{ label: 'Metodologia', icon: BookOpen, href: '/app/methodology' }];


const adminItems = [
{ label: 'Configuração', icon: Settings, href: '/app/admin/config' },
{ label: 'Usuários', icon: Users, href: '/app/admin/users' }];


export function AppLayout({ children }: {children: React.ReactNode;}) {
  const { profile, signOut, isAdmin } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { theme, setTheme } = useTheme();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside
        data-print-hide="true"
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 bg-sidebar text-sidebar-foreground flex flex-col transition-transform duration-300 lg:relative lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}>

        {/* Logo */}
        <div className="flex h-16 items-center gap-3 px-6 border-b border-sidebar-border">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary">
            <span className="text-sm font-bold text-sidebar-primary-foreground">ST
            </span>
          </div>
          <div>
            <p className="text-sm font-bold tracking-tight">CMJ/ Darwin</p>
            <p className="text-[10px] text-sidebar-muted">Startup Readiness</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {navItems.map((item) => <Link
            key={item.href}
            to={item.href}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
              location.pathname.startsWith(item.href) ?
              'bg-sidebar-accent text-sidebar-primary' :
              'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
            )}
            onClick={() => setSidebarOpen(false)}>

              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          )}

          {isAdmin &&
          <>
              <div className="pt-4 pb-2 px-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-sidebar-muted">
                  Admin
                </p>
              </div>
              {adminItems.map((item) =>
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                location.pathname.startsWith(item.href) ?
                'bg-sidebar-accent text-sidebar-primary' :
                'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
              )}
              onClick={() => setSidebarOpen(false)}>

                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
            )}
            </>
          }
        </nav>

        {/* Footer */}
        <div className="border-t border-sidebar-border p-4 space-y-3">
          <p className="text-[9px] text-sidebar-muted text-center tracking-wide">v1.0.0 — CMJ/Darwin</p>
          <TooltipProvider>
            <div className="flex items-center justify-between">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-sidebar-foreground hover:text-sidebar-primary hover:bg-sidebar-accent"
                    onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
                    {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">{theme === 'dark' ? 'Mudar para modo claro' : 'Mudar para modo escuro'}</TooltipContent>
              </Tooltip>
              <div className="min-w-0 flex-1 px-2">
                <p className="truncate text-sm font-medium">{profile?.full_name || 'Usuário'}</p>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-sidebar-foreground hover:text-sidebar-primary hover:bg-sidebar-accent"
                    onClick={handleSignOut}>
                    <LogOut className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">Sair da conta</TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
        </div>
      </aside>

      {/* Overlay */}
      {sidebarOpen &&
      <div
        className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm lg:hidden"
        onClick={() => setSidebarOpen(false)} />

      }

      {/* Main */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header data-print-hide="true" className="flex h-14 items-center gap-4 border-b px-4 lg:px-6">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="lg:hidden"
                  onClick={() => setSidebarOpen(true)}>
                  <Menu className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Abrir menu lateral</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <AppBreadcrumbs />
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>);

}