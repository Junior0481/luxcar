import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router';
import { supabase, Vehicle, VehicleCost, Negotiation } from '../../lib/supabase';
import {
  ArrowLeft,
  DollarSign,
  AlertCircle,
  Plus,
  Wrench,
  TrendingUp
} from 'lucide-react';
import { CostForm } from '../components/CostForm';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';

const brl = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const statusBadge: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  disponivel: { label: 'Disponível', variant: 'default' },
  em_negociacao: { label: 'Em Negociação', variant: 'secondary' },
  vendido: { label: 'Vendido', variant: 'outline' }
};

const costTypeLabels: Record<string, string> = {
  manutencao: 'Manutenção',
  estetica: 'Estética',
  mecanica: 'Mecânica',
  revisao: 'Revisão',
  laudo: 'Laudo',
  outro: 'Outro'
};

export function VehicleDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [costs, setCosts] = useState<VehicleCost[]>([]);
  const [negotiations, setNegotiations] = useState<Negotiation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCostForm, setShowCostForm] = useState(false);

  useEffect(() => {
    if (id) {
      loadVehicleDetails();
    }
  }, [id]);

  const loadVehicleDetails = async () => {
    try {
      const [vehicleRes, costsRes, negotiationsRes] = await Promise.all([
        supabase.from('vehicles').select('*').eq('id', id).single(),
        supabase.from('vehicle_costs').select('*').eq('vehicle_id', id).order('service_date', { ascending: false }),
        supabase.from('negotiations').select('*').eq('vehicle_id', id).order('created_at', { ascending: false })
      ]);

      if (vehicleRes.data) setVehicle(vehicleRes.data);
      if (costsRes.data) setCosts(costsRes.data);
      if (negotiationsRes.data) setNegotiations(negotiationsRes.data);
    } catch (error) {
      console.error('Error loading vehicle details:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!vehicle) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-foreground mb-2">Veículo não encontrado</h2>
        <Link to="/dashboard/vehicles" className="text-primary hover:underline">
          Voltar para veículos
        </Link>
      </div>
    );
  }

  const totalCosts = costs.reduce((sum, cost) => sum + Number(cost.amount), 0);
  const totalInvestment = Number(vehicle.purchase_price) + totalCosts;
  const potentialProfit = Number(vehicle.sale_price) - totalInvestment;
  const activeNegotiations = negotiations.filter(n => !['finalizado', 'perdido'].includes(n.stage));
  const b = statusBadge[vehicle.status] ?? statusBadge.disponivel;

  const infoRows = [
    vehicle.color && { label: 'Cor', value: vehicle.color },
    vehicle.plate && { label: 'Placa', value: vehicle.plate },
    vehicle.mileage && { label: 'Quilometragem', value: `${vehicle.mileage.toLocaleString('pt-BR')} km` },
    vehicle.fuel_type && { label: 'Combustível', value: vehicle.fuel_type, capitalize: true },
    vehicle.transmission && { label: 'Transmissão', value: vehicle.transmission, capitalize: true }
  ].filter(Boolean) as { label: string; value: string; capitalize?: boolean }[];

  const metricCards = [
    { label: 'Valor de Compra', value: brl(Number(vehicle.purchase_price)), icon: DollarSign, accent: false },
    { label: 'Custos Adicionais', value: brl(totalCosts), icon: Wrench, accent: false },
    { label: 'Valor de Venda', value: brl(Number(vehicle.sale_price)), icon: DollarSign, accent: false },
    { label: 'Lucro Estimado', value: brl(potentialProfit), icon: TrendingUp, accent: true, negative: potentialProfit < 0 }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard/vehicles')} aria-label="Voltar">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="min-w-0">
          <h1 className="text-3xl font-bold tracking-tight text-foreground truncate">
            {vehicle.brand} {vehicle.model}
          </h1>
          <p className="text-muted-foreground mt-1">
            {vehicle.year}
            {vehicle.version ? ` • ${vehicle.version}` : ''}
          </p>
        </div>
        <div className="ml-auto shrink-0">
          <Badge variant={b.variant} className="text-sm">{b.label}</Badge>
        </div>
      </div>

      {activeNegotiations.length > 0 && (
        <div className="bg-primary/10 border border-primary/30 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-foreground">Veículo em negociação</p>
              <p className="text-sm text-muted-foreground mt-1">
                Este veículo possui {activeNegotiations.length} negociação(ões) ativa(s).{' '}
                <Link to="/dashboard/negotiations" className="text-primary underline">
                  Ver negociações
                </Link>
              </p>
            </div>
          </div>
        </div>
      )}

      {vehicle.images && vehicle.images.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Galeria de Fotos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {vehicle.images.map((image, index) => (
                <div
                  key={index}
                  className="aspect-square overflow-hidden rounded-lg border-2 border-border hover:border-primary transition-colors cursor-pointer"
                >
                  <img
                    src={image}
                    alt={`${vehicle.brand} ${vehicle.model} - Foto ${index + 1}`}
                    className="w-full h-full object-cover hover:scale-110 transition-transform"
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {metricCards.map((m) => (
          <Card key={m.label}>
            <CardContent>
              <div className="flex items-center gap-2 mb-2">
                <m.icon className={`w-5 h-5 ${m.accent ? 'text-primary' : 'text-muted-foreground'}`} />
                <span className="text-sm text-muted-foreground">{m.label}</span>
              </div>
              <p
                className={`text-2xl font-bold ${
                  m.negative ? 'text-destructive' : m.accent ? 'text-primary' : 'text-foreground'
                }`}
              >
                {m.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Informações do Veículo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {infoRows.map((row) => (
              <div key={row.label} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <span className="text-muted-foreground">{row.label}</span>
                <span className={`font-medium text-foreground ${row.capitalize ? 'capitalize' : ''}`}>{row.value}</span>
              </div>
            ))}
            {vehicle.description && (
              <div className="py-2">
                <p className="text-muted-foreground mb-1">Descrição</p>
                <p className="text-foreground">{vehicle.description}</p>
              </div>
            )}
            {infoRows.length === 0 && !vehicle.description && (
              <p className="text-muted-foreground text-sm py-4 text-center">Sem informações adicionais</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>Custos e Manutenções</CardTitle>
            <Button size="sm" onClick={() => setShowCostForm(true)}>
              <Plus className="w-4 h-4" />
              Adicionar
            </Button>
          </CardHeader>
          <CardContent>
            {costs.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-8">Nenhum custo registrado</p>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {costs.map((cost) => (
                  <div key={cost.id} className="p-3 bg-muted rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-foreground">{costTypeLabels[cost.cost_type]}</span>
                      <span className="font-semibold text-foreground">{brl(Number(cost.amount))}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{cost.description}</p>
                    {cost.service_date && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(cost.service_date).toLocaleDateString('pt-BR')}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {showCostForm && vehicle && (
        <CostForm
          vehicleId={vehicle.id}
          onClose={() => {
            setShowCostForm(false);
            loadVehicleDetails();
          }}
        />
      )}
    </div>
  );
}
