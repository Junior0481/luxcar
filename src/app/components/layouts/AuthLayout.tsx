import { useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router';
import { useAuth } from '../../../contexts/AuthContext';
import { Car } from 'lucide-react';

export function AuthLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4">
            <Car className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">LuxCar</h1>
          <p className="text-gray-600 mt-2">Sistema de Gerenciamento de Concessionária</p>
        </div>
        <Outlet />
      </div>
    </div>
  );
}
