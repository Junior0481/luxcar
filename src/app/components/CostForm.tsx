import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { X, AlertCircle } from 'lucide-react';

type CostFormProps = {
  vehicleId: string;
  onClose: () => void;
};

export function CostForm({ vehicleId, onClose }: CostFormProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    cost_type: 'manutencao' as 'manutencao' | 'estetica' | 'mecanica' | 'revisao' | 'laudo' | 'outro',
    description: '',
    amount: '',
    service_date: new Date().toISOString().split('T')[0]
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { error } = await supabase.from('vehicle_costs').insert([
        {
          vehicle_id: vehicleId,
          cost_type: formData.cost_type,
          description: formData.description,
          amount: parseFloat(formData.amount),
          service_date: formData.service_date,
          created_by: user?.id
        }
      ]);

      if (error) throw error;
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar custo');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Adicionar Custo/Manutenção</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label htmlFor="cost_type" className="block text-sm font-medium text-gray-700 mb-2">
              Tipo de Custo *
            </label>
            <select
              id="cost_type"
              value={formData.cost_type}
              onChange={(e) => setFormData({ ...formData, cost_type: e.target.value as any })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="manutencao">Manutenção</option>
              <option value="estetica">Estética</option>
              <option value="mecanica">Mecânica</option>
              <option value="revisao">Revisão</option>
              <option value="laudo">Laudo</option>
              <option value="outro">Outro</option>
            </select>
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
              Descrição *
            </label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              required
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Descreva o serviço realizado..."
            />
          </div>

          <div>
            <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-2">
              Valor (R$) *
            </label>
            <input
              type="number"
              id="amount"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              required
              step="0.01"
              min="0"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="150.00"
            />
          </div>

          <div>
            <label htmlFor="service_date" className="block text-sm font-medium text-gray-700 mb-2">
              Data do Serviço
            </label>
            <input
              type="date"
              id="service_date"
              value={formData.service_date}
              onChange={(e) => setFormData({ ...formData, service_date: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
