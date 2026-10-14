import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router';
import { supabase, Vehicle, VehicleCost, Negotiation } from '../../lib/supabase';
import {
  ArrowLeft,
  AlertCircle,
  Plus,
  Share2,
  Pencil,
  RefreshCw,
  Wrench,
  TrendingUp,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { CostForm } from '../components/CostForm';
import { VehicleForm } from '../components/VehicleForm';
import { NegotiationForm } from '../components/NegotiationForm';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { toast } from 'sonner';
import { formatFuel, formatPercent, formatTransmission, pluralize } from '../../lib/format';

const brl = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

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
  const { profile } = useAuth();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [costs, setCosts] = useState<VehicleCost[]>([]);
  const [negotiations, setNegotiations] = useState<Negotiation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCostForm, setShowCostForm] = useState(false);
  const [showVehicleForm, setShowVehicleForm] = useState(false);
  const [showNegotiationForm, setShowNegotiationForm] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);
  const photos = vehicle?.images ?? [];
  const activePhotoIndex = selectedPhotoIndex === null || photos.length === 0
    ? null
    : Math.min(selectedPhotoIndex, photos.length - 1);

  useEffect(() => {
    if (id) {
      loadVehicleDetails();
    }
  }, [id]);

  useEffect(() => {
    if (activePhotoIndex === null || photos.length < 2) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') {
        setSelectedPhotoIndex((current) => current === null ? null : (current - 1 + photos.length) % photos.length);
      } else if (event.key === 'ArrowRight') {
        setSelectedPhotoIndex((current) => current === null ? null : (current + 1) % photos.length);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activePhotoIndex, photos.length]);

  const loadVehicleDetails = async ({ silent = false }: { silent?: boolean } = {}) => {
    try {
      if (!silent) {
        setLoading(true);
        setError(null);
      }
      const [vehicleRes, costsRes, negotiationsRes] = await Promise.all([
        supabase.from('vehicles').select('*').eq('id', id).single(),
        supabase.from('vehicle_costs').select('*').eq('vehicle_id', id).order('service_date', { ascending: false }),
        supabase.from('negotiations').select('*').eq('vehicle_id', id).order('created_at', { ascending: false })
      ]);

      if (vehicleRes.error && vehicleRes.error.code !== 'PGRST116') {
        throw vehicleRes.error;
      }
      if (vehicleRes.data) setVehicle(vehicleRes.data);
      if (costsRes.error && costsRes.error.code !== '42P01') {
        throw costsRes.error;
      }
      if (costsRes.data) setCosts(costsRes.data);
      if (negotiationsRes.error && negotiationsRes.error.code !== '42P01') {
        throw negotiationsRes.error;
      }
      if (negotiationsRes.data) setNegotiations(negotiationsRes.data);
    } catch (err: any) {
      console.error('Error loading vehicle details:', err);
      const text = err?.message || 'Erro ao carregar detalhes do veículo.';
      if (silent) {
        toast.error(`Ação concluída, mas não foi possível atualizar os detalhes: ${text}`);
      } else {
        setError(text);
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  const sharePublicListing = async () => {
    if (!vehicle) return;
    const publicUrl = `${window.location.origin}/vehicles/${vehicle.id}`;
    try {
      await navigator.clipboard.writeText(publicUrl);
      toast.success('Link do anúncio copiado.');
    } catch {
      toast.error('Não foi possível copiar o link do anúncio.');
    }
  };

  const updateVehicleStatus = async (status: Vehicle['status']) => {
    if (!vehicle || status === vehicle.status || updatingStatus) return;
    setUpdatingStatus(true);
    try {
      const { error: updateError } = await supabase
        .from('vehicles')
        .update({ status })
        .eq('id', vehicle.id)
        .eq('company_id', profile!.company_id!);
      if (updateError) throw updateError;
      setVehicle({ ...vehicle, status });
      toast.success('Status do veículo atualizado.');
    } catch (err: any) {
      toast.error(err?.message || 'Não foi possível atualizar o status do veículo.');
    } finally {
      setUpdatingStatus(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" role="status">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        <span className="sr-only">Carregando detalhes do veículo...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div role="alert" className="text-center py-12">
        <AlertCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-foreground mb-2">Erro ao carregar veículo</h2>
        <p className="text-sm text-destructive/80 mb-6">{error}</p>
        <div className="flex justify-center gap-3">
          <Button variant="outline" onClick={() => loadVehicleDetails()}>
            <RefreshCw className="size-4" />
            Tentar novamente
          </Button>
          <Button asChild>
            <Link to="/dashboard/vehicles">Voltar para veículos</Link>
          </Button>
        </div>
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
  const breakEvenPrice = totalInvestment;
  const marginPercent = totalInvestment > 0 ? (potentialProfit / totalInvestment) * 100 : 0;
  const activeNegotiations = negotiations.filter(n => !['finalizado', 'perdido'].includes(n.stage));
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard/vehicles')} aria-label="Voltar">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-[32px] font-bold tracking-tight text-foreground truncate [font-family:var(--font-display)]">
            {vehicle.brand} {vehicle.model}
          </h1>
          {vehicle.plate && <span aria-label={`Placa ${vehicle.plate}`} className="overflow-hidden rounded border border-[#2A3038] text-center" style={{ backgroundColor: '#FFFFFF', color: '#111317' }}><span className="block bg-[#1F4FA8] px-2 text-[7px] font-bold leading-[9px] tracking-[0.2em] text-white">BRASIL</span><span className="block px-2 font-license-plate text-[19px] font-bold leading-[22px] tracking-wider" style={{ backgroundColor: '#FFFFFF', color: '#111317' }}>{vehicle.plate}</span></span>}
          </div>
          <p className="text-muted-foreground mt-1">
            {vehicle.year}
            {vehicle.version ? ` • ${vehicle.version}` : ''}
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          <label className="sr-only" htmlFor="vehicle-status">Status do veículo</label>
          <select
            id="vehicle-status"
            aria-label="Status do veículo"
            value={vehicle.status}
            disabled={updatingStatus}
            onChange={(event) => updateVehicleStatus(event.target.value as Vehicle['status'])}
            className="h-9 rounded-full border border-border bg-card px-3 text-sm font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
          >
            <option value="disponivel">Disponível</option>
            <option value="em_negociacao">Em negociação</option>
            <option value="vendido">Vendido</option>
          </select>
          <Button variant="outline" onClick={sharePublicListing}>
            <Share2 className="size-4" />Compartilhar
          </Button>
          <Button variant="outline" onClick={() => setShowVehicleForm(true)}>
            <Pencil className="size-4" />Editar
          </Button>
          <Button onClick={() => setShowNegotiationForm(true)}>
            <Plus className="size-4" />Nova negociação
          </Button>
        </div>
      </div>

      <section aria-label="Resumo do veículo" className="grid grid-cols-2 overflow-hidden rounded-xl border border-border bg-card sm:grid-cols-3 lg:grid-cols-5">
        {[
          { label: 'Ano / modelo', value: String(vehicle.year) },
          { label: 'Quilometragem', value: `${Number(vehicle.mileage || 0).toLocaleString('pt-BR')} km` },
          { label: 'Combustível', value: formatFuel(vehicle.fuel_type) || '—' },
          { label: 'Câmbio', value: formatTransmission(vehicle.transmission) || '—' },
          { label: 'Cor', value: vehicle.color || '—' },
        ].map((item) => <div key={item.label} className="border-b border-r border-border px-4 py-3 last:border-r-0 sm:px-5"><p className="text-xs text-muted-foreground">{item.label}</p><p className="mt-1 truncate text-[15px] font-semibold text-foreground">{item.value}</p></div>)}
      </section>

      {activeNegotiations.length > 0 && (
        <div className="bg-primary/10 border border-primary/30 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-foreground">Veículo em negociação</p>
              <p className="text-sm text-muted-foreground mt-1">
                Este veículo possui {pluralize(activeNegotiations.length, 'negociação ativa', 'negociações ativas')}.{' '}
                <Link to="/dashboard/negotiations" className="text-primary underline">
                  Ver negociações
                </Link>
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-start gap-6">
      <main className="min-w-0 flex-[999_1_560px] space-y-6">
      {photos.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Galeria de fotos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <button
              type="button"
              onClick={() => setSelectedPhotoIndex(0)}
              aria-label="Abrir foto principal ampliada"
              className="group relative block w-full overflow-hidden rounded-xl border border-border bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <img
                src={photos[0]}
                alt={`${vehicle.brand} ${vehicle.model} - Foto 1`}
                className="h-[clamp(15rem,50vw,34rem)] w-full object-contain transition-transform group-hover:scale-[1.02]"
              />
              <span className="absolute bottom-3 right-3 rounded-full bg-background/90 px-3 py-1 text-xs font-medium text-foreground shadow">
                1 / {photos.length}
              </span>
            </button>
            <div className="flex gap-3 overflow-x-auto pb-1">
              {photos.map((image, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => setSelectedPhotoIndex(index)}
                  aria-label={`Abrir foto ${index + 1} de ${photos.length}`}
                  aria-current={index === 0 ? 'true' : undefined}
                  className="relative h-20 w-28 shrink-0 overflow-hidden rounded-lg border-2 border-border transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-24 sm:w-36"
                >
                  <img
                    src={image}
                    alt={`${vehicle.brand} ${vehicle.model} - Foto ${index + 1}`}
                    className="h-full w-full object-cover transition-transform hover:scale-105"
                  />
                  <span className="absolute bottom-1 right-1 rounded-full bg-background/90 px-2 py-0.5 text-xs font-semibold text-foreground">
                    {index + 1}
                  </span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Custos e Manutenções</CardTitle>
          <Button size="sm" onClick={() => setShowCostForm(true)}>
            <Plus className="w-4 h-4" />Adicionar
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
                  {cost.service_date && <p className="text-xs text-muted-foreground mt-1">{new Date(cost.service_date).toLocaleDateString('pt-BR')}</p>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-border py-4"><CardTitle className="text-lg">Texto do anúncio</CardTitle>
          <Button variant="outline" size="sm" onClick={() => setShowVehicleForm(true)}><Pencil className="size-4" />Editar</Button>
        </CardHeader>
        <CardContent className="pt-4">
          <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-muted-foreground">{vehicle.description || 'Nenhum texto de anúncio cadastrado.'}</p>
        </CardContent>
      </Card>

      </main>
      <aside className="min-w-0 flex-[1_1_340px]">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0 border-b border-border py-4">
          <div>
            <p className="text-sm text-muted-foreground">Preço de venda</p>
            <p className="mt-1 text-[36px] font-bold leading-none tracking-tight text-foreground tabular-nums [font-family:var(--font-display)]">{brl(Number(vehicle.sale_price))}</p>
          </div>
          <Button variant="ghost" size="icon" aria-label="Editar preço de venda" onClick={() => setShowVehicleForm(true)}>
            <Pencil className="size-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-3 py-4">
          {[
            { label: 'Valor de compra', value: brl(Number(vehicle.purchase_price)) },
            { label: 'Custos e preparação', value: brl(totalCosts) },
            { label: 'Custo total · preço para empatar', value: brl(breakEvenPrice) },
            { label: potentialProfit < 0 ? 'Prejuízo estimado' : 'Lucro estimado', value: brl(potentialProfit), accent: true },
          ].map((item) => <div key={item.label} className="flex items-center justify-between gap-3 border-b border-border py-2 last:border-0"><p className="text-sm text-muted-foreground">{item.label}</p><p className={`text-right text-sm font-semibold tabular-nums ${item.accent ? (potentialProfit < 0 ? 'text-[#FF8C82]' : 'text-[#5BE3A0]') : 'text-foreground'}`}>{item.value}</p></div>)}
        </CardContent>
        <div className={`mx-3 mb-3 rounded-lg border p-3 text-sm ${potentialProfit < 0 ? 'border-[#4A221A] bg-[#24130F] text-[#FF8C82]' : 'border-[#1E4D36] bg-[#10261C] text-[#5BE3A0]'}`}>
          <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-2 font-semibold"><TrendingUp className="size-4" />Margem estimada</span>
          <span className="font-semibold tabular-nums">{formatPercent(marginPercent)} · {potentialProfit < 0 ? 'Abaixo do custo total' : 'Acima do custo total'}</span>
          </div>
          {potentialProfit < 0 && <p className="mt-2 text-xs text-[#E4C9C4]">Para empatar, venda por no mínimo <strong className="text-white">{brl(breakEvenPrice)}</strong>.</p>}
        </div>
      </Card>
      </aside>
      </div>

      {vehicle && (
        <CostForm
          open={showCostForm}
          vehicleId={vehicle.id}
          onClose={() => {
            setShowCostForm(false);
            loadVehicleDetails({ silent: true });
          }}
        />
      )}

      {vehicle && <VehicleForm open={showVehicleForm} vehicle={vehicle} onClose={() => { setShowVehicleForm(false); loadVehicleDetails({ silent: true }); }} />}
      {vehicle && <NegotiationForm open={showNegotiationForm} initialVehicle={vehicle} onClose={() => setShowNegotiationForm(false)} onCreated={(negotiationId) => navigate(`/dashboard/negotiations/${negotiationId}`)} />}

      <Dialog open={activePhotoIndex !== null} onOpenChange={(open) => { if (!open) setSelectedPhotoIndex(null); }}>
        <DialogContent className="max-h-[95vh] overflow-y-auto p-3 sm:max-w-5xl sm:p-5">
          <DialogHeader className="sr-only">
            <DialogTitle>Galeria de fotos do veículo</DialogTitle>
            <DialogDescription>
              {vehicle.brand} {vehicle.model}{activePhotoIndex !== null ? ` — Foto ${activePhotoIndex + 1} de ${photos.length}` : ''}
            </DialogDescription>
          </DialogHeader>
          {activePhotoIndex !== null && photos[activePhotoIndex] && (
            <div className="space-y-3">
              <div className="relative flex min-h-[45vh] items-center justify-center rounded-xl bg-muted">
                <img
                  src={photos[activePhotoIndex]}
                  alt={`${vehicle.brand} ${vehicle.model} - Foto ${activePhotoIndex + 1}`}
                  className="max-h-[68vh] w-full rounded-lg object-contain"
                />
                <span className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-background/90 px-3 py-1 text-sm font-medium text-foreground shadow">
                  {activePhotoIndex + 1} / {photos.length}
                </span>
                {photos.length > 1 && (
                  <>
                    <Button
                      type="button"
                      variant="secondary"
                      size="icon"
                      aria-label="Foto anterior"
                      className="absolute left-3 rounded-full shadow"
                      onClick={() => setSelectedPhotoIndex((activePhotoIndex - 1 + photos.length) % photos.length)}
                    >
                      <ChevronLeft className="size-5" />
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="icon"
                      aria-label="Próxima foto"
                      className="absolute right-3 rounded-full shadow"
                      onClick={() => setSelectedPhotoIndex((activePhotoIndex + 1) % photos.length)}
                    >
                      <ChevronRight className="size-5" />
                    </Button>
                  </>
                )}
              </div>
              <div className="flex gap-3 overflow-x-auto pb-1" aria-label="Todas as fotos">
                {photos.map((image, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => setSelectedPhotoIndex(index)}
                    aria-label={`Ver foto ${index + 1} de ${photos.length}`}
                    aria-current={index === activePhotoIndex ? 'true' : undefined}
                    className={`relative h-16 w-24 shrink-0 overflow-hidden rounded-lg border-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-20 sm:w-32 ${index === activePhotoIndex ? 'border-primary' : 'border-border hover:border-primary/60'}`}
                  >
                    <img src={image} alt="" className="h-full w-full object-cover" />
                    <span className="absolute bottom-1 right-1 rounded-full bg-background/90 px-2 py-0.5 text-xs font-semibold text-foreground">
                      {index + 1}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}



