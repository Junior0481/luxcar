import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { supabase, Vehicle } from '../../lib/supabase';
import { Search, SlidersHorizontal, MapPin, Car, Calendar, Gauge, Mail, Phone, Heart } from 'lucide-react';
import { CAR_BRANDS } from '../../constants/carBrands';

type PublicVehicle = Vehicle & {
  company_name?: string;
  company_city?: string;
  company_state?: string;
  company_phone?: string;
};

export function PublicHome() {
  const [vehicles, setVehicles] = useState<PublicVehicle[]>([]);
  const [filteredVehicles, setFilteredVehicles] = useState<PublicVehicle[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('');
  const [minYear, setMinYear] = useState('');
  const [maxYear, setMaxYear] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [fuelType, setFuelType] = useState('');
  const [transmission, setTransmission] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    loadVehicles();
  }, []);

  useEffect(() => {
    filterVehicles();
  }, [searchTerm, selectedBrand, minYear, maxYear, minPrice, maxPrice, fuelType, transmission, vehicles]);

  const loadVehicles = async () => {
    try {
      let { data, error } = await supabase
        .from('public_vehicles')
        .select('*')
        .eq('status', 'disponivel')
        .order('created_at', { ascending: false });

      if (error && error.code === '42P01') {
        const result = await supabase
          .from('vehicles')
          .select('*')
          .eq('status', 'disponivel')
          .order('created_at', { ascending: false });

        if (result.error) throw result.error;

        data = (result.data || []).map((v: any) => ({
          ...v,
          company_name: null,
          company_slug: null,
          company_city: null,
          company_state: null,
          company_phone: null
        }));
      } else if (error) {
        throw error;
      }

      setVehicles(data || []);
    } catch (error) {
      console.error('Error loading vehicles:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterVehicles = () => {
    let filtered = vehicles;

    if (searchTerm) {
      filtered = filtered.filter(v =>
        v.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.model.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (selectedBrand) {
      filtered = filtered.filter(v => v.brand === selectedBrand);
    }

    if (minYear) {
      filtered = filtered.filter(v => v.year >= parseInt(minYear));
    }

    if (maxYear) {
      filtered = filtered.filter(v => v.year <= parseInt(maxYear));
    }

    if (minPrice) {
      filtered = filtered.filter(v => v.sale_price >= parseFloat(minPrice));
    }

    if (maxPrice) {
      filtered = filtered.filter(v => v.sale_price <= parseFloat(maxPrice));
    }

    if (fuelType) {
      filtered = filtered.filter(v => v.fuel_type === fuelType);
    }

    if (transmission) {
      filtered = filtered.filter(v => v.transmission === transmission);
    }

    setFilteredVehicles(filtered);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedBrand('');
    setMinYear('');
    setMaxYear('');
    setMinPrice('');
    setMaxPrice('');
    setFuelType('');
    setTransmission('');
  };

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 30 }, (_, i) => currentYear - i);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 bg-blue-600 rounded-lg">
                <Car className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">LuxCar</h1>
                <p className="text-xs text-gray-500">Encontre seu próximo veículo</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Link
                to="/auth/login"
                className="px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors font-medium"
              >
                Sou Lojista
              </Link>
              <Link
                to="/client/login"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Sou Cliente
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Search Bar */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Busque por marca ou modelo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
            >
              <SlidersHorizontal className="w-5 h-5" />
              {showFilters ? 'Ocultar Filtros' : 'Filtros'}
            </button>
          </div>

          {/* Filtros Avançados */}
          {showFilters && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Marca</label>
                  <select
                    value={selectedBrand}
                    onChange={(e) => setSelectedBrand(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Todas</option>
                    {CAR_BRANDS.map(brand => (
                      <option key={brand} value={brand}>{brand}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Ano Mínimo</label>
                  <select
                    value={minYear}
                    onChange={(e) => setMinYear(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Todos</option>
                    {years.map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Ano Máximo</label>
                  <select
                    value={maxYear}
                    onChange={(e) => setMaxYear(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Todos</option>
                    {years.map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Combustível</label>
                  <select
                    value={fuelType}
                    onChange={(e) => setFuelType(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Todos</option>
                    <option value="gasolina">Gasolina</option>
                    <option value="etanol">Etanol</option>
                    <option value="flex">Flex</option>
                    <option value="diesel">Diesel</option>
                    <option value="eletrico">Elétrico</option>
                    <option value="hibrido">Híbrido</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Preço Mínimo</label>
                  <input
                    type="number"
                    value={minPrice}
                    onChange={(e) => setMinPrice(e.target.value)}
                    placeholder="R$ 0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Preço Máximo</label>
                  <input
                    type="number"
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(e.target.value)}
                    placeholder="R$ 200.000"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Câmbio</label>
                  <select
                    value={transmission}
                    onChange={(e) => setTransmission(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Todos</option>
                    <option value="manual">Manual</option>
                    <option value="automatica">Automática</option>
                    <option value="automatizada">Automatizada</option>
                    <option value="cvt">CVT</option>
                  </select>
                </div>

                <div className="flex items-end">
                  <button
                    onClick={clearFilters}
                    className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Limpar Filtros
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Results Count */}
        <div className="mb-4">
          <p className="text-gray-600">
            <span className="font-semibold text-gray-900">{filteredVehicles.length}</span> veículos encontrados
          </p>
        </div>

        {/* Vehicle Grid */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredVehicles.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center shadow-sm border border-gray-200">
            <Car className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhum veículo encontrado</h3>
            <p className="text-gray-600 mb-6">Tente ajustar os filtros de busca</p>
            <button
              onClick={clearFilters}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Limpar Filtros
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredVehicles.map((vehicle) => (
              <Link
                key={vehicle.id}
                to={`/vehicles/${vehicle.id}`}
                className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow group"
              >
                <div className="relative h-56 bg-gradient-to-br from-gray-100 to-gray-200 overflow-hidden">
                  {vehicle.images && vehicle.images.length > 0 ? (
                    <img
                      src={vehicle.images[0]}
                      alt={`${vehicle.brand} ${vehicle.model}`}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <Car className="w-20 h-20 text-gray-400" />
                    </div>
                  )}
                  <button className="absolute top-3 right-3 p-2 bg-white rounded-full shadow-md hover:bg-gray-50 transition-colors">
                    <Heart className="w-5 h-5 text-gray-600" />
                  </button>
                </div>

                <div className="p-5">
                  <h3 className="font-bold text-xl text-gray-900 mb-1">
                    {vehicle.brand} {vehicle.model}
                  </h3>
                  <p className="text-gray-600 text-sm mb-3">{vehicle.version}</p>

                  <div className="flex items-center gap-4 text-sm text-gray-600 mb-4">
                    {vehicle.year && (
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        <span>{vehicle.year}</span>
                      </div>
                    )}
                    {vehicle.mileage && (
                      <div className="flex items-center gap-1">
                        <Gauge className="w-4 h-4" />
                        <span>{vehicle.mileage.toLocaleString('pt-BR')} km</span>
                      </div>
                    )}
                  </div>

                  <div className="pt-4 border-t border-gray-200">
                    <p className="text-3xl font-bold text-blue-600 mb-3">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(vehicle.sale_price)}
                    </p>

                    {vehicle.company_name && (
                      <div className="flex items-start gap-2 text-sm text-gray-600">
                        <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-medium text-gray-900">{vehicle.company_name}</p>
                          {vehicle.company_city && vehicle.company_state && (
                            <p>{vehicle.company_city} - {vehicle.company_state}</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
