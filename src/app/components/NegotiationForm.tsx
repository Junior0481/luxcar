import { useState, useEffect } from 'react';
import { supabase, Vehicle } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { X, AlertCircle } from 'lucide-react';

type NegotiationFormProps = {
  onClose: () => void;
};

export function NegotiationForm({ onClose }: NegotiationFormProps) {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);

  const [formData, setFormData] = useState({
    vehicle_id: '',
    client_name: '',
    client_phone: '',
    client_email: '',
    client_cpf: '',
    stage: 'primeiro_contato' as any,
    offered_price: '',
    notes: '',
    priority: 'media' as 'baixa' | 'media' | 'alta'
  });

  useEffect(() => {
    loadVehicles();
  }, []);

  const loadVehicles = async () => {
    try {
      const { data } = await supabase
        .from('vehicles')
        .select('*')
        .eq('status', 'disponivel')
        .order('brand');
      if (data) setVehicles(data);
    } catch (error) {
      console.error('Error loading vehicles:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { error: negError } = await supabase.from('negotiations').insert([
        {
          company_id: profile?.company_id || null,
          vehicle_id: formData.vehicle_id,
          seller_id: user?.id,
          client_name: formData.client_name,
          client_phone: formData.client_phone || null,
          client_email: formData.client_email || null,
          client_cpf: formData.client_cpf || null,
          stage: formData.stage,
          offered_price: formData.offered_price ? parseFloat(formData.offered_price) : null,
          notes: formData.notes || null,
          priority: formData.priority
        }
      ]);

      if (negError) throw negError;

      await supabase
        .from('vehicles')
        .update({ status: 'em_negociacao' })
        .eq('id', formData.vehicle_id);

      onClose();
    } catch (err: any) {
      setError(err.message || 'Erro ao criar negociação');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl my-8">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">Nova Negociação</h2>
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

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label htmlFor="vehicle_id" className="block text-sm font-medium text-gray-700 mb-2">
                Veículo *
              </label>
              <select
                id="vehicle_id"
                value={formData.vehicle_id}
                onChange={(e) => setFormData({ ...formData, vehicle_id: e.target.value })}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Selecione um veículo</option>
                {vehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.brand} {vehicle.model} {vehicle.year} - {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(vehicle.sale_price)}
                  </option>
                ))}
              </select>
              {vehicles.length === 0 && (
                <p className="mt-1 text-xs text-amber-600">Nenhum veículo disponível para negociação</p>
              )}
            </div>

            <div className="md:col-span-2">
              <label htmlFor="client_name" className="block text-sm font-medium text-gray-700 mb-2">
                Nome do Cliente *
              </label>
              <input
                type="text"
                id="client_name"
                value={formData.client_name}
                onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="João Silva"
              />
            </div>

            <div>
              <label htmlFor="client_phone" className="block text-sm font-medium text-gray-700 mb-2">
                Telefone
              </label>
              <input
                type="tel"
                id="client_phone"
                value={formData.client_phone}
                onChange={(e) => setFormData({ ...formData, client_phone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="(11) 99999-9999"
              />
            </div>

            <div>
              <label htmlFor="client_email" className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <input
                type="email"
                id="client_email"
                value={formData.client_email}
                onChange={(e) => setFormData({ ...formData, client_email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="cliente@email.com"
              />
            </div>

            <div>
              <label htmlFor="client_cpf" className="block text-sm font-medium text-gray-700 mb-2">
                CPF
              </label>
              <input
                type="text"
                id="client_cpf"
                value={formData.client_cpf}
                onChange={(e) => setFormData({ ...formData, client_cpf: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="000.000.000-00"
              />
            </div>

            <div>
              <label htmlFor="stage" className="block text-sm font-medium text-gray-700 mb-2">
                Estágio *
              </label>
              <select
                id="stage"
                value={formData.stage}
                onChange={(e) => setFormData({ ...formData, stage: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="primeiro_contato">Primeiro Contato</option>
                <option value="avaliacao">Avaliação</option>
                <option value="test_drive_agendado">Test Drive Agendado</option>
                <option value="test_drive_realizado">Test Drive Realizado</option>
                <option value="proposta_enviada">Proposta Enviada</option>
                <option value="negociacao_preco">Negociação Preço</option>
                <option value="aprovacao_credito">Aprovação Crédito</option>
                <option value="documentacao">Documentação</option>
              </select>
            </div>

            <div>
              <label htmlFor="priority" className="block text-sm font-medium text-gray-700 mb-2">
                Prioridade *
              </label>
              <select
                id="priority"
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="baixa">Baixa</option>
                <option value="media">Média</option>
                <option value="alta">Alta</option>
              </select>
            </div>

            <div>
              <label htmlFor="offered_price" className="block text-sm font-medium text-gray-700 mb-2">
                Valor Proposto (R$)
              </label>
              <input
                type="number"
                id="offered_price"
                value={formData.offered_price}
                onChange={(e) => setFormData({ ...formData, offered_price: e.target.value })}
                step="0.01"
                min="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="55000.00"
              />
            </div>

            <div className="md:col-span-2">
              <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-2">
                Observações
              </label>
              <textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Anotações sobre a negociação..."
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || vehicles.length === 0}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Criando...' : 'Criar Negociação'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
