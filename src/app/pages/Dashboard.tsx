import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { supabase, Vehicle, Negotiation } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  AlertCircle,
  ArrowUpRight,
  Car,
  Clock,
  Handshake,
  LayoutDashboard,
  Plus,
  RefreshCw,
  TrendingUp
} from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { EmptyState } from '../components/ui/empty-state';
import { PageHeader } from '../components/ui/page-header';
import { Skeleton } from '../components/ui/skeleton';
import { toast } from 'sonner';
import { formatPriority, formatStage, pluralize } from '../../lib/format';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '../components/ui/table';

type DashboardMetrics = {
  vehicles_available: number;
  vehicles_in_negotiation: number;
  vehicles_sold: number;
  active_negotiations: number;
  monthly_revenue: number;
  potential_profit: number;
};

const brl = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

const statusBadge: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  disponivel: { label: 'Disponível', variant: 'default' },
  em_negociacao: { label: 'Em negociação', variant: 'outline' },
  vendido: { label: 'Vendido', variant: 'outline' }
};

export function Dashboard() {
  const { profile } = useAuth();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [recentVehicles, setRecentVehicles] = useState<Vehicle[]>([]);
  const [recentNegotiations, setRecentNegotiations] = useState<Negotiation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.company_id) loadDashboardData();
  }, [profile?.company_id]);

  const loadDashboardData = async ({ silent = false }: { silent?: boolean } = {}) => {
    try {
      if (!silent) {
        setLoading(true);
        setError(null);
      }
      const companyId = profile?.company_id;
      if (!companyId) throw new Error('Usuário sem empresa vinculada.');

      const [vehiclesRes, negotiationsRes] = await Promise.all([
        supabase.from('vehicles').select('*').eq('company_id', companyId).order('created_at', { ascending: false }),
        supabase.from('negotiations').select('*').eq('company_id', companyId).order('created_at', { ascending: false })
      ]);

      if (vehiclesRes.error) throw vehiclesRes.error;
      if (negotiationsRes.error) throw negotiationsRes.error;

      const vehicles = vehiclesRes.data || [];
      const negotiations = negotiationsRes.data || [];
      setMetrics({
        vehicles_available: vehicles.filter((vehicle) => vehicle.status === 'disponivel').length,
        vehicles_in_negotiation: vehicles.filter((vehicle) => vehicle.status === 'em_negociacao').length,
        vehicles_sold: vehicles.filter((vehicle) => vehicle.status === 'vendido').length,
        active_negotiations: negotiations.filter((item) => !['finalizado', 'perdido'].includes(item.stage)).length,
        monthly_revenue: 0,
        potential_profit: vehicles
          .filter((vehicle) => vehicle.status !== 'vendido')
          .reduce((total, vehicle) => total + Number(vehicle.sale_price) - Number(vehicle.purchase_price), 0)
      });
      setRecentVehicles(vehicles.slice(0, 5));
      setRecentNegotiations(negotiations.slice(0, 5));
    } catch (err: any) {
      console.error('Error loading dashboard data:', err);
      const text = err?.message || 'Erro ao carregar dados do painel.';
      if (silent) {
        toast.error(`Ação concluída, mas não foi possível atualizar o painel: ${text}`);
      } else {
        setError(text);
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      </div>
    );
  }

  const statusData = [
    { name: 'Disponíveis', value: metrics?.vehicles_available || 0, color: 'var(--primary)' },
    { name: 'Em negociação', value: metrics?.vehicles_in_negotiation || 0, color: 'var(--muted-foreground)' },
    { name: 'Vendidos', value: metrics?.vehicles_sold || 0, color: 'var(--foreground)' }
  ];

  const statCards = [
    {
      title: 'Prontos para vender',
      value: metrics?.vehicles_available ?? 0,
      icon: Car,
      accent: true,
      description: pluralize(metrics?.vehicles_available ?? 0, 'veículo disponível', 'veículos disponíveis')
    },
    {
      title: 'Em negociação',
      value: metrics?.vehicles_in_negotiation ?? 0,
      icon: Clock,
      accent: false,
      description: pluralize(metrics?.vehicles_in_negotiation ?? 0, 'veículo em negociação', 'veículos em negociação')
    },
    {
      title: 'Pipeline ativo',
      value: metrics?.active_negotiations ?? 0,
      icon: Handshake,
      accent: false,
      description: pluralize(metrics?.active_negotiations ?? 0, 'negociação ativa', 'negociações ativas')
    },
    {
      title: 'Lucro potencial',
      value: brl(metrics?.potential_profit || 0),
      icon: TrendingUp,
      accent: false,
      description: 'Estimativa sobre estoque'
    }
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        icon={LayoutDashboard}
        eyebrow="Centro de comando"
        title={`Visão da loja${profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}`}
        description="Acompanhe estoque, oportunidades e resultado potencial sem depender de planilhas."
        action={(
          <Button asChild size="lg">
            <Link to="/dashboard/vehicles">
              <Plus className="size-4" />
              Adicionar veículo
            </Link>
          </Button>
        )}
      />

      {error ? (
        <div role="alert" className="flex flex-col gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-destructive sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 size-5 shrink-0" />
            <div>
              <p className="font-medium">Erro ao carregar dados do painel</p>
              <p className="text-sm text-destructive/80">{error}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => loadDashboardData()} className="w-fit">
            <RefreshCw className="size-4" />
            Tentar novamente
          </Button>
        </div>
      ) : null}

      <section aria-label="Indicadores da loja" className="grid grid-cols-2 overflow-hidden rounded-xl border border-border bg-card sm:grid-cols-4">
        {statCards.map((stat) => (
          <div key={stat.title} className="border-b border-r border-border px-4 py-4 last:border-r-0 sm:border-b-0 sm:px-5">
            <div className="flex items-center gap-2 text-[13px] text-muted-foreground"><stat.icon className="size-4" aria-hidden="true" />{stat.title}</div>
            <p className={`mt-2 truncate text-[28px] font-bold leading-none tabular-nums [font-family:var(--font-display)] ${stat.title === 'Lucro potencial' && (metrics?.potential_profit || 0) < 0 ? 'text-[#FF8C82]' : 'text-foreground'}`}>{stat.value}</p>
            <p className="mt-2 truncate text-xs text-muted-foreground">{stat.description}</p>
          </div>
        ))}
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Saúde do estoque</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div style={{ width: '100%', height: 256 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={52}
                    outerRadius={86}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} stroke="var(--card)" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: 'var(--popover)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius)',
                      color: 'var(--popover-foreground)'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul aria-label="Legenda da saúde do estoque" className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
              {statusData.map((item) => (
                <li key={item.name} className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-muted-foreground">
                  <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="min-w-0 flex-1 truncate">{item.name}</span>
                  <span className="font-semibold tabular-nums text-foreground">{item.value}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Entrada recente no estoque</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentVehicles.length === 0 ? (
              <EmptyState
                title="Seu estoque ainda está vazio"
                description="Adicione o primeiro veículo para acompanhar preço, status e negociações."
                action={<Button asChild><Link to="/dashboard/vehicles">Adicionar veículo</Link></Button>}
              />
            ) : (
              recentVehicles.map((vehicle) => {
                const b = statusBadge[vehicle.status] ?? statusBadge.disponivel;
                return (
                  <Link
                    key={vehicle.id}
                    to={`/dashboard/vehicles/${vehicle.id}`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card/60 p-3 transition-colors hover:border-primary/50 hover:bg-accent"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">
                        {vehicle.brand} {vehicle.model}
                      </p>
                      <p className="text-sm text-muted-foreground">{vehicle.year}</p>
                    </div>
                    <Badge variant={b.variant}>{b.label}</Badge>
                  </Link>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Negociações que merecem atenção</CardTitle>
          <Button asChild variant="ghost" size="sm">
            <Link to="/dashboard/negotiations">
              Abrir pipeline
              <ArrowUpRight className="size-4" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {recentNegotiations.length === 0 ? (
            <EmptyState
              icon={AlertCircle}
              title="Nenhuma oportunidade aberta"
              description="Quando uma conversa com cliente começar, ela aparece aqui com prioridade e etapa."
              action={<Button asChild><Link to="/dashboard/negotiations">Criar negociação</Link></Button>}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Etapa</TableHead>
                  <TableHead>Prioridade</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentNegotiations.map((negotiation) => (
                  <TableRow key={negotiation.id}>
                    <TableCell>
                      <Link
                        to={`/dashboard/negotiations/${negotiation.id}`}
                        className="font-medium text-foreground transition-colors hover:text-primary"
                      >
                        {negotiation.client_name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{formatStage(negotiation.stage)}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          negotiation.priority === 'alta'
                            ? 'destructive'
                            : negotiation.priority === 'media'
                              ? 'default'
                              : 'outline'
                        }
                        className="capitalize"
                      >
                        {formatPriority(negotiation.priority)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(negotiation.created_at).toLocaleDateString('pt-BR')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}



