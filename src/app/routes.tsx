import { createBrowserRouter } from 'react-router';
import { RootLayout } from './components/layouts/RootLayout';
import { AuthLayout } from './components/layouts/AuthLayout';
import { DashboardLayout } from './components/layouts/DashboardLayout';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Dashboard } from './pages/Dashboard';
import { Vehicles } from './pages/Vehicles';
import { VehicleDetails } from './pages/VehicleDetails';
import { Negotiations } from './pages/Negotiations';
import { NegotiationDetails } from './pages/NegotiationDetails';
import { Reports } from './pages/Reports';
import { Settings } from './pages/Settings';
import { NotFound } from './pages/NotFound';
import { Landing } from './pages/Landing';
import { PublicHome } from './pages/PublicHome';
import { PublicVehicleDetails } from './pages/PublicVehicleDetails';
import { ClientLogin } from './pages/ClientLogin';
import { ClientRegister } from './pages/ClientRegister';

export const router = createBrowserRouter([
  {
    path: '/',
    Component: RootLayout,
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
          { path: 'settings', Component: Settings }
        ]
      },
      { path: '*', Component: NotFound }
    ]
  }
]);
