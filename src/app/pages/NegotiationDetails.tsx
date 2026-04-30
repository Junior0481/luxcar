import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router';
import { supabase, Negotiation, Vehicle, Profile, InteractionHistory, TradeInVehicle } from '../../lib/supabase';
import {
  ArrowLeft,
  Phone,
  Mail,
  FileText,
  DollarSign,
  AlertCircle,
  CheckCircle,
  Plus,
  MessageSquare,
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
  const navigate = useNavigate();
  const [negotiation, setNegotiation] = useState<NegotiationWithDetails | null>(null);
  const [interactions, setInteractions] = useState<InteractionWithUser[]>([]);
  const [tradeInVehicles, setTradeInVehicles] = useState<TradeInVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInteractionForm, setShowInteractionForm] = useState(false);
  const [showTradeInForm, setShowTradeInForm] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [tradeInAvailable, setTradeInAvailable] = useState(true);

  useEffect(() => {
    if (id) {
      loadNegotiationDetails();
    }
  }, [id]);

  const loadNegotiationDetails = async () => {
    try {
      const [negotiationRes, interactionsRes] = await Promise.all([
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
          .order('created_at', { ascending: false })
      ]);

      if (negotiationRes.data) setNegotiation(negotiationRes.data);
      if (interactionsRes.data) setInteractions(interactionsRes.data);

      const tradeInRes = await supabase
        .from('trade_in_vehicles')
        .select('*')
        .eq('negotiation_id', id)
        .order('created_at', { ascending: false });

      if (tradeInRes.error?.code === '42P01') {
        setTradeInAvailable(false);
        setTradeInVehicles([]);
      } else if (tradeInRes.error) {
        throw tradeInRes.error;
      } else {
        setTradeInAvailable(true);
        setTradeInVehicles(tradeInRes.data || []);
      }
    } catch (error) {
      console.error('Error loading negotiation details:', error);
    } finally {
      setLoading(false);
    }
  };

  const syncVehicleAndSaleForStage = async (nextStage: string, current: NegotiationWithDetails) => {
    if (nextStage === 'finalizado') {
      const { error: vehicleError } = await supabase
        .from('vehicles')
        .update({ status: 'vendido' })
        .eq('id', current.vehicle_id);

      if (vehicleError) throw vehicleError;

      const { data: existingSale, error: saleLookupError } = await supabase
        .from('sales')
        .select('id')
        .eq('negotiation_id', current.id)
        .maybeSingle();

      if (saleLookupError) throw saleLookupError;

      if (!existingSale) {
        const { error: saleInsertError } = await supabase
          .from('sales')
          .insert([{
            negotiation_id: current.id,
            vehicle_id: current.vehicle_id,
            seller_id: current.seller_id,
            final_price: current.offered_price || current.vehicle?.sale_price || 0,
            payment_method: 'a_definir',
            commission: null,
            sale_date: new Date().toISOString().split('T')[0]
          }]);

        if (saleInsertError) throw saleInsertError;
      }

      return;
    }

    const nextVehicleStatus = nextStage === 'perdido' ? 'disponivel' : 'em_negociacao';

    const { error: vehicleError } = await supabase
      .from('vehicles')
      .update({ status: nextVehicleStatus })
      .eq('id', current.vehicle_id);

    if (vehicleError) throw vehicleError;
  };

  const handleStageUpdate = async (newStage: string) => {
    if (!negotiation) return;

    setUpdating(true);
    setMessage(null);

    try {
      const { error } = await supabase
        .from('negotiations')
        .update({ stage: newStage })
        .eq('id', negotiation.id);

      if (error) throw error;

      await syncVehicleAndSaleForStage(newStage, negotiation);
      setMessage({ type: 'success', text: 'Estagio atualizado com sucesso.' });
      await loadNegotiationDetails();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Erro ao atualizar estagio.' });
    } finally {
      setUpdating(false);
    }
  };

  const handlePriorityUpdate = async (newPriority: 'baixa' | 'media' | 'alta') => {
    if (!negotiation) return;

    setMessage(null);

    try {
      const { error } = await supabase
        .from('negotiations')
        .update({ priority: newPriority })
        .eq('id', negotiation.id);

      if (error) throw error;

      setMessage({ type: 'success', text: 'Prioridade atualizada com sucesso.' });
      await loadNegotiationDetails();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Erro ao atualizar prioridade.' });
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
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Negociacao nao encontrada</h2>
        <Link to="/dashboard/negotiations" className="text-blue-600 hover:text-blue-700">
          Voltar para negociacoes
        </Link>
      </div>
    );
  }

  const getStageBadge = (stage: string) => {
    const stages: Record<string, { label: string; className: string }> = {
      primeiro_contato: { label: 'Primeiro Contato', className: 'bg-[#f3f3f3] text-[#555459]' },
      avaliacao: { label: 'Avaliacao', className: 'bg-[#fff2df] text-[#010101]' },
      test_drive_agendado: { label: 'Test Drive Agendado', className: 'bg-[#efefef] text-[#555459]' },
      test_drive_realizado: { label: 'Test Drive Realizado', className: 'bg-[#ffe3be] text-[#010101]' },
      proposta_enviada: { label: 'Proposta Enviada', className: 'bg-[#fff2df] text-[#010101]' },
      negociacao_preco: { label: 'Negociacao de Preco', className: 'bg-[#efefef] text-[#555459]' },
      aprovacao_credito: { label: 'Aprovacao de Credito', className: 'bg-[#ffe3be] text-[#010101]' },
      documentacao: { label: 'Documentacao', className: 'bg-[#f3f3f3] text-[#555459]' },
      finalizado: { label: 'Finalizado', className: 'bg-[#010101] text-white' },
      perdido: { label: 'Perdido', className: 'bg-red-100 text-red-800' }
    };

    const badge = stages[stage] || stages.primeiro_contato;
    return <span className={`px-3 py-1 text-sm font-medium rounded-full ${badge.className}`}>{badge.label}</span>;
  };

  const interactionTypeLabels: Record<string, string> = {
    ligacao: 'Ligacao',
    whatsapp: 'WhatsApp',
    email: 'Email',
    visita: 'Visita',
    test_drive: 'Test Drive',
    proposta: 'Proposta',
    observacao: 'Observacao',
    outro: 'Outro'
  };

  return (
    <div className="space-y-6">
      {message && (
        <div className={`p-4 rounded-lg flex items-start gap-3 ${
          message.type === 'success'
            ? 'bg-green-50 border border-green-200'
            : 'bg-red-50 border border-red-200'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          )}
          <p className={`text-sm ${
            message.type === 'success' ? 'text-green-800' : 'text-red-800'
          }`}>
            {message.text}
          </p>
        </div>
      )}

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
            <h2 className="text-xl font-bold text-gray-900 mb-4">Informacoes do Cliente</h2>
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
                  <div className="w-10 h-10 bg-[#fff2df] rounded-lg flex items-center justify-center">
                    <Mail className="w-5 h-5 text-[#f8a746]" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Email</p>
                    <p className="font-medium text-gray-900">{negotiation.client_email}</p>
                  </div>
                </div>
              )}

              {negotiation.client_cpf && (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                    <FileText className="w-5 h-5 text-gray-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">CPF</p>
                    <p className="font-medium text-gray-900">{negotiation.client_cpf}</p>
                  </div>
                </div>
              )}

              {negotiation.offered_price && (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#fff2df] rounded-lg flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-[#f8a746]" />
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
                <p className="text-sm text-gray-600 mb-1">Observacoes</p>
                <p className="text-gray-900">{negotiation.notes}</p>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Historico de Interacoes</h2>
              <button
                onClick={() => setShowInteractionForm(true)}
                className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
              >
                <Plus className="w-4 h-4" />
                Adicionar
              </button>
            </div>

            {interactions.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-8">Nenhuma interacao registrada</p>
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
                        <span className="text-xs text-gray-500">{interaction.user?.full_name || 'Usuario'}</span>
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
            <h3 className="font-semibold text-gray-900 mb-4">Atualizar Estagio</h3>
            <select
              value={negotiation.stage}
              onChange={(e) => handleStageUpdate(e.target.value)}
              disabled={updating}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-4"
            >
              <option value="primeiro_contato">Primeiro Contato</option>
              <option value="avaliacao">Avaliacao</option>
              <option value="test_drive_agendado">Test Drive Agendado</option>
              <option value="test_drive_realizado">Test Drive Realizado</option>
              <option value="proposta_enviada">Proposta Enviada</option>
              <option value="negociacao_preco">Negociacao Preco</option>
              <option value="aprovacao_credito">Aprovacao Credito</option>
              <option value="documentacao">Documentacao</option>
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
                        ? 'bg-[#fff2df] text-[#010101]'
                        : 'bg-[#f3f3f3] text-[#555459]'
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
              <h3 className="font-semibold text-gray-900">Veiculos na Troca</h3>
              <button
                onClick={() => setShowTradeInForm(true)}
                disabled={!tradeInAvailable}
                className="flex items-center gap-2 px-3 py-2 bg-[#555459] text-white rounded-lg hover:bg-[#3e3d41] transition-colors text-sm"
              >
                <Plus className="w-4 h-4" />
                Adicionar
              </button>
            </div>

            {!tradeInAvailable ? (
              <p className="text-sm text-gray-600">
                Modulo de troca ainda nao configurado no banco. Execute o SQL complementar para habilitar esta area.
              </p>
            ) : tradeInVehicles.length === 0 ? (
              <p className="text-sm text-gray-600">
                Registre o veiculo usado que o cliente quer dar como parte do pagamento.
              </p>
            ) : (
              <div className="space-y-4">
                {tradeInVehicles.map((vehicle) => (
                  <div key={vehicle.id} className="border border-gray-200 rounded-lg p-4">
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
                    </div>

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
                        <p className="font-semibold text-[#f8a746]">
                          {vehicle.evaluated_value
                            ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(vehicle.evaluated_value)
                            : 'Pendente'}
                        </p>
                      </div>
                      <div className="text-sm">
                        <p className="text-gray-600">Ofertado</p>
                        <p className="font-semibold text-gray-900">
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
            <h3 className="font-semibold text-gray-900 mb-4">Veiculo</h3>
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
                  Ver Detalhes do Veiculo
                </Link>
              </div>
            ) : (
              <p className="text-gray-500 text-sm">Veiculo nao encontrado</p>
            )}
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-4">Vendedor Responsavel</h3>
            <p className="text-gray-900">{negotiation.seller?.full_name || 'Nao atribuido'}</p>
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
