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
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';

type NegotiationWithDetails = Negotiation & {
  vehicle?: Vehicle;
  seller?: Profile;
};

type InteractionWithUser = InteractionHistory & {
  user?: Profile;
};

const brl = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const stageLabels: Record<string, string> = {
  primeiro_contato: 'Primeiro Contato',
  avaliacao: 'Avaliação',
  test_drive_agendado: 'Test Drive Agendado',
  test_drive_realizado: 'Test Drive Realizado',
  proposta_enviada: 'Proposta Enviada',
  negociacao_preco: 'Negociação de Preço',
  aprovacao_credito: 'Aprovação de Crédito',
  documentacao: 'Documentação',
  finalizado: 'Finalizado',
  perdido: 'Perdido'
};

const stageVariant = (stage: string): 'default' | 'secondary' | 'destructive' =>
  stage === 'finalizado' ? 'default' : stage === 'perdido' ? 'destructive' : 'secondary';

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
      setMessage({ type: 'success', text: 'Estágio atualizado com sucesso.' });
      await loadNegotiationDetails();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Erro ao atualizar estágio.' });
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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!negotiation) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-foreground mb-2">Negociação não encontrada</h2>
        <Link to="/dashboard/negotiations" className="text-primary hover:underline">
          Voltar para negociações
        </Link>
      </div>
    );
  }

  const clientRows = [
    negotiation.client_phone && { icon: Phone, label: 'Telefone', value: negotiation.client_phone },
    negotiation.client_email && { icon: Mail, label: 'Email', value: negotiation.client_email },
    negotiation.client_cpf && { icon: FileText, label: 'CPF', value: negotiation.client_cpf },
    negotiation.offered_price && { icon: DollarSign, label: 'Valor Proposto', value: brl(negotiation.offered_price), accent: true }
  ].filter(Boolean) as { icon: any; label: string; value: string; accent?: boolean }[];

  return (
    <div className="space-y-6">
      {message && (
        <div className={`p-4 rounded-lg flex items-start gap-3 border ${
          message.type === 'success'
            ? 'bg-emerald-500/10 border-emerald-500/30'
            : 'bg-destructive/10 border-destructive/30'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
          )}
          <p className={`text-sm ${message.type === 'success' ? 'text-emerald-700 dark:text-emerald-300' : 'text-destructive'}`}>
            {message.text}
          </p>
        </div>
      )}

      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard/negotiations')} aria-label="Voltar">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-3xl font-bold tracking-tight text-foreground truncate">{negotiation.client_name}</h1>
          <p className="text-muted-foreground mt-1">
            {negotiation.vehicle && `${negotiation.vehicle.brand} ${negotiation.vehicle.model} ${negotiation.vehicle.year}`}
          </p>
        </div>
        <Badge variant={stageVariant(negotiation.stage)} className="text-sm shrink-0">
          {stageLabels[negotiation.stage] ?? negotiation.stage}
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Informações do Cliente</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {clientRows.map((row) => (
                  <div key={row.label} className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${row.accent ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'}`}>
                      <row.icon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm text-muted-foreground">{row.label}</p>
                      <p className="font-medium text-foreground truncate">{row.value}</p>
                    </div>
                  </div>
                ))}
              </div>

              {negotiation.notes && (
                <div className="mt-4 pt-4 border-t border-border">
                  <p className="text-sm text-muted-foreground mb-1">Observações</p>
                  <p className="text-foreground">{negotiation.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle>Histórico de Interações</CardTitle>
              <Button size="sm" onClick={() => setShowInteractionForm(true)}>
                <Plus className="w-4 h-4" />
                Adicionar
              </Button>
            </CardHeader>
            <CardContent>
              {interactions.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-8">Nenhuma interação registrada</p>
              ) : (
                <div className="space-y-4">
                  {interactions.map((interaction) => (
                    <div key={interaction.id} className="flex gap-4 pb-4 border-b border-border last:border-0">
                      <div className="w-10 h-10 bg-muted rounded-full flex items-center justify-center shrink-0">
                        <MessageSquare className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-foreground">
                            {interactionTypeLabels[interaction.interaction_type]}
                          </span>
                          <span className="text-xs text-muted-foreground">â€¢</span>
                          <span className="text-xs text-muted-foreground">{interaction.user?.full_name || 'Usuário'}</span>
                        </div>
                        <p className="text-sm text-foreground">{interaction.description}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(interaction.created_at).toLocaleString('pt-BR')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <h3 className="font-semibold text-foreground">Atualizar Estágio</h3>
                <select
                  value={negotiation.stage}
                  onChange={(e) => handleStageUpdate(e.target.value)}
                  disabled={updating}
                  className="w-full h-9 px-3 rounded-md border border-input bg-input-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                >
                  {Object.entries(stageLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold text-foreground">Prioridade</h3>
                <div className="flex gap-2">
                  {(['baixa', 'media', 'alta'] as const).map((priority) => (
                    <Button
                      key={priority}
                      variant={negotiation.priority === priority ? (priority === 'alta' ? 'destructive' : 'default') : 'outline'}
                      size="sm"
                      className="flex-1 capitalize"
                      onClick={() => handlePriorityUpdate(priority)}
                    >
                      {priority}
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">Veículos na Troca</CardTitle>
              <Button size="sm" variant="secondary" onClick={() => setShowTradeInForm(true)} disabled={!tradeInAvailable}>
                <Plus className="w-4 h-4" />
                Adicionar
              </Button>
            </CardHeader>
            <CardContent>
              {!tradeInAvailable ? (
                <p className="text-sm text-muted-foreground">
                  Módulo de troca ainda não configurado no banco. Execute o SQL complementar para habilitar esta área.
                </p>
              ) : tradeInVehicles.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Registre o veículo usado que o cliente quer dar como parte do pagamento.
                </p>
              ) : (
                <div className="space-y-4">
                  {tradeInVehicles.map((vehicle) => (
                    <div key={vehicle.id} className="border border-border rounded-lg p-4">
                      <div className="flex items-start gap-3 mb-3">
                        <Car className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-foreground">{vehicle.brand} {vehicle.model}</p>
                          <p className="text-sm text-muted-foreground">{vehicle.version}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div><span className="text-muted-foreground">Ano:</span> <span className="font-medium text-foreground">{vehicle.year}</span></div>
                        <div><span className="text-muted-foreground">KM:</span> <span className="font-medium text-foreground">{vehicle.mileage?.toLocaleString('pt-BR')}</span></div>
                        <div><span className="text-muted-foreground">Placa:</span> <span className="font-medium text-foreground">{vehicle.plate}</span></div>
                        <div><span className="text-muted-foreground">Cor:</span> <span className="font-medium text-foreground capitalize">{vehicle.color}</span></div>
                        <div><span className="text-muted-foreground">Avaliado:</span> <span className="font-semibold text-primary">{vehicle.evaluated_value ? brl(vehicle.evaluated_value) : 'Pendente'}</span></div>
                        <div><span className="text-muted-foreground">Ofertado:</span> <span className="font-semibold text-foreground">{vehicle.offered_value ? brl(vehicle.offered_value) : '-'}</span></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Veículo</CardTitle>
            </CardHeader>
            <CardContent>
              {negotiation.vehicle ? (
                <div>
                  <p className="font-medium text-foreground mb-1">
                    {negotiation.vehicle.brand} {negotiation.vehicle.model}
                  </p>
                  <p className="text-sm text-muted-foreground mb-3">{negotiation.vehicle.year}</p>
                  <p className="text-lg font-semibold text-primary">{brl(negotiation.vehicle.sale_price)}</p>
                  <Button asChild variant="secondary" className="w-full mt-4">
                    <Link to={`/dashboard/vehicles/${negotiation.vehicle.id}`}>Ver Detalhes do Veículo</Link>
                  </Button>
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">Veículo não encontrado</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Vendedor Responsável</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-foreground">{negotiation.seller?.full_name || 'Não atribuído'}</p>
              <p className="text-sm text-muted-foreground mt-1 capitalize">{negotiation.seller?.role}</p>
            </CardContent>
          </Card>
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



