import { useEffect, useState } from 'react';
import { Outlet, useNavigate, NavLink } from 'react-router';
import { useAuth } from '../../../contexts/AuthContext';
import {
  Car,
  LayoutDashboard,
  Handshake,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  User
} from 'lucide-react';
import { ThemeToggle } from '../ThemeToggle';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import { cn } from '../ui/utils';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/dashboard/vehicles', icon: Car, label: 'Veículos' },
  { to: '/dashboard/negotiations', icon: Handshake, label: 'Negociações' },
  { to: '/dashboard/reports', icon: BarChart3, label: 'Relatórios' },
  { to: '/dashboard/settings', icon: Settings, label: 'Configurações' }
];

const navClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'flex min-h-11 items-center gap-3 rounded-xl px-4 py-2.5 text-sm transition-all duration-200 ease-out motion-reduce:transition-none',
    isActive
      ? 'bg-accent text-primary shadow-lux-sm'
      : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground'
  );

export function DashboardLayout() {
  const { user, profile, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth/login', { replace: true });
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen bg-background">
        <aside className="hidden w-72 border-r border-sidebar-border bg-sidebar p-4 md:block">
          <Skeleton className="mb-8 h-12 w-40" />
          <div className="space-y-2">
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
          </div>
        </aside>
        <main className="flex-1 p-4 md:p-8">
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

  if (!user || !profile) {
    return null;
  }

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth/login');
  };

  const brand = (
    <div className="flex items-center gap-3">
      <div className="flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lux-md">
        <Car className="size-6" />
      </div>
      <div>
        <h1 className="text-lg font-medium leading-tight text-sidebar-foreground">LuxCar</h1>
        <p className="text-xs text-sidebar-foreground/60">Centro da loja</p>
      </div>
    </div>
  );

  const userCard = (
    <div className="flex items-center gap-3 rounded-2xl border border-sidebar-border bg-sidebar-accent/50 px-3 py-3">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
        <User className="size-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="truncate text-sm font-medium text-sidebar-foreground">{profile.full_name}</p>
        <p className="text-xs capitalize text-sidebar-foreground/60">{profile.role}</p>
      </div>
      <ThemeToggle />
    </div>
  );

  const signOutBtn = (
    <Button
      type="button"
      variant="ghost"
      onClick={handleSignOut}
      className="w-full justify-start text-destructive hover:bg-destructive/10 hover:text-destructive"
    >
      <LogOut className="size-5" />
      <span>Sair</span>
    </Button>
  );

  return (
    <div className="min-h-screen lux-gradient">
      {/* Sidebar Desktop */}
      <aside className="z-sidebar hidden border-r border-sidebar-border bg-sidebar/95 backdrop-blur-xl md:fixed md:inset-y-0 md:flex md:w-72 md:flex-col">
        <div className="flex items-center border-b border-sidebar-border px-6 py-5">{brand}</div>

        <nav className="flex-1 space-y-1 px-3 py-6">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === '/dashboard'} className={navClass}>
              <item.icon className="w-5 h-5" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="space-y-2 border-t border-sidebar-border p-3">
          {userCard}
          {signOutBtn}
        </div>
      </aside>

      {/* Mobile Sidebar */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <aside className="fixed inset-y-0 left-0 flex w-72 flex-col border-r border-sidebar-border bg-sidebar shadow-lux-lg">
            <div className="flex items-center justify-between border-b border-sidebar-border px-6 py-5">
              {brand}
              <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(false)} aria-label="Fechar menu">
                <X className="size-5" />
              </Button>
            </div>

            <nav className="flex-1 space-y-1 px-3 py-6">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/dashboard'}
                  onClick={() => setSidebarOpen(false)}
                  className={navClass}
                >
                  <item.icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </nav>

            <div className="space-y-2 border-t border-sidebar-border p-3">
              {userCard}
              {signOutBtn}
            </div>
          </aside>
        </div>
      )}

      {/* Main Content */}
      <div className="md:pl-72">
        {/* Mobile Header */}
        <header className="z-header sticky top-0 flex items-center justify-between border-b border-border bg-background/80 px-4 py-3 backdrop-blur-xl md:hidden">
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)} aria-label="Abrir menu">
            <Menu className="size-5" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Car className="size-5" />
            </div>
            <span className="font-medium text-foreground">LuxCar</span>
          </div>
          <ThemeToggle />
        </header>

        <div className="relative">
          <main className="relative mx-auto w-full max-w-7xl p-4 md:p-8">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
