import { lazy, Suspense, ComponentType } from 'react';
import { createBrowserRouter } from 'react-router';
import { RootLayout } from './components/layouts/RootLayout';
import { AuthLayout } from './components/layouts/AuthLayout';
import { DashboardLayout } from './components/layouts/DashboardLayout';
import { Landing } from './pages/Landing';
import { PublicHome } from './pages/PublicHome';
import { PublicVehicleDetails } from './pages/PublicVehicleDetails';
import { NotFound } from './pages/NotFound';
import { RouteError } from './pages/RouteError';
import { Skeleton } from './components/ui/skeleton';

function RouteFallback() {
  return (
    <div className="space-y-6 p-4 sm:p-6" role="status" aria-busy="true">
      <Skeleton className="h-10 w-48" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

function AuthFallback() {
  return (
    <div className="space-y-4 p-6" role="status" aria-busy="true">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
    </div>
  );
}

function withSuspense<T extends ComponentType<any>>(LazyComponent: T, Fallback = RouteFallback) {
  return function SuspendedRoute(props: React.ComponentProps<T>) {
    return (
      <Suspense fallback={<Fallback />}>
        <LazyComponent {...props} />
      </Suspense>
    );
  };
}

// Auth & Client pages (lazy)
const Login = withSuspense(lazy(() => import('./pages/Login').then((m) => ({ default: m.Login }))), AuthFallback);
const Register = withSuspense(lazy(() => import('./pages/Register').then((m) => ({ default: m.Register }))), AuthFallback);
const ClientLogin = withSuspense(lazy(() => import('./pages/ClientLogin').then((m) => ({ default: m.ClientLogin }))), AuthFallback);
const ClientRegister = withSuspense(lazy(() => import('./pages/ClientRegister').then((m) => ({ default: m.ClientRegister }))), AuthFallback);

// Dashboard pages (lazy)
const Dashboard = withSuspense(lazy(() => import('./pages/Dashboard').then((m) => ({ default: m.Dashboard }))));
const Vehicles = withSuspense(lazy(() => import('./pages/Vehicles').then((m) => ({ default: m.Vehicles }))));
const VehicleDetails = withSuspense(lazy(() => import('./pages/VehicleDetails').then((m) => ({ default: m.VehicleDetails }))));
const Negotiations = withSuspense(lazy(() => import('./pages/Negotiations').then((m) => ({ default: m.Negotiations }))));
const NegotiationDetails = withSuspense(lazy(() => import('./pages/NegotiationDetails').then((m) => ({ default: m.NegotiationDetails }))));
const Reports = withSuspense(lazy(() => import('./pages/Reports').then((m) => ({ default: m.Reports }))));
const Payments = withSuspense(lazy(() => import('./pages/Payments').then((m) => ({ default: m.Payments }))));
const Team = withSuspense(lazy(() => import('./pages/Team').then((m) => ({ default: m.Team }))));
const Platform = withSuspense(lazy(() => import('./pages/Platform').then((m) => ({ default: m.Platform }))));
const Settings = withSuspense(lazy(() => import('./pages/Settings').then((m) => ({ default: m.Settings }))));

export const router = createBrowserRouter([
  {
    path: '/',
    Component: RootLayout,
    ErrorBoundary: RouteError,
    children: [
      {
        index: true,
        Component: Landing
      },
      {
        path: 'estoque',
        Component: PublicHome
      },
      {
        path: 'vehicles/:id',
        Component: PublicVehicleDetails
      },
      {
        path: 'auth',
        Component: AuthLayout,
        children: [
          { path: 'login', Component: Login },
          { path: 'register', Component: Register }
        ]
      },
      {
        path: 'client',
        Component: AuthLayout,
        children: [
          { path: 'login', Component: ClientLogin },
          { path: 'register', Component: ClientRegister }
        ]
      },
      {
        path: 'dashboard',
        Component: DashboardLayout,
        children: [
          { index: true, Component: Dashboard },
          { path: 'vehicles', Component: Vehicles },
          { path: 'vehicles/:id', Component: VehicleDetails },
          { path: 'negotiations', Component: Negotiations },
          { path: 'negotiations/:id', Component: NegotiationDetails },
          { path: 'reports', Component: Reports },
          { path: 'payments', Component: Payments },
          { path: 'team', Component: Team },
          { path: 'platform', Component: Platform },
          { path: 'settings', Component: Settings }
        ]
      },
      { path: '*', Component: NotFound }
    ]
  }
]);
