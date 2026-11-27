import { Outlet } from 'react-router';
import { AuthProvider } from '../../../contexts/AuthContext';
import { CompanyProvider } from '../../../contexts/CompanyContext';
import { RouteAccessibility } from '../RouteAccessibility';

export function RootLayout() {
  return (
    <AuthProvider>
      <CompanyProvider>
        <RouteAccessibility />
        <Outlet />
      </CompanyProvider>
    </AuthProvider>
  );
}
