import { Outlet } from 'react-router';
import { AuthProvider } from '../../../contexts/AuthContext';
import { CompanyProvider } from '../../../contexts/CompanyContext';

export function RootLayout() {
  return (
    <AuthProvider>
      <CompanyProvider>
        <Outlet />
      </CompanyProvider>
    </AuthProvider>
  );
}
