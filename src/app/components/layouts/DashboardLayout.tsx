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

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/dashboard/vehicles', icon: Car, label: 'Veículos' },
  { to: '/dashboard/negotiations', icon: Handshake, label: 'Negociações' },
  { to: '/dashboard/reports', icon: BarChart3, label: 'Relatórios' },
  { to: '/dashboard/settings', icon: Settings, label: 'Configurações' }
];

const navClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 px-4 py-2.5 rounded-xl transition-colors ${
    isActive
      ? 'bg-accent text-primary font-medium'
      : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
  }`;

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
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
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
      <div className="flex items-center justify-center w-10 h-10 bg-primary rounded-xl shadow-lg shadow-primary/20">
        <Car className="w-6 h-6 text-primary-foreground" />
      </div>
      <div>
        <h1 className="text-xl font-bold text-foreground">LuxCar</h1>
        <p className="text-xs text-muted-foreground">Painel da loja</p>
      </div>
    </div>
  );

  const userCard = (
    <div className="flex items-center gap-3 px-3 py-2.5 bg-accent/50 rounded-xl">
      <div className="flex items-center justify-center w-9 h-9 bg-primary/15 text-primary rounded-full shrink-0">
        <User className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{profile.full_name}</p>
        <p className="text-xs text-muted-foreground capitalize">{profile.role}</p>
      </div>
      <ThemeToggle />
    </div>
  );

  const signOutBtn = (
    <button
      onClick={handleSignOut}
      className="flex items-center gap-3 w-full px-4 py-2.5 text-destructive hover:bg-destructive/10 rounded-xl transition-colors"
    >
      <LogOut className="w-5 h-5" />
      <span className="font-medium">Sair</span>
    </button>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar Desktop */}
      <aside className="hidden md:flex md:flex-col md:fixed md:inset-y-0 md:w-64 bg-sidebar border-r border-sidebar-border">
        <div className="flex items-center px-6 py-5 border-b border-sidebar-border">{brand}</div>

        <nav className="flex-1 px-3 py-6 space-y-1">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === '/dashboard'} className={navClass}>
              <item.icon className="w-5 h-5" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-sidebar-border space-y-2">
          {userCard}
          {signOutBtn}
        </div>
      </aside>

      {/* Mobile Sidebar */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <aside className="fixed inset-y-0 left-0 w-64 bg-sidebar border-r border-sidebar-border shadow-xl flex flex-col">
            <div className="flex items-center justify-between px-6 py-5 border-b border-sidebar-border">
              {brand}
              <button onClick={() => setSidebarOpen(false)} aria-label="Fechar">
                <X className="w-6 h-6 text-muted-foreground" />
              </button>
            </div>

            <nav className="flex-1 px-3 py-6 space-y-1">
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

            <div className="p-3 border-t border-sidebar-border space-y-2">
              {userCard}
              {signOutBtn}
            </div>
          </aside>
        </div>
      )}

      {/* Main Content */}
      <div className="md:pl-64">
        {/* Mobile Header */}
        <header className="md:hidden sticky top-0 z-10 flex items-center justify-between px-4 py-3 bg-background/80 backdrop-blur border-b border-border">
          <button onClick={() => setSidebarOpen(true)} aria-label="Abrir menu">
            <Menu className="w-6 h-6 text-foreground" />
          </button>
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 bg-primary rounded-lg">
              <Car className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-foreground">LuxCar</span>
          </div>
          <ThemeToggle />
        </header>

        {/* Page Content com glow sutil no topo */}
        <div className="relative">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(ellipse_60%_100%_at_50%_0%,rgba(248,167,70,0.06),transparent_70%)]" />
          <main className="relative p-4 md:p-8">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
