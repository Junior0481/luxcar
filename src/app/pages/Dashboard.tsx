import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { supabase, Vehicle, Negotiation } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  Car,
  Handshake,
  TrendingUp,
  DollarSign,
  AlertCircle,
  CheckCircle,
  Clock,
  Users
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

type DashboardMetrics = {
  vehicles_available: number;
  vehicles_in_negotiation: number;
  vehicles_sold: number;
  active_negotiations: number;
  monthly_revenue: number;
  potential_profit: number;
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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const statusData = [
    { name: 'Disponíveis', value: metrics?.vehicles_available || 0, color: '#f8a746' },
    { name: 'Em Negociação', value: metrics?.vehicles_in_negotiation || 0, color: '#919294' },
    { name: 'Vendidos', value: metrics?.vehicles_sold || 0, color: '#010101' }
  ];

  const statCards = [
    {
      title: 'Veículos Disponíveis',
      value: metrics?.vehicles_available || 0,
      icon: Car,
      textColor: 'text-[#f8a746]',
      bgColor: 'bg-[#fff2df]'
    },
    {
      title: 'Em Negociação',
      value: metrics?.vehicles_in_negotiation || 0,
      icon: Clock,
      textColor: 'text-[#555459]',
      bgColor: 'bg-[#efefef]'
    },
    {
      title: 'Negociações Ativas',
      value: metrics?.active_negotiations || 0,
      icon: Handshake,
      textColor: 'text-[#010101]',
      bgColor: 'bg-[#f3f3f3]'
    },
    {
      title: 'Lucro Potencial',
      value: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(metrics?.potential_profit || 0),
      icon: TrendingUp,
      textColor: 'text-white',
      bgColor: 'bg-[#555459]'
    }
  ];

  const getStatusBadge = (status: string) => {
    const badges = {
      disponivel: { label: 'Disponível', className: 'bg-[#fff2df] text-[#010101]' },
      em_negociacao: { label: 'Em Negociação', className: 'bg-[#efefef] text-[#555459]' },
      vendido: { label: 'Vendido', className: 'bg-[#010101] text-white' }
    };
    const badge = badges[status as keyof typeof badges] || badges.disponivel;
    return <span className={`px-2 py-1 text-xs font-medium rounded-full ${badge.className}`}>{badge.label}</span>;
  };

  const getStageBadge = (stage: string) => {
    const stages: Record<string, { label: string; className: string }> = {
      primeiro_contato: { label: 'Primeiro Contato', className: 'bg-[#f3f3f3] text-[#555459]' },
      avaliacao: { label: 'Avaliação', className: 'bg-[#fff2df] text-[#010101]' },
      test_drive_agendado: { label: 'Test Drive Agendado', className: 'bg-[#efefef] text-[#555459]' },
      test_drive_realizado: { label: 'Test Drive Realizado', className: 'bg-[#ffe3be] text-[#010101]' },
      proposta_enviada: { label: 'Proposta Enviada', className: 'bg-[#fff2df] text-[#010101]' },
      negociacao_preco: { label: 'Negociação Preço', className: 'bg-[#efefef] text-[#555459]' },
      aprovacao_credito: { label: 'Aprovação Crédito', className: 'bg-[#ffe3be] text-[#010101]' },
      documentacao: { label: 'Documentação', className: 'bg-[#f3f3f3] text-[#555459]' },
      finalizado: { label: 'Finalizado', className: 'bg-[#010101] text-white' },
      perdido: { label: 'Perdido', className: 'bg-red-100 text-red-800' }
    };
    const badge = stages[stage] || stages.primeiro_contato;
    return <span className={`px-2 py-1 text-xs font-medium rounded-full ${badge.className}`}>{badge.label}</span>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-1">Bem-vindo, {profile?.full_name}</p>
        </div>
        <Link
          to="/dashboard/vehicles"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Cadastrar Veículo
        </Link>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Status dos Veículos</h3>
          <div style={{ width: '100%', height: 256 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Veículos Recentes</h3>
          <div className="space-y-3">
            {recentVehicles.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-8">Nenhum veículo cadastrado ainda</p>
            ) : (
              recentVehicles.map((vehicle) => (
                <Link
                  key={vehicle.id}
                  to={`/dashboard/vehicles/${vehicle.id}`}
                  className="block p-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{vehicle.brand} {vehicle.model}</p>
                      <p className="text-sm text-gray-500">{vehicle.year}</p>
                    </div>
                    {getStatusBadge(vehicle.status)}
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Negociações Recentes</h3>
          <Link to="/dashboard/negotiations" className="text-sm text-blue-600 hover:text-blue-700">
            Ver todas
          </Link>
        </div>
        <div className="overflow-x-auto">
          {recentNegotiations.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-8">Nenhuma negociação iniciada ainda</p>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cliente</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estágio</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Prioridade</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {recentNegotiations.map((negotiation) => (
                  <tr key={negotiation.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link
                        to={`/dashboard/negotiations/${negotiation.id}`}
                        className="text-sm font-medium text-gray-900 hover:text-blue-600"
                      >
                        {negotiation.client_name}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{getStageBadge(negotiation.stage)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full capitalize ${
                        negotiation.priority === 'alta' ? 'bg-red-100 text-red-800' :
                        negotiation.priority === 'media' ? 'bg-[#fff2df] text-[#010101]' :
                        'bg-[#f3f3f3] text-[#555459]'
                      }`}>
                        {negotiation.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {new Date(negotiation.created_at).toLocaleDateString('pt-BR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
