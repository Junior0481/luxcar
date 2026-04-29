import { Link } from 'react-router';
import { AlertCircle } from 'lucide-react';

export function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="text-center">
        <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h1 className="text-4xl font-bold text-gray-900 mb-2">404</h1>
        <p className="text-gray-600 mb-6">Página não encontrada</p>
        <Link
          to="/dashboard"
          className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Voltar ao Dashboard
        </Link>
      </div>
    </div>
  );
}
