import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { TrendingUp, DollarSign, Car, Handshake } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Label } from '../components/ui/label';
import { Input } from '../components/ui/input';

const brl = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

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
  const [salesByMonth, setSalesByMonth] = useState<any[]>([]);
  const [salesBySeller, setSalesBySeller] = useState<any[]>([]);
  const [topVehicles, setTopVehicles] = useState<any[]>([]);

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
          conversionRate: negotiations ? (sales.length / negotiations.length) * 100 : 0
        });

        const salesByMonthMap = new Map<string, number>();
        sales.forEach(sale => {
          const month = new Date(sale.sale_date).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
          salesByMonthMap.set(month, (salesByMonthMap.get(month) || 0) + 1);
        });
        const monthData = Array.from(salesByMonthMap.entries())
          .map(([month, count]) => ({ month, vendas: count }))
          .sort((a, b) => a.month.localeCompare(b.month))
          .map((item, index) => ({ ...item, id: `month-${index}` }));
        setSalesByMonth(monthData);

        const sellerMap = new Map<string, { name: string; count: number; revenue: number }>();
        sales.forEach(sale => {
          const sellerName = sale.seller?.full_name || 'Sem vendedor';
          const existing = sellerMap.get(sellerName) || { name: sellerName, count: 0, revenue: 0 };
          existing.count += 1;
          existing.revenue += Number(sale.final_price);
          sellerMap.set(sellerName, existing);
        });
        const sellerData = Array.from(sellerMap.values())
          .sort((a, b) => b.count - a.count)
          .slice(0, 10)
          .map((seller, index) => ({ ...seller, id: `seller-${index}` }));
        setSalesBySeller(sellerData);

        const vehicleMap = new Map<string, number>();
        sales.forEach(sale => {
          const vehicleName = sale.vehicle ? `${sale.vehicle.brand} ${sale.vehicle.model}` : 'Desconhecido';
          vehicleMap.set(vehicleName, (vehicleMap.get(vehicleName) || 0) + 1);
        });
        const vehicleData = Array.from(vehicleMap.entries())
          .map(([name, count]) => ({ veiculo: name, vendas: count }))
          .sort((a, b) => b.vendas - a.vendas)
          .slice(0, 10)
          .map((item, index) => ({ ...item, id: `vehicle-${index}` }));
        setTopVehicles(vehicleData);
      }
    } catch (error) {
      console.error('Error loading reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    { title: 'Total de Vendas', value: metrics.totalSales, icon: Handshake, accent: true },
    { title: 'Receita Total', value: brl(metrics.totalRevenue), icon: DollarSign, accent: false },
    { title: 'Lucro Total', value: brl(metrics.totalProfit), icon: TrendingUp, accent: false },
    { title: 'Taxa de Conversão', value: `${metrics.conversionRate.toFixed(1)}%`, icon: Car, accent: false }
  ];

  const emptyState = (
    <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
      <p>Nenhuma venda encontrada no período selecionado</p>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Relatórios</h1>
        <p className="text-muted-foreground mt-1">Análise de desempenho e métricas</p>
      </div>

      <Card>
        <CardContent className="flex flex-col sm:flex-row gap-4 items-end">
          <div className="flex-1 w-full space-y-2">
            <Label htmlFor="start_date">Data Inicial</Label>
            <Input
              type="date"
              id="start_date"
              value={dateRange.start}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
            />
          </div>
          <div className="flex-1 w-full space-y-2">
            <Label htmlFor="end_date">Data Final</Label>
            <Input
              type="date"
              id="end_date"
              value={dateRange.end}
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
            />
          </div>
        </CardContent>
      </Card>

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

      <Card>
        <CardHeader>
          <CardTitle>Análise de Vendas</CardTitle>
        </CardHeader>
        <CardContent>
          {salesByMonth.length === 0 ? emptyState : (
            <div style={{ width: '100%', height: 256 }}>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Desempenho por Vendedor</CardTitle>
          </CardHeader>
          <CardContent>
            {salesBySeller.length === 0 ? emptyState : (
              <div style={{ width: '100%', height: 256 }}>
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
            <CardTitle>Veículos Mais Vendidos</CardTitle>
          </CardHeader>
          <CardContent>
            {topVehicles.length === 0 ? emptyState : (
              <div style={{ width: '100%', height: 256 }}>
                <ResponsiveContainer>
                  <BarChart data={topVehicles}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="veiculo" angle={-45} textAnchor="end" height={100} tick={axisStyle} stroke="var(--border)" />
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
