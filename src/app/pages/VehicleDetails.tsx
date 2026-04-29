import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router';
import { supabase, Vehicle, VehicleCost, Negotiation } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  ArrowLeft,
  Car,
  DollarSign,
  Calendar,
  Gauge,
  Fuel,
  Settings,
  AlertCircle,
  Plus,
  Wrench,
  Handshake
} from 'lucide-react';
import { CostForm } from '../components/CostForm';

export function VehicleDetails() {
  const { id } = useParams();
  const { profile } = useAuth();
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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!vehicle) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Veículo não encontrado</h2>
        <Link to="/dashboard/vehicles" className="text-blue-600 hover:text-blue-700">
          Voltar para veículos
        </Link>
      </div>
    );
  }

  const totalCosts = costs.reduce((sum, cost) => sum + Number(cost.amount), 0);
  const totalInvestment = Number(vehicle.purchase_price) + totalCosts;
  const potentialProfit = Number(vehicle.sale_price) - totalInvestment;
  const activeNegotiations = negotiations.filter(n => !['finalizado', 'perdido'].includes(n.stage));

  const getStatusBadge = (status: string) => {
    const badges = {
      disponivel: { label: 'Disponível', className: 'bg-green-100 text-green-800' },
      em_negociacao: { label: 'Em Negociação', className: 'bg-amber-100 text-amber-800' },
      vendido: { label: 'Vendido', className: 'bg-blue-100 text-blue-800' }
    };
    const badge = badges[status as keyof typeof badges] || badges.disponivel;
    return <span className={`px-3 py-1 text-sm font-medium rounded-full ${badge.className}`}>{badge.label}</span>;
  };

  const costTypeLabels: Record<string, string> = {
    manutencao: 'Manutenção',
    estetica: 'Estética',
    mecanica: 'Mecânica',
    revisao: 'Revisão',
    laudo: 'Laudo',
    outro: 'Outro'
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/dashboard/vehicles')}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{vehicle.brand} {vehicle.model}</h1>
          <p className="text-gray-600 mt-1">{vehicle.year} • {vehicle.version}</p>
        </div>
        <div className="ml-auto">{getStatusBadge(vehicle.status)}</div>
      </div>

      {activeNegotiations.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-amber-900">Veículo em negociação</p>
              <p className="text-sm text-amber-800 mt-1">
                Este veículo possui {activeNegotiations.length} negociação(ões) ativa(s).{' '}
                <Link to="/dashboard/negotiations" className="underline">
                  Ver negociações
                </Link>
              </p>
            </div>
          </div>
        </div>
      )}

      {vehicle.images && vehicle.images.length > 0 && (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Galeria de Fotos</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {vehicle.images.map((image, index) => (
              <div key={index} className="aspect-square overflow-hidden rounded-lg border-2 border-gray-200 hover:border-blue-400 transition-colors cursor-pointer">
                <img
                  src={image}
                  alt={`${vehicle.brand} ${vehicle.model} - Foto ${index + 1}`}
                  className="w-full h-full object-cover hover:scale-110 transition-transform"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center gap-3 mb-2">
            <DollarSign className="w-5 h-5 text-blue-600" />
            <span className="text-sm text-gray-600">Valor de Compra</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(vehicle.purchase_price)}
          </p>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center gap-3 mb-2">
            <Wrench className="w-5 h-5 text-orange-600" />
            <span className="text-sm text-gray-600">Custos Adicionais</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalCosts)}
          </p>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center gap-3 mb-2">
            <DollarSign className="w-5 h-5 text-green-600" />
            <span className="text-sm text-gray-600">Valor de Venda</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(vehicle.sale_price)}
          </p>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center gap-3 mb-2">
            <DollarSign className="w-5 h-5 text-purple-600" />
            <span className="text-sm text-gray-600">Lucro Estimado</span>
          </div>
          <p className={`text-2xl font-bold ${potentialProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(potentialProfit)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Informações do Veículo</h2>
          <div className="space-y-3">
            {vehicle.color && (
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <span className="text-gray-600">Cor</span>
                <span className="font-medium text-gray-900">{vehicle.color}</span>
              </div>
            )}
            {vehicle.plate && (
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <span className="text-gray-600">Placa</span>
                <span className="font-medium text-gray-900">{vehicle.plate}</span>
              </div>
            )}
            {vehicle.mileage && (
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <span className="text-gray-600">Quilometragem</span>
                <span className="font-medium text-gray-900">{vehicle.mileage.toLocaleString('pt-BR')} km</span>
              </div>
            )}
            {vehicle.fuel_type && (
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <span className="text-gray-600">Combustível</span>
                <span className="font-medium text-gray-900 capitalize">{vehicle.fuel_type}</span>
              </div>
            )}
            {vehicle.transmission && (
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <span className="text-gray-600">Transmissão</span>
                <span className="font-medium text-gray-900 capitalize">{vehicle.transmission}</span>
              </div>
            )}
            {vehicle.description && (
              <div className="py-2">
                <p className="text-gray-600 mb-1">Descrição</p>
                <p className="text-gray-900">{vehicle.description}</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">Custos e Manutenções</h2>
            <button
              onClick={() => setShowCostForm(true)}
              className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
            >
              <Plus className="w-4 h-4" />
              Adicionar
            </button>
          </div>
          {costs.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-8">Nenhum custo registrado</p>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {costs.map((cost) => (
                <div key={cost.id} className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-900">
                      {costTypeLabels[cost.cost_type]}
                    </span>
                    <span className="font-semibold text-gray-900">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cost.amount)}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600">{cost.description}</p>
                  {cost.service_date && (
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(cost.service_date).toLocaleDateString('pt-BR')}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
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
