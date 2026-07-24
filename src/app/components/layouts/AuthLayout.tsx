import { useEffect } from 'react';
import { Outlet, useLocation, useNavigate, Link } from 'react-router';
import { useAuth } from '../../../contexts/AuthContext';
import { Car } from 'lucide-react';
import { ThemeToggle } from '../ThemeToggle';
import { Skeleton } from '../ui/skeleton';
import loginImg from '../../../assets/login_img.png';

export function AuthLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!loading && user) {
      navigate(location.pathname.startsWith('/client') ? '/estoque' : '/dashboard', { replace: true });
    }
  }, [user, loading, navigate, location.pathname]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="w-full max-w-md space-y-4">
          <Skeleton className="mx-auto size-16 rounded-2xl" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-[1.1fr_0.9fr]">
      <aside className="relative hidden overflow-hidden lg:block">
        <img src={loginImg} alt="Showroom automotivo LuxCar" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/55" />
        <div className="absolute inset-0 lux-gradient opacity-25" />

        <Link to="/" className="absolute left-8 top-8 z-10 flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lux-md">
            <Car className="size-6" />
          </div>
          <span className="text-2xl font-medium text-white">LuxCar</span>
        </Link>

        <div className="absolute bottom-12 left-8 right-8 z-10 max-w-xl">
          <p className="text-sm font-medium uppercase text-white/55">SaaS white label para lojas automotivas</p>
          <h1 className="mt-3 text-4xl font-medium leading-tight text-white">
            Sua operação organizada para vender com mais controle.
          </h1>
          <p className="mt-4 max-w-md text-white/70">
            Estoque, pipeline, relatórios e equipe em uma única plataforma com aparência de produto premium.
          </p>
        </div>
      </aside>

      <main className="relative flex min-h-screen items-center justify-center p-6 sm:p-10 lg:min-h-0">
        <div className="absolute right-4 top-4">
          <ThemeToggle />
        </div>

        <div className="w-full max-w-md">
          <div className="mb-8 text-center lg:hidden">
            <Link to="/" className="mb-4 inline-flex size-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lux-md">
              <Car className="size-8" />
            </Link>
            <h1 className="text-3xl font-medium text-foreground">LuxCar</h1>
            <p className="mt-2 text-muted-foreground">Centro de comando da sua loja.</p>
          </div>

          <Outlet />
        </div>
      </main>
    </div>
  );
}


