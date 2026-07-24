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
  TrendingUp
} from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { EmptyState } from '../components/ui/empty-state';
import { MetricCard } from '../components/ui/metric-card';
import { PageHeader } from '../components/ui/page-header';
import { Skeleton } from '../components/ui/skeleton';
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
  disponível: { label: 'Disponível', variant: 'default' },
  em_negociação: { label: 'Em negociação', variant: 'secondary' },
  vendido: { label: 'Vendido', variant: 'outline' }
};

const stageBadge: Record<string, string> = {
  primeiro_contato: 'Primeiro contato',
  avaliação: 'Avaliação',
  test_drive_agendado: 'Test drive agendado',
  test_drive_realizado: 'Test drive realizado',
  proposta_enviada: 'Proposta enviada',
  negociação_preço: 'Negociação de preço',
  aprovação_credito: 'Aprovação de crédito',
  documentação: 'Documentação',
  finalizado: 'Finalizado',
  perdido: 'Perdido'
};

export function Dashboard() {
  const { profile } = useAuth();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [recentVehicles, setRecentVehicles] = useState<Vehicle[]>([]);
  const [recentNegotiations, setRecentNegotiations] = useState<Negotiation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const [metricsRes, vehiclesRes, negotiationsRes] = await Promise.all([
        supabase.from('dashboard_metrics').select('*').single(),
        supabase.from('vehicles').select('*').order('created_at', { ascending: false }).limit(5),
        supabase.from('negotiations').select('*').order('created_at', { ascending: false }).limit(5)
      ]);

      if (metricsRes.data) setMetrics(metricsRes.data);
      if (vehiclesRes.data) setRecentVehicles(vehiclesRes.data);
      if (negotiationsRes.data) setRecentNegotiations(negotiationsRes.data);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
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
    { name: 'Disponiveis', value: metrics?.vehicles_available || 0, color: 'var(--primary)' },
    { name: 'Em negociação', value: metrics?.vehicles_in_negotiation || 0, color: 'var(--muted-foreground)' },
    { name: 'Vendidos', value: metrics?.vehicles_sold || 0, color: 'var(--foreground)' }
  ];

  const statCards = [
    {
      title: 'Prontos para vender',
      value: metrics?.vehicles_available ?? 0,
      icon: Car,
      accent: true,
      description: 'Estoque disponível agora'
    },
    {
      title: 'Em negociação',
      value: metrics?.vehicles_in_negotiation ?? 0,
      icon: Clock,
      accent: false,
      description: 'Veiculos com conversa ativa'
    },
    {
      title: 'Pipeline ativo',
      value: metrics?.active_negotiations ?? 0,
      icon: Handshake,
      accent: false,
      description: 'Oportunidades abertas'
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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <MetricCard
            key={stat.title}
            title={stat.title}
            value={stat.value}
            description={stat.description}
            icon={stat.icon}
            accent={stat.accent}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Saude do estoque</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div style={{ width: '100%', height: 256 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}`}
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
            <div className="grid grid-cols-3 gap-2 text-center text-xs text-muted-foreground">
              {statusData.map((item) => (
                <div key={item.name} className="rounded-xl bg-muted/50 p-3">
                  <p className="text-lg font-medium text-foreground">{item.value}</p>
                  <p>{item.name}</p>
                </div>
              ))}
            </div>
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
                const b = statusBadge[vehicle.status] ?? statusBadge.disponível;
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
                      <Badge variant="secondary">{stageBadge[negotiation.stage] ?? negotiation.stage}</Badge>
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
                        {negotiation.priority}
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



