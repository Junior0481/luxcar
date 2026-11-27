import { useCallback, useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import {
  BarChart3,
  AlertTriangle,
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
import {
  createRenewalCharge,
  getCompanySubscription,
  onSubscriptionChanged,
  rememberCheckoutBaseline,
  subscriptionNotice,
  type CompanySubscription,
  type SubscriptionNotice,
} from '../../../services/subscription.service';
import { getCompanyPlan } from '../../../services/plans.service';
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
  const [subscription, setSubscription] = useState<CompanySubscription | null>(null);
  const [notice, setNotice] = useState<SubscriptionNotice>(null);
  const [reportsEnabled, setReportsEnabled] = useState<boolean | null>(null);
  const [subscriptionVersion, setSubscriptionVersion] = useState(0);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState('');
  const hasCompany = Boolean(profile?.company_id) && profile?.role !== 'platform_admin';
  const returningFromCheckout = new URLSearchParams(location.search).get('pagamento') === 'confirmado';

  const loadSubscription = useCallback(async () => {
    const loaded = await getCompanySubscription();
    setSubscription(loaded);
    const next = subscriptionNotice(loaded);
    setNotice(next);
    return next;
  }, []);

  // Recarrega ao navegar e quando o painel de assinatura avisa que o pagamento foi confirmado.
  useEffect(() => onSubscriptionChanged(() => setSubscriptionVersion((version) => version + 1)), []);

  useEffect(() => {
    if (!hasCompany) { setSubscription(null); setNotice(null); return; }
    let active = true;
    loadSubscription().catch((error) => { if (active) console.error('Error loading subscription:', error); });
    return () => { active = false; };
  }, [hasCompany, profile?.company_id, location.pathname, subscriptionVersion, loadSubscription]);

  // Volta do checkout com a loja bloqueada: o painel de assinatura não aparece (a tela de bloqueio
  // ocupa tudo), então o próprio layout consulta até o webhook liberar o acesso.
  useEffect(() => {
    if (!hasCompany || !returningFromCheckout || notice?.kind !== 'blocked') return;
    let attempts = 0;
    let stopped = false;
    const timer = window.setInterval(async () => {
      attempts += 1;
      const next = await loadSubscription().catch(() => null);
      if (stopped) return;
      if (next?.kind !== 'blocked' || attempts >= 20) window.clearInterval(timer);
    }, 3000);
    return () => { stopped = true; window.clearInterval(timer); };
  }, [hasCompany, returningFromCheckout, notice?.kind, loadSubscription]);

  useEffect(() => {
    if (!user || !profile?.company_id) { setReportsEnabled(null); return; }
    let active = true;
    getCompanyPlan({ userId: user.id, companyId: profile.company_id, role: profile.role })
      .then((plan) => { if (active) setReportsEnabled(plan ? plan.reports_enabled : null); })
      .catch(() => { if (active) setReportsEnabled(null); });
    return () => { active = false; };
  }, [user?.id, profile?.company_id, profile?.role, subscription?.plan]);

  const payBlocked = async () => {
    setPaying(true);
    setPayError('');
    try {
      const charge = await createRenewalCharge();
      rememberCheckoutBaseline(subscription);
      window.location.href = charge.url;
    } catch (error) {
      setPayError(error instanceof Error ? error.message : 'Não foi possível gerar a cobrança.');
      setPaying(false);
    }
  };

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

  if (notice?.kind === 'blocked' || notice?.kind === 'suspended') {
    const suspended = notice.kind === 'suspended';
    const canPay = !suspended && profile.role === 'administrador';
    const signOutButton = (
      <Button type="button" variant="outline" onClick={async () => { await signOut(); navigate('/auth/login', { replace: true }); }}>
        Sair da conta
      </Button>
    );
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-6">
        <section role="alert" className="w-full max-w-lg space-y-4 rounded-2xl border border-destructive/30 bg-card p-6 shadow-lux-md">
          <p className="text-sm font-medium text-destructive">{suspended ? 'Loja suspensa' : 'Assinatura bloqueada'}</p>
          <h1 className="text-2xl font-semibold text-foreground">
            {suspended ? 'O acesso da loja foi suspenso pela equipe LuxCar' : 'O acesso da loja foi bloqueado por falta de pagamento'}
          </h1>
          <p className="text-sm leading-6 text-muted-foreground">
            {suspended
              ? 'Fale com a equipe LuxCar para entender o motivo e reativar a loja.'
              : returningFromCheckout
                ? 'Estamos aguardando a confirmação do pagamento. O acesso volta sozinho em alguns instantes.'
                : `O prazo de 7 dias após o vencimento terminou. Assim que o pagamento for confirmado, o acesso volta automaticamente.${canPay ? '' : ' Peça ao administrador da loja para regularizar ou fale com a equipe LuxCar.'}`}
          </p>
          {payError ? <p className="text-sm text-destructive">{payError}</p> : null}
          <div className="flex flex-wrap gap-3">
            {canPay ? (
              <Button type="button" onClick={() => void payBlocked()} disabled={paying}>
                <CreditCard className="mr-2 size-4" />
                {paying ? 'Gerando cobrança...' : 'Pagar agora'}
              </Button>
            ) : null}
            {signOutButton}
          </div>
        </section>
      </main>
    );
  }

  if (!profile.company_id && profile.role !== 'platform_admin') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-6">
        <section className="w-full max-w-lg space-y-4 rounded-2xl border border-border bg-card p-6 shadow-lux-md">
          <p className="text-sm font-medium text-primary-text">Conta autenticada · {profile.role}</p>
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
        { label: 'Gestão', items: (profile.role === 'administrador' ? managementItems : [managementItems[0]])
          .filter((item) => item.to !== '/dashboard/reports' || reportsEnabled === true) },
      ].filter((section) => section.items.length > 0);

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
          <h2 className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-sidebar-foreground/70">{section.label}</h2>
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
        <p className="truncate text-xs capitalize text-sidebar-foreground/55">{profile.role.replace(/_/g, ' ')}</p>
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

      <aside className="hidden w-[232px] flex-none flex-col gap-5 border-r border-sidebar-border bg-sidebar px-[14px] py-5 md:sticky md:top-0 md:flex md:h-screen md:overflow-y-auto">
        {renderBrand()}
        {renderNavigation()}
        {renderAccountActions()}
      </aside>

      <main className="min-w-0 flex-[999_1_560px] p-4 sm:p-6 md:px-8 md:pb-12 md:pt-7">
        {notice ? (
          <div role="status" className="mb-5 flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-foreground">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
            <p>
              {notice.kind === 'due_today'
                ? 'Sua assinatura LuxCar vence hoje. Faça o pagamento para manter o acesso sem interrupção.'
                : `Pagamento da assinatura em atraso. ${notice.daysLeft === 1 ? 'Resta 1 dia' : `Restam ${notice.daysLeft} dias`} para regularizar antes do bloqueio.`}
            </p>
            {profile.role === 'administrador' ? (
              <NavLink to="/dashboard/settings?aba=assinatura" className="ml-auto shrink-0 font-medium text-primary-text underline-offset-4 hover:underline">Pagar agora</NavLink>
            ) : null}
          </div>
        ) : null}
        <Outlet />
      </main>
    </div>
  );
}
