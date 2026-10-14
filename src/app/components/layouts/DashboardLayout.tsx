import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import {
  BarChart3,
  Building2,
  Car,
  CreditCard,
  Handshake,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  UserPlus,
  Users,
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { useCompany } from '../../../contexts/CompanyContext';
import { ThemeToggle } from '../ThemeToggle';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import { cn } from '../ui/utils';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../ui/sheet';

const operationItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/dashboard/vehicles', icon: Car, label: 'Veículos' },
  { to: '/dashboard/leads', icon: UserPlus, label: 'Leads' },
  { to: '/dashboard/negotiations', icon: Handshake, label: 'Negociações' },
  { to: '/dashboard/payments', icon: CreditCard, label: 'Pagamentos' },
];

const managementItems = [
  { to: '/dashboard/reports', icon: BarChart3, label: 'Relatórios' },
  { to: '/dashboard/team', icon: Users, label: 'Equipe' },
  { to: '/dashboard/settings', icon: Settings, label: 'Configurações' },
];

const navClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'flex min-h-[38px] items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors duration-150 motion-reduce:transition-none',
    isActive
      ? 'bg-sidebar-accent text-sidebar-foreground'
      : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground',
  );

export function DashboardLayout() {
  const { user, profile, loading, signOut } = useAuth();
  const { company } = useCompany();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth/login', { replace: true });
    } else if (!loading && user && profile?.role === 'platform_admin' && location.pathname === '/dashboard') {
      navigate('/dashboard/platform', { replace: true });
    }
  }, [user, profile, loading, navigate, location.pathname]);

  if (loading) {
    return (
      <div className="flex min-h-screen flex-wrap bg-background">
        <aside className="w-full border-b border-sidebar-border bg-sidebar p-4 md:min-h-screen md:w-[232px] md:flex-none md:border-b-0 md:border-r">
          <Skeleton className="mb-8 h-10 w-40" />
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </aside>
        <main className="min-w-0 flex-1 p-5 md:p-8">
          <Skeleton className="mb-6 h-12 w-full max-w-xl" />
          <div className="grid gap-4 md:grid-cols-3">
            <Skeleton className="h-36" />
            <Skeleton className="h-36" />
            <Skeleton className="h-36" />
          </div>
        </main>
      </div>
    );
  }

  if (!user || !profile) return null;

  if (!profile.company_id && profile.role !== 'platform_admin') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-6">
        <section className="w-full max-w-lg space-y-4 rounded-2xl border border-border bg-card p-6 shadow-lux-md">
          <p className="text-sm font-medium text-primary">Conta autenticada · {profile.role}</p>
          <h1 className="text-2xl font-semibold text-foreground">Sua conta ainda não está vinculada a uma loja</h1>
          <p className="text-sm leading-6 text-muted-foreground">
            Olá, {profile.full_name}. O acesso ao painel será liberado assim que um administrador vincular sua conta à empresa.
          </p>
          <Button type="button" variant="outline" onClick={async () => { await signOut(); navigate('/auth/login', { replace: true }); }}>
            Sair da conta
          </Button>
        </section>
      </main>
    );
  }

  const isPlatformAdmin = profile.role === 'platform_admin';
  const sections = isPlatformAdmin
    ? [{ label: 'Plataforma', items: [{ to: '/dashboard/platform', icon: Building2, label: 'Empresas' }] }]
    : [
        { label: 'Operação', items: operationItems },
        { label: 'Gestão', items: profile.role === 'administrador' ? managementItems : [managementItems[0]] },
      ];

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth/login');
  };

  const initials = profile.full_name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  const renderBrand = () => (
    <div className="flex min-w-0 items-center gap-2.5 px-1.5">
      {isPlatformAdmin ? (
        <div className="flex size-[34px] shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground"><Building2 className="size-[18px]" aria-hidden="true" /></div>
      ) : company?.logo_url ? (
        <img src={company.logo_url} alt={`Logo ${company.name}`} className="size-[34px] shrink-0 rounded-lg object-contain" />
      ) : (
        <div className="flex size-[34px] shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground"><Car className="size-[18px]" aria-hidden="true" /></div>
      )}
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold leading-tight text-sidebar-foreground">{isPlatformAdmin ? 'LuxCar Plataforma' : (company?.name || 'LuxCar')}</p>
        {!isPlatformAdmin && <p className="text-xs text-sidebar-foreground/55">Centro da loja</p>}
      </div>
    </div>
  );

  const renderNavigation = () => (
    <nav aria-label="Navegação principal" className="flex-1 space-y-5">
      {sections.map((section) => (
        <section key={section.label}>
          <h2 className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-sidebar-foreground/45">{section.label}</h2>
          <div className="space-y-0.5">
            {section.items.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.to === '/dashboard'} onClick={() => setMobileMenuOpen(false)} className={navClass}>
                <item.icon className="size-[17px] shrink-0" aria-hidden="true" />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </div>
        </section>
      ))}
    </nav>
  );

  const renderAccountActions = () => (
    <div className="flex items-center gap-2 border-t border-sidebar-border pt-3">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-xs font-semibold text-sidebar-foreground" aria-hidden="true">{initials || 'U'}</div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium leading-tight text-sidebar-foreground">{profile.full_name}</p>
        <p className="truncate text-xs capitalize text-sidebar-foreground/55">{profile.role.replaceAll('_', ' ')}</p>
      </div>
      <ThemeToggle className="size-8 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground" />
      <button type="button" onClick={handleSignOut} aria-label="Sair da conta" title="Sair da conta" className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground">
        <LogOut className="size-4" aria-hidden="true" />
      </button>
    </div>
  );

  return (
    <div className="flex min-h-screen flex-wrap bg-background text-foreground">
      <header className="flex w-full items-center justify-between border-b border-sidebar-border bg-sidebar px-4 py-3 md:hidden">
        {renderBrand()}
        <Button type="button" variant="ghost" size="icon" aria-label="Abrir menu" onClick={() => setMobileMenuOpen(true)} className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground">
          <Menu className="size-5" aria-hidden="true" />
        </Button>
      </header>

      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" className="w-[min(86vw,320px)] border-sidebar-border bg-sidebar p-4 text-sidebar-foreground sm:max-w-[320px] md:hidden">
          <SheetHeader className="sr-only"><SheetTitle>Menu de navegação</SheetTitle></SheetHeader>
          {renderBrand()}
          {renderNavigation()}
          {renderAccountActions()}
        </SheetContent>
      </Sheet>

      <aside className="hidden w-[232px] flex-none flex-col gap-5 border-r border-sidebar-border bg-sidebar px-[14px] py-5 md:flex md:min-h-screen">
        {renderBrand()}
        {renderNavigation()}
        {renderAccountActions()}
      </aside>

      <main className="min-w-0 flex-[999_1_560px] p-4 sm:p-6 md:px-8 md:pb-12 md:pt-7">
        <Outlet />
      </main>
    </div>
  );
}
