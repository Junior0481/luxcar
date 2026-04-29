import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { X, AlertCircle } from 'lucide-react';

type InteractionFormProps = {
  negotiationId: string;
  vehicleId: string;
  onClose: () => void;
};

export function InteractionForm({ negotiationId, vehicleId, onClose }: InteractionFormProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    interaction_type: 'ligacao' as 'ligacao' | 'whatsapp' | 'email' | 'visita' | 'test_drive' | 'proposta' | 'observacao' | 'outro',
    description: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { error } = await supabase.from('interaction_history').insert([
        {
          negotiation_id: negotiationId,
          vehicle_id: vehicleId,
          user_id: user?.id,
          interaction_type: formData.interaction_type,
          description: formData.description
        }
      ]);

      if (error) throw error;
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar interação');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Nova Interação</h2>
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
            <label htmlFor="interaction_type" className="block text-sm font-medium text-gray-700 mb-2">
              Tipo de Interação *
            </label>
            <select
              id="interaction_type"
              value={formData.interaction_type}
              onChange={(e) => setFormData({ ...formData, interaction_type: e.target.value as any })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="ligacao">Ligação</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="email">Email</option>
              <option value="visita">Visita</option>
              <option value="test_drive">Test Drive</option>
              <option value="proposta">Proposta</option>
              <option value="observacao">Observação</option>
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
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Descreva o que foi discutido ou combinado..."
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
