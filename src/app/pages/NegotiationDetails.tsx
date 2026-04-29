import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router';
import { supabase, Negotiation, Vehicle, Profile, InteractionHistory, TradeInVehicle } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  ArrowLeft,
  User,
  Phone,
  Mail,
  FileText,
  DollarSign,
  Calendar,
  AlertCircle,
  Plus,
  MessageSquare,
  Edit,
  Car
} from 'lucide-react';
import { InteractionForm } from '../components/InteractionForm';
import { TradeInVehicleForm } from '../components/TradeInVehicleForm';

type NegotiationWithDetails = Negotiation & {
  vehicle?: Vehicle;
  seller?: Profile;
};

type InteractionWithUser = InteractionHistory & {
  user?: Profile;
};

export function NegotiationDetails() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [negotiation, setNegotiation] = useState<NegotiationWithDetails | null>(null);
  const [interactions, setInteractions] = useState<InteractionWithUser[]>([]);
  const [tradeInVehicles, setTradeInVehicles] = useState<TradeInVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInteractionForm, setShowInteractionForm] = useState(false);
  const [showTradeInForm, setShowTradeInForm] = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (id) {
      loadNegotiationDetails();
    }
  }, [id]);

  const loadNegotiationDetails = async () => {
    try {
      const [negotiationRes, interactionsRes, tradeInRes] = await Promise.all([
        supabase
          .from('negotiations')
          .select(`
            *,
            vehicle:vehicles(*),
            seller:profiles(*)
          `)
          .eq('id', id)
          .single(),
        supabase
          .from('interaction_history')
          .select(`
            *,
            user:profiles(*)
          `)
          .eq('negotiation_id', id)
          .order('created_at', { ascending: false }),
        supabase
          .from('trade_in_vehicles')
          .select('*')
          .eq('negotiation_id', id)
          .order('created_at', { ascending: false })
      ]);

      if (negotiationRes.data) setNegotiation(negotiationRes.data);
      if (interactionsRes.data) setInteractions(interactionsRes.data);
      if (tradeInRes.data) setTradeInVehicles(tradeInRes.data);
    } catch (error) {
      console.error('Error loading negotiation details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStageUpdate = async (newStage: string) => {
    if (!negotiation) return;
    setUpdating(true);

    try {
      const { error } = await supabase
        .from('negotiations')
        .update({ stage: newStage })
        .eq('id', negotiation.id);

      if (error) throw error;

      if (newStage === 'finalizado') {
        // Atualizar status do veículo
        await supabase
          .from('vehicles')
          .update({ status: 'vendido' })
          .eq('id', negotiation.vehicle_id);

        // Criar registro de venda
        const saleData = {
          company_id: negotiation.company_id,
          vehicle_id: negotiation.vehicle_id,
          seller_id: negotiation.seller_id,
          buyer_name: negotiation.client_name,
          buyer_phone: negotiation.client_phone || null,
          buyer_email: negotiation.client_email || null,
          buyer_cpf: negotiation.client_cpf || null,
          final_price: negotiation.offered_price || negotiation.vehicle?.sale_price || 0,
          sale_date: new Date().toISOString().split('T')[0],
          payment_method: 'a_definir',
          notes: negotiation.notes || null
        };

        await supabase.from('sales').insert([saleData]);
      } else if (newStage === 'perdido') {
        await supabase
          .from('vehicles')
          .update({ status: 'disponivel' })
          .eq('id', negotiation.vehicle_id);
      }

      loadNegotiationDetails();
    } catch (error: any) {
      alert('Erro ao atualizar estágio: ' + error.message);
    } finally {
      setUpdating(false);
    }
  };

  const handlePriorityUpdate = async (newPriority: 'baixa' | 'media' | 'alta') => {
    if (!negotiation) return;

    try {
      const { error } = await supabase
        .from('negotiations')
        .update({ priority: newPriority })
        .eq('id', negotiation.id);

      if (error) throw error;
      loadNegotiationDetails();
    } catch (error: any) {
      alert('Erro ao atualizar prioridade: ' + error.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!negotiation) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Negociação não encontrada</h2>
        <Link to="/dashboard/negotiations" className="text-blue-600 hover:text-blue-700">
          Voltar para negociações
        </Link>
      </div>
    );
  }

  const getStageBadge = (stage: string) => {
    const stages: Record<string, { label: string; className: string }> = {
      primeiro_contato: { label: 'Primeiro Contato', className: 'bg-gray-100 text-gray-800' },
      avaliacao: { label: 'Avaliação', className: 'bg-blue-100 text-blue-800' },
      test_drive_agendado: { label: 'Test Drive Agendado', className: 'bg-purple-100 text-purple-800' },
      test_drive_realizado: { label: 'Test Drive Realizado', className: 'bg-indigo-100 text-indigo-800' },
      proposta_enviada: { label: 'Proposta Enviada', className: 'bg-cyan-100 text-cyan-800' },
      negociacao_preco: { label: 'Negociação Preço', className: 'bg-amber-100 text-amber-800' },
      aprovacao_credito: { label: 'Aprovação Crédito', className: 'bg-orange-100 text-orange-800' },
      documentacao: { label: 'Documentação', className: 'bg-lime-100 text-lime-800' },
      finalizado: { label: 'Finalizado', className: 'bg-green-100 text-green-800' },
      perdido: { label: 'Perdido', className: 'bg-red-100 text-red-800' }
    };
    const badge = stages[stage] || stages.primeiro_contato;
    return <span className={`px-3 py-1 text-sm font-medium rounded-full ${badge.className}`}>{badge.label}</span>;
  };

  const interactionTypeLabels: Record<string, string> = {
    ligacao: 'Ligação',
    whatsapp: 'WhatsApp',
    email: 'Email',
    visita: 'Visita',
    test_drive: 'Test Drive',
    proposta: 'Proposta',
    observacao: 'Observação',
    outro: 'Outro'
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/dashboard/negotiations')}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-gray-900">{negotiation.client_name}</h1>
          <p className="text-gray-600 mt-1">
            {negotiation.vehicle && `${negotiation.vehicle.brand} ${negotiation.vehicle.model} ${negotiation.vehicle.year}`}
          </p>
        </div>
        {getStageBadge(negotiation.stage)}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Informações do Cliente</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {negotiation.client_phone && (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                    <Phone className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Telefone</p>
                    <p className="font-medium text-gray-900">{negotiation.client_phone}</p>
                  </div>
                </div>
              )}
              {negotiation.client_email && (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center">
                    <Mail className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Email</p>
                    <p className="font-medium text-gray-900">{negotiation.client_email}</p>
                  </div>
                </div>
              )}
              {negotiation.client_cpf && (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center">
                    <FileText className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">CPF</p>
                    <p className="font-medium text-gray-900">{negotiation.client_cpf}</p>
                  </div>
                </div>
              )}
              {negotiation.offered_price && (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Valor Proposto</p>
                    <p className="font-medium text-gray-900">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(negotiation.offered_price)}
                    </p>
                  </div>
                </div>
              )}
            </div>
            {negotiation.notes && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <p className="text-sm text-gray-600 mb-1">Observações</p>
                <p className="text-gray-900">{negotiation.notes}</p>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Histórico de Interações</h2>
              <button
                onClick={() => setShowInteractionForm(true)}
                className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
              >
                <Plus className="w-4 h-4" />
                Adicionar
              </button>
            </div>
            {interactions.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-8">Nenhuma interação registrada</p>
            ) : (
              <div className="space-y-4">
                {interactions.map((interaction) => (
                  <div key={interaction.id} className="flex gap-4 pb-4 border-b border-gray-100 last:border-0">
                    <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <MessageSquare className="w-5 h-5 text-gray-600" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-gray-900">
                          {interactionTypeLabels[interaction.interaction_type]}
                        </span>
                        <span className="text-xs text-gray-500">•</span>
                        <span className="text-xs text-gray-500">{interaction.user?.full_name}</span>
                      </div>
                      <p className="text-sm text-gray-700">{interaction.description}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(interaction.created_at).toLocaleString('pt-BR')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-4">Atualizar Estágio</h3>
            <select
              value={negotiation.stage}
              onChange={(e) => handleStageUpdate(e.target.value)}
              disabled={updating}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-4"
            >
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

            <h3 className="font-semibold text-gray-900 mb-4">Prioridade</h3>
            <div className="flex gap-2">
              {(['baixa', 'media', 'alta'] as const).map((priority) => (
                <button
                  key={priority}
                  onClick={() => handlePriorityUpdate(priority)}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${
                    negotiation.priority === priority
                      ? priority === 'alta'
                        ? 'bg-red-100 text-red-800'
                        : priority === 'media'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-gray-100 text-gray-800'
                      : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {priority}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Veículos na Troca</h3>
              <button
                onClick={() => setShowTradeInForm(true)}
                className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
              >
                <Plus className="w-4 h-4" />
                Adicionar
              </button>
            </div>

            {tradeInVehicles.length === 0 ? (
              <p className="text-sm text-gray-600">
                Registre o veículo usado que o cliente quer dar como parte do pagamento
              </p>
            ) : (
              <div className="space-y-4">
                {tradeInVehicles.map((vehicle) => (
                  <div key={vehicle.id} className="border border-gray-200 rounded-lg p-4">
                    {/* Mobile: Layout Vertical */}
                    <div className="md:hidden space-y-3">
                      <div className="flex items-start gap-3">
                        <Car className="w-5 h-5 text-gray-600 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="font-semibold text-gray-900">{vehicle.brand} {vehicle.model}</p>
                          <p className="text-sm text-gray-600">{vehicle.version}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-gray-600">Ano:</span>
                          <span className="ml-1 font-medium">{vehicle.year}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">KM:</span>
                          <span className="ml-1 font-medium">{vehicle.mileage?.toLocaleString('pt-BR')}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Placa:</span>
                          <span className="ml-1 font-medium">{vehicle.plate}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Cor:</span>
                          <span className="ml-1 font-medium capitalize">{vehicle.color}</span>
                        </div>
                      </div>
                      {vehicle.evaluated_value && (
                        <div className="pt-2 border-t border-gray-200">
                          <div className="text-sm">
                            <span className="text-gray-600">Avaliado:</span>
                            <span className="ml-2 font-semibold text-green-600">
                              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(vehicle.evaluated_value)}
                            </span>
                          </div>
                          {vehicle.offered_value && (
                            <div className="text-sm mt-1">
                              <span className="text-gray-600">Ofertado:</span>
                              <span className="ml-2 font-semibold text-blue-600">
                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(vehicle.offered_value)}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Desktop: Layout Horizontal (Tabela) */}
                    <div className="hidden md:grid md:grid-cols-6 md:gap-4 md:items-center">
                      <div className="col-span-2">
                        <p className="font-semibold text-gray-900">{vehicle.brand} {vehicle.model}</p>
                        <p className="text-sm text-gray-600">{vehicle.version}</p>
                      </div>
                      <div className="text-sm">
                        <p className="text-gray-600">Ano/KM</p>
                        <p className="font-medium">{vehicle.year} • {vehicle.mileage?.toLocaleString('pt-BR')} km</p>
                      </div>
                      <div className="text-sm">
                        <p className="text-gray-600">Placa/Cor</p>
                        <p className="font-medium capitalize">{vehicle.plate} • {vehicle.color}</p>
                      </div>
                      <div className="text-sm">
                        <p className="text-gray-600">Avaliado</p>
                        <p className="font-semibold text-green-600">
                          {vehicle.evaluated_value
                            ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(vehicle.evaluated_value)
                            : 'Pendente'}
                        </p>
                      </div>
                      <div className="text-sm">
                        <p className="text-gray-600">Ofertado</p>
                        <p className="font-semibold text-blue-600">
                          {vehicle.offered_value
                            ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(vehicle.offered_value)
                            : '-'}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-4">Veículo</h3>
            {negotiation.vehicle ? (
              <div>
                <p className="font-medium text-gray-900 mb-1">
                  {negotiation.vehicle.brand} {negotiation.vehicle.model}
                </p>
                <p className="text-sm text-gray-600 mb-3">{negotiation.vehicle.year}</p>
                <p className="text-lg font-semibold text-blue-600">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(negotiation.vehicle.sale_price)}
                </p>
                <Link
                  to={`/dashboard/vehicles/${negotiation.vehicle.id}`}
                  className="mt-4 block text-center px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
                >
                  Ver Detalhes do Veículo
                </Link>
              </div>
            ) : (
              <p className="text-gray-500 text-sm">Veículo não encontrado</p>
            )}
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-4">Vendedor Responsável</h3>
            <p className="text-gray-900">{negotiation.seller?.full_name || 'Não atribuído'}</p>
            <p className="text-sm text-gray-500 mt-1 capitalize">{negotiation.seller?.role}</p>
          </div>
        </div>
      </div>

      {showInteractionForm && negotiation && (
        <InteractionForm
          negotiationId={negotiation.id}
          vehicleId={negotiation.vehicle_id}
          onClose={() => {
            setShowInteractionForm(false);
            loadNegotiationDetails();
          }}
        />
      )}

      {showTradeInForm && negotiation && (
        <TradeInVehicleForm
          negotiationId={negotiation.id}
          companyId={negotiation.company_id || ''}
          onClose={() => {
            setShowTradeInForm(false);
            loadNegotiationDetails();
          }}
        />
      )}
    </div>
  );
}
