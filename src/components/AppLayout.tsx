import { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTheme } from 'next-themes';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import {
  LayoutDashboard, Building2, SlidersHorizontal, BookOpen, CalendarRange,
  Settings, Users, LogOut, Menu, Moon, Sun, Scale } from
'lucide-react';
import logoDarwin from '@/assets/logo-darwin.png';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AppBreadcrumbs } from '@/components/AppBreadcrumbs';

const navItems = [
{ label: 'Dashboard', icon: LayoutDashboard, href: '/app/dashboard' },
{ label: 'Organizações', icon: Building2, href: '/app/startups' },
{ label: 'Central do Conselheiro', icon: Scale, href: '/app/counselor' },
{ label: 'Agenda de Evolução', icon: CalendarRange, href: '/app/agenda' },
{ label: 'Simulador', icon: SlidersHorizontal, href: '/app/simulator' },
{ label: 'Metodologia', icon: BookOpen, href: '/app/methodology' }];


const adminItems = [
{ label: 'Configuração', icon: Settings, href: '/app/admin/config' },
{ label: 'Usuários', icon: Users, href: '/app/admin/users' }];


export function AppLayout({ children }: {children: React.ReactNode;}) {
  const { profile, signOut, isAdmin, isSuperAdmin, isDemoUser, isDemoAdmin, isAdvisor } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  const mainRef = useRef<HTMLElement>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const isDemoMode = isDemoUser || isDemoAdmin;
  // Conselheiro (advisor) e modo demo não acessam ferramentas internas de metodologia/simulador.
  const hideInternalTools = isDemoMode || isAdvisor;
  const visibleNavItems = hideInternalTools ? navItems.filter((item) => !['/app/simulator', '/app/methodology'].includes(item.href)) : navItems;

  // Fetch pending approval count for super_admin
  useEffect(() => {
    if (!isSuperAdmin) return;
    const fetchPending = async () => {
      const { count } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');
      setPendingCount(count || 0);
    };
    fetchPending();
    const interval = setInterval(fetchPending, 60000);
    return () => clearInterval(interval);
  }, [isSuperAdmin]);

  // Scroll to top on route change
  useEffect(() => {
    mainRef.current?.scrollTo(0, 0);
  }, [location.pathname]);

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
          'fixed inset-y-0 left-0 z-50 w-72 border-r border-sidebar-border/70 bg-sidebar text-sidebar-foreground flex flex-col transition-transform duration-300 lg:relative lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}>

        {/* Logo */}
        <div className="flex h-16 items-center px-6 border-b border-sidebar-border/80 bg-sidebar-accent/30">
          <img src={logoDarwin} alt="Darwin Growth" className="h-9 w-auto object-contain" />
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {visibleNavItems.map((item) => <Link
            key={item.href}
            to={item.href}
            className={cn(
              'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all',
              location.pathname.startsWith(item.href) ?
              'bg-sidebar-primary/15 text-sidebar-primary shadow-sm ring-1 ring-sidebar-primary/30' :
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
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors relative',
                location.pathname.startsWith(item.href) ?
                'bg-sidebar-primary/15 text-sidebar-primary shadow-sm ring-1 ring-sidebar-primary/30' :
                'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
              )}
              onClick={() => setSidebarOpen(false)}>

                  <item.icon className="h-4 w-4" />
                  {item.label}
                  {item.href === '/app/admin/users' && pendingCount > 0 && (
                    <span className="absolute right-3 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold">
                      {pendingCount}
                    </span>
                  )}
                </Link>
            )}
            </>
          }
        </nav>

        {/* Footer */}
        <div className="border-t border-sidebar-border p-4 space-y-3">
          <p className="text-[9px] text-sidebar-muted text-center tracking-wide">v1.0.0 — Darwin</p>
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
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header data-print-hide="true" className="flex h-14 min-w-0 items-center gap-2 border-b bg-background/90 px-3 backdrop-blur-sm sm:gap-4 sm:px-4 lg:px-6">
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
          <div className="min-w-0 flex-1">
            <AppBreadcrumbs />
          </div>
        </header>

        {/* Content */}
        <main
          ref={mainRef}
          id="app-main-scroll"
          data-scroll-container="main"
          className="flex min-h-0 max-w-full flex-1 flex-col overflow-y-auto overflow-x-hidden bg-muted/20 p-3 sm:p-4 lg:p-6"
        >
          {isDemoMode && (
            <div className="mb-4 rounded-xl border border-amber-300/40 bg-amber-100/50 px-4 py-2 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
              Modo Demo — dados fictícios do Darwin Growth
            </div>
          )}
          <div className="flex-1 min-w-0 max-w-full">{children}</div>
          <div data-print-hide="true" className="flex flex-col items-center gap-3 pt-4 pb-3 select-none print:hidden">
            <img src={logoDarwin} alt="Darwin" className="h-5 object-contain dark:brightness-100 brightness-0 opacity-30" />
            <p className="text-[9px] text-muted-foreground/30 tracking-[0.15em] text-center font-medium uppercase">
              Developed and owned by Victor Levy. All rights reserved.
            </p>
          </div>
        </main>
      </div>
    </div>);

}
