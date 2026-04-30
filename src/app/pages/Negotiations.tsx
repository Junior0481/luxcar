import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { supabase, Negotiation, Vehicle, Profile } from '../../lib/supabase';
import { Plus, Search, Filter, Handshake, AlertCircle } from 'lucide-react';
import { NegotiationForm } from '../components/NegotiationForm';

type NegotiationWithDetails = Negotiation & {
  vehicle?: Vehicle;
  seller?: Profile;
};

export function Negotiations() {
  const [negotiations, setNegotiations] = useState<NegotiationWithDetails[]>([]);
  const [filteredNegotiations, setFilteredNegotiations] = useState<NegotiationWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [stageFilter, setStageFilter] = useState<string>('active');
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    loadNegotiations();
  }, []);

  useEffect(() => {
    filterNegotiations();
  }, [searchTerm, stageFilter, negotiations]);

  const loadNegotiations = async () => {
    try {
      const { data, error } = await supabase
        .from('negotiations')
        .select(`
          *,
          vehicle:vehicles(*),
          seller:profiles(*)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNegotiations(data || []);
    } catch (error) {
      console.error('Error loading negotiations:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterNegotiations = () => {
    let filtered = negotiations;

    if (stageFilter === 'active') {
      filtered = filtered.filter(n => !['finalizado', 'perdido'].includes(n.stage));
    } else if (stageFilter !== 'all') {
      filtered = filtered.filter(n => n.stage === stageFilter);
    }

    if (searchTerm) {
      filtered = filtered.filter(
        (n) =>
          n.client_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          n.client_phone?.includes(searchTerm) ||
          n.vehicle?.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
          n.vehicle?.model.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredNegotiations(filtered);
  };

  const getStageBadge = (stage: string) => {
    const stages: Record<string, { label: string; className: string }> = {
      primeiro_contato: { label: 'Primeiro Contato', className: 'bg-[#f3f3f3] text-[#555459]' },
      avaliacao: { label: 'Avaliação', className: 'bg-[#fff2df] text-[#010101]' },
      test_drive_agendado: { label: 'Test Drive Agendado', className: 'bg-[#efefef] text-[#555459]' },
      test_drive_realizado: { label: 'Test Drive Realizado', className: 'bg-[#ffe3be] text-[#010101]' },
      proposta_enviada: { label: 'Proposta Enviada', className: 'bg-[#fff2df] text-[#010101]' },
      negociacao_preco: { label: 'Negociação Preço', className: 'bg-[#efefef] text-[#555459]' },
      aprovacao_credito: { label: 'Aprovação Crédito', className: 'bg-[#ffe3be] text-[#010101]' },
      documentacao: { label: 'Documentação', className: 'bg-[#f3f3f3] text-[#555459]' },
      finalizado: { label: 'Finalizado', className: 'bg-[#010101] text-white' },
      perdido: { label: 'Perdido', className: 'bg-red-100 text-red-800' }
    };
    const badge = stages[stage] || stages.primeiro_contato;
    return <span className={`px-2 py-1 text-xs font-medium rounded-full ${badge.className}`}>{badge.label}</span>;
  };

  const getPriorityBadge = (priority: string) => {
    const badges = {
      alta: { label: 'Alta', className: 'bg-red-100 text-red-800' },
      media: { label: 'Média', className: 'bg-[#fff2df] text-[#010101]' },
      baixa: { label: 'Baixa', className: 'bg-[#f3f3f3] text-[#555459]' }
    };
    const badge = badges[priority as keyof typeof badges] || badges.media;
    return <span className={`px-2 py-1 text-xs font-medium rounded-full ${badge.className}`}>{badge.label}</span>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Negociações</h1>
          <p className="text-gray-600 mt-1">Acompanhe todas as negociações em andamento</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Nova Negociação
        </button>
      </div>

      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por cliente ou veículo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <select
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
              className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white"
            >
              <option value="active">Ativas</option>
              <option value="all">Todas</option>
              <option value="primeiro_contato">Primeiro Contato</option>
              <option value="avaliacao">Avaliação</option>
              <option value="test_drive_agendado">Test Drive Agendado</option>
              <option value="test_drive_realizado">Test Drive Realizado</option>
              <option value="proposta_enviada">Proposta Enviada</option>
              <option value="negociacao_preco">Negociação Preço</option>
              <option value="aprovacao_credito">Aprovação Crédito</option>
              <option value="documentacao">Documentação</option>
              <option value="finalizado">Finalizado</option>
              <option value="perdido">Perdido</option>
            </select>
          </div>
        </div>
      </div>

      {filteredNegotiations.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center shadow-sm border border-gray-200">
          <Handshake className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhuma negociação encontrada</h3>
          <p className="text-gray-600 mb-6">
            {searchTerm || stageFilter !== 'active'
              ? 'Tente ajustar os filtros de busca'
              : 'Comece criando sua primeira negociação'}
          </p>
          {!searchTerm && stageFilter === 'active' && (
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Nova Negociação
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cliente</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Veículo</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vendedor</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estágio</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Prioridade</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredNegotiations.map((negotiation) => (
                  <tr key={negotiation.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-gray-900">{negotiation.client_name}</p>
                        {negotiation.client_phone && (
                          <p className="text-sm text-gray-500">{negotiation.client_phone}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {negotiation.vehicle ? (
                        <div>
                          <p className="font-medium text-gray-900">
                            {negotiation.vehicle.brand} {negotiation.vehicle.model}
                          </p>
                          <p className="text-sm text-gray-500">{negotiation.vehicle.year}</p>
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-gray-900">{negotiation.seller?.full_name || '-'}</p>
                    </td>
                    <td className="px-6 py-4">{getStageBadge(negotiation.stage)}</td>
                    <td className="px-6 py-4">{getPriorityBadge(negotiation.priority)}</td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-gray-500">
                        {new Date(negotiation.created_at).toLocaleDateString('pt-BR')}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <Link
                        to={`/dashboard/negotiations/${negotiation.id}`}
                        className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                      >
                        Ver detalhes
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showForm && (
        <NegotiationForm onClose={() => {
          setShowForm(false);
          loadNegotiations();
        }} />
      )}
    </div>
  );
}
