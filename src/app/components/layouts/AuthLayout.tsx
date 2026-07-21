import { useEffect } from 'react';
import { Outlet, useLocation, useNavigate, Link } from 'react-router';
import { useAuth } from '../../../contexts/AuthContext';
import { Car } from 'lucide-react';
import { ThemeToggle } from '../ThemeToggle';
import loginImg from '../../../assets/login_img.png';

export function AuthLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!loading && user) {
      navigate(location.pathname.startsWith('/client') ? '/' : '/dashboard', { replace: true });
    }
  }, [user, loading, navigate, location.pathname]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-2 bg-background">
      {/* Painel visual (esquerda) — some no mobile */}
      <aside className="relative hidden lg:block overflow-hidden">
        <img
          src={loginImg}
          alt="LuxCar"
          className="absolute inset-0 h-full w-full object-cover"
        />
        {/* Gradientes para legibilidade e profundidade */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/40" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(248,167,70,0.25),transparent_55%)]" />

        {/* Logo topo-esquerda */}
        <Link to="/" className="absolute top-8 left-8 flex items-center gap-3 z-10">
          <div className="flex items-center justify-center w-10 h-10 bg-primary rounded-lg shadow-lg shadow-primary/30">
            <Car className="w-6 h-6 text-primary-foreground" />
          </div>
          <span className="text-2xl font-bold text-white">LuxCar</span>
        </Link>

        {/* Frase de venda embaixo */}
        <div className="absolute bottom-12 left-8 right-8 z-10">
          <p className="text-3xl font-bold text-white leading-tight max-w-md">
            A plataforma que organiza e escala sua concessionária.
          </p>
          <p className="mt-3 text-white/70 max-w-md">
            Estoque, negociações, clientes e vendedores — tudo em um só lugar, com a sua marca.
          </p>
        </div>
      </aside>

      {/* Painel do formulário (direita) */}
      <main className="relative flex items-center justify-center p-6 sm:p-10 min-h-screen lg:min-h-0">
        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>

        <div className="w-full max-w-md">
          {/* Logo (aparece no mobile e reforça no desktop) */}
          <div className="text-center mb-8 lg:hidden">
            <Link to="/" className="inline-flex items-center justify-center w-16 h-16 bg-primary rounded-2xl mb-4 shadow-lg shadow-primary/25">
              <Car className="w-8 h-8 text-primary-foreground" />
            </Link>
            <h1 className="text-3xl font-bold text-foreground">LuxCar</h1>
            <p className="text-muted-foreground mt-2">Sistema de Gerenciamento de Concessionária</p>
          </div>

          <Outlet />
        </div>
      </main>
    </div>
  );
}
