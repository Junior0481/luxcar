import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { TrendingUp, DollarSign, Car, Handshake, Calendar } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

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

      // Filtrar por empresa
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

        // Processar vendas por mês
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

        // Processar vendas por vendedor
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

        // Processar veículos mais vendidos
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
    {
      title: 'Total de Vendas',
      value: metrics.totalSales,
      icon: Handshake,
      textColor: 'text-[#f8a746]',
      bgColor: 'bg-[#fff2df]'
    },
    {
      title: 'Receita Total',
      value: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(metrics.totalRevenue),
      icon: DollarSign,
      textColor: 'text-[#010101]',
      bgColor: 'bg-[#f3f3f3]'
    },
    {
      title: 'Lucro Total',
      value: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(metrics.totalProfit),
      icon: TrendingUp,
      textColor: 'text-white',
      bgColor: 'bg-[#555459]'
    },
    {
      title: 'Taxa de Conversão',
      value: `${metrics.conversionRate.toFixed(1)}%`,
      icon: Car,
      textColor: 'text-[#555459]',
      bgColor: 'bg-[#efefef]'
    }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Relatórios</h1>
        <p className="text-gray-600 mt-1">Análise de desempenho e métricas</p>
      </div>

      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
        <div className="flex flex-col sm:flex-row gap-4 items-end">
          <div className="flex-1">
            <label htmlFor="start_date" className="block text-sm font-medium text-gray-700 mb-2">
              Data Inicial
            </label>
            <input
              type="date"
              id="start_date"
              value={dateRange.start}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex-1">
            <label htmlFor="end_date" className="block text-sm font-medium text-gray-700 mb-2">
              Data Final
            </label>
            <input
              type="date"
              id="end_date"
              value={dateRange.end}
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, index) => (
          <div key={index} className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">{stat.title}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
              </div>
              <div className={`w-12 h-12 ${stat.bgColor} rounded-lg flex items-center justify-center`}>
                <stat.icon className={`w-6 h-6 ${stat.textColor}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Análise de Vendas</h2>
        {salesByMonth.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-gray-500">
            <p>Nenhuma venda encontrada no período selecionado</p>
          </div>
        ) : (
          <div style={{ width: '100%', height: 256 }}>
            <ResponsiveContainer>
              <LineChart data={salesByMonth}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="vendas" stroke="#f8a746" strokeWidth={2} name="Vendas" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Desempenho por Vendedor</h2>
          {salesBySeller.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-gray-500">
              <p>Nenhuma venda encontrada no período selecionado</p>
            </div>
          ) : (
            <div style={{ width: '100%', height: 256 }}>
              <ResponsiveContainer>
                <BarChart data={salesBySeller}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="count" fill="#919294" name="Vendas" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Veículos Mais Vendidos</h2>
          {topVehicles.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-gray-500">
              <p>Nenhuma venda encontrada no período selecionado</p>
            </div>
          ) : (
            <div style={{ width: '100%', height: 256 }}>
              <ResponsiveContainer>
                <BarChart data={topVehicles}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="veiculo" angle={-45} textAnchor="end" height={100} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="vendas" fill="#010101" name="Vendas" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
