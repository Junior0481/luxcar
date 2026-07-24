import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { BarChart3, Car, DollarSign, Handshake, TrendingUp } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Label } from '../components/ui/label';
import { Input } from '../components/ui/input';
import { EmptyState } from '../components/ui/empty-state';
import { MetricCard } from '../components/ui/metric-card';
import { PageHeader } from '../components/ui/page-header';
import { Skeleton } from '../components/ui/skeleton';

type MonthSale = { id: string; month: string; vendas: number };
type SellerSale = { id: string; name: string; count: number; revenue: number };
type VehicleSale = { id: string; veículo: string; vendas: number };

const brl = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

const axisStyle = { fill: 'var(--muted-foreground)', fontSize: 12 };
const tooltipStyle = {
  background: 'var(--popover)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  color: 'var(--popover-foreground)'
};

export function Reports() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });
  const [metrics, setMetrics] = useState({
    totalSales: 0,
    totalRevenue: 0,
    totalProfit: 0,
    avgDaysToSell: 0,
    conversionRate: 0
  });
  const [salesByMonth, setSalesByMonth] = useState<MonthSale[]>([]);
  const [salesBySeller, setSalesBySeller] = useState<SellerSale[]>([]);
  const [topVehicles, setTopVehicles] = useState<VehicleSale[]>([]);

  useEffect(() => {
    loadReports();
  }, [dateRange]);

  const loadReports = async () => {
    try {
      let salesQuery = supabase
        .from('sales')
        .select(`
          *,
          vehicle:vehicles(*),
          seller:profiles(*)
        `)
        .gte('sale_date', dateRange.start)
        .lte('sale_date', dateRange.end);

      let negotiationsQuery = supabase
        .from('negotiations')
        .select('*')
        .gte('created_at', dateRange.start)
        .lte('created_at', dateRange.end);

      if (profile?.company_id) {
        salesQuery = salesQuery.eq('company_id', profile.company_id);
        negotiationsQuery = negotiationsQuery.eq('company_id', profile.company_id);
      }

      const [{ data: sales }, { data: negotiations }] = await Promise.all([
        salesQuery,
        negotiationsQuery
      ]);

      if (sales) {
        const totalRevenue = sales.reduce((sum, sale) => sum + Number(sale.final_price), 0);
        const totalProfit = sales.reduce((sum, sale) => {
          const purchasePrice = sale.vehicle?.purchase_price || 0;
          return sum + (Number(sale.final_price) - Number(purchasePrice));
        }, 0);

        setMetrics({
          totalSales: sales.length,
          totalRevenue,
          totalProfit,
          avgDaysToSell: 0,
          conversionRate: negotiations && negotiations.length > 0 ? (sales.length / negotiations.length) * 100 : 0
        });

        const salesByMonthMap = new Map<string, number>();
        sales.forEach(sale => {
          const month = new Date(sale.sale_date).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
          salesByMonthMap.set(month, (salesByMonthMap.get(month) || 0) + 1);
        });
        setSalesByMonth(
          Array.from(salesByMonthMap.entries())
            .map(([month, count]) => ({ month, vendas: count }))
            .sort((a, b) => a.month.localeCompare(b.month))
            .map((item, index) => ({ ...item, id: `month-${index}` }))
        );

        const sellerMap = new Map<string, { name: string; count: number; revenue: number }>();
        sales.forEach(sale => {
          const sellerName = sale.seller?.full_name || 'Sem vendedor';
          const existing = sellerMap.get(sellerName) || { name: sellerName, count: 0, revenue: 0 };
          existing.count += 1;
          existing.revenue += Number(sale.final_price);
          sellerMap.set(sellerName, existing);
        });
        setSalesBySeller(
          Array.from(sellerMap.values())
            .sort((a, b) => b.count - a.count)
            .slice(0, 10)
            .map((seller, index) => ({ ...seller, id: `seller-${index}` }))
        );

        const vehicleMap = new Map<string, number>();
        sales.forEach(sale => {
          const vehicleName = sale.vehicle ? `${sale.vehicle.brand} ${sale.vehicle.model}` : 'Desconhecido';
          vehicleMap.set(vehicleName, (vehicleMap.get(vehicleName) || 0) + 1);
        });
        setTopVehicles(
          Array.from(vehicleMap.entries())
            .map(([name, count]) => ({ veículo: name, vendas: count }))
            .sort((a, b) => b.vendas - a.vendas)
            .slice(0, 10)
            .map((item, index) => ({ ...item, id: `vehicle-${index}` }))
        );
      }
    } catch (error) {
      console.error('Error loading reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    { title: 'Vendas no período', value: metrics.totalSales, icon: Handshake, accent: true, description: 'Negocios fechados' },
    { title: 'Receita', value: brl(metrics.totalRevenue), icon: DollarSign, accent: false, description: 'Valor vendido' },
    { title: 'Lucro estimado', value: brl(metrics.totalProfit), icon: TrendingUp, accent: false, description: 'Venda menos compra' },
    { title: 'Conversão', value: `${Number.isFinite(metrics.conversionRate) ? metrics.conversionRate.toFixed(1) : '0.0'}%`, icon: Car, accent: false, description: 'Vendas sobre negociações' }
  ];

  const emptyState = (
    <EmptyState
      icon={BarChart3}
      title="Sem vendas neste período"
      description="Ajuste o intervalo ou registre uma venda para ver tendências e desempenho."
      className="min-h-64 shadow-none"
    />
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32" />
        <Skeleton className="h-24" />
        <div className="grid gap-4 md:grid-cols-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={BarChart3}
        eyebrow="Inteligencia comercial"
        title="Relatórios"
        description="Entenda receita, lucro, conversão e desempenho da equipe por período."
      />

      <Card>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="start_date">Início do período</Label>
            <Input
              type="date"
              id="start_date"
              value={dateRange.start}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="end_date">Fim do período</Label>
            <Input
              type="date"
              id="end_date"
              value={dateRange.end}
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <MetricCard key={stat.title} {...stat} />
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tendencia de vendas</CardTitle>
        </CardHeader>
        <CardContent>
          {salesByMonth.length === 0 ? emptyState : (
            <div className="h-72 w-full">
              <ResponsiveContainer>
                <LineChart data={salesByMonth}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="month" tick={axisStyle} stroke="var(--border)" />
                  <YAxis tick={axisStyle} stroke="var(--border)" />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend />
                  <Line type="monotone" dataKey="vendas" stroke="var(--primary)" strokeWidth={2} name="Vendas" dot={{ fill: 'var(--primary)' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Desempenho por vendedor</CardTitle>
          </CardHeader>
          <CardContent>
            {salesBySeller.length === 0 ? emptyState : (
              <div className="h-72 w-full">
                <ResponsiveContainer>
                  <BarChart data={salesBySeller}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="name" tick={axisStyle} stroke="var(--border)" />
                    <YAxis tick={axisStyle} stroke="var(--border)" />
                    <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'var(--accent)' }} />
                    <Legend />
                    <Bar dataKey="count" fill="var(--primary)" name="Vendas" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Modelos com melhor giro</CardTitle>
          </CardHeader>
          <CardContent>
            {topVehicles.length === 0 ? emptyState : (
              <div className="h-72 w-full">
                <ResponsiveContainer>
                  <BarChart data={topVehicles}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="veículo" angle={-35} textAnchor="end" height={92} tick={axisStyle} stroke="var(--border)" />
                    <YAxis tick={axisStyle} stroke="var(--border)" />
                    <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'var(--accent)' }} />
                    <Legend />
                    <Bar dataKey="vendas" fill="var(--muted-foreground)" name="Vendas" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}


