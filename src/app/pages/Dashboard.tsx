import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { supabase, Vehicle, Negotiation } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  Car,
  Handshake,
  TrendingUp,
  Clock,
  Plus,
  ArrowUpRight
} from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
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
  em_negociacao: { label: 'Em Negociação', variant: 'secondary' },
  vendido: { label: 'Vendido', variant: 'outline' }
};

const stageBadge: Record<string, string> = {
  primeiro_contato: 'Primeiro Contato',
  avaliacao: 'Avaliação',
  test_drive_agendado: 'Test Drive Agendado',
  test_drive_realizado: 'Test Drive Realizado',
  proposta_enviada: 'Proposta Enviada',
  negociacao_preco: 'Negociação Preço',
  aprovacao_credito: 'Aprovação Crédito',
  documentacao: 'Documentação',
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
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  const statusData = [
    { name: 'Disponíveis', value: metrics?.vehicles_available || 0, color: 'var(--primary)' },
    { name: 'Em Negociação', value: metrics?.vehicles_in_negotiation || 0, color: 'var(--muted-foreground)' },
    { name: 'Vendidos', value: metrics?.vehicles_sold || 0, color: 'var(--foreground)' }
  ];

  const statCards = [
    { title: 'Veículos Disponíveis', value: metrics?.vehicles_available ?? 0, icon: Car, accent: true },
    { title: 'Em Negociação', value: metrics?.vehicles_in_negotiation ?? 0, icon: Clock, accent: false },
    { title: 'Negociações Ativas', value: metrics?.active_negotiations ?? 0, icon: Handshake, accent: false },
    { title: 'Lucro Potencial', value: brl(metrics?.potential_profit || 0), icon: TrendingUp, accent: false }
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Bem-vindo, {profile?.full_name}</p>
        </div>
        <Button asChild size="lg">
          <Link to="/dashboard/vehicles">
            <Plus className="w-4 h-4" />
            Cadastrar Veículo
          </Link>
        </Button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.title} className="transition-shadow hover:shadow-md">
            <CardContent className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground truncate">{stat.title}</p>
                <p className="text-2xl font-bold text-foreground mt-1 truncate">{stat.value}</p>
              </div>
              <div
                className={`shrink-0 w-12 h-12 rounded-xl flex items-center justify-center ${
                  stat.accent ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
                }`}
              >
                <stat.icon className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts + recent vehicles */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Status dos Veículos</CardTitle>
          </CardHeader>
          <CardContent>
            <div style={{ width: '100%', height: 256 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}`}
                    innerRadius={48}
                    outerRadius={84}
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Veículos Recentes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentVehicles.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-8">Nenhum veículo cadastrado ainda</p>
            ) : (
              recentVehicles.map((vehicle) => {
                const b = statusBadge[vehicle.status] ?? statusBadge.disponivel;
                return (
                  <Link
                    key={vehicle.id}
                    to={`/dashboard/vehicles/${vehicle.id}`}
                    className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border hover:border-primary/50 hover:bg-accent transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-foreground truncate">
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

      {/* Recent negotiations */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Negociações Recentes</CardTitle>
          <Button asChild variant="ghost" size="sm">
            <Link to="/dashboard/negotiations">
              Ver todas
              <ArrowUpRight className="w-4 h-4" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {recentNegotiations.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-8">Nenhuma negociação iniciada ainda</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Estágio</TableHead>
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
                          className="font-medium text-foreground hover:text-primary transition-colors"
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
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
