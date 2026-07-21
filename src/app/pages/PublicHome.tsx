import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { supabase, Vehicle } from '../../lib/supabase';
import { Search, SlidersHorizontal, MapPin, Car, Calendar, Gauge } from 'lucide-react';
import { CAR_BRANDS } from '../../constants/carBrands';
import { ThemeToggle } from '../components/ThemeToggle';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';

type PublicVehicle = Vehicle & {
  company_name?: string;
  company_city?: string;
  company_state?: string;
  company_phone?: string;
};

const brl = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const selectClass =
  'w-full h-9 px-3 rounded-md border border-input bg-input-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring';

export function PublicHome() {
  const [vehicles, setVehicles] = useState<PublicVehicle[]>([]);
  const [filteredVehicles, setFilteredVehicles] = useState<PublicVehicle[]>([]);
  const [loading, setLoading] = useState(true);

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
    if (selectedBrand) filtered = filtered.filter(v => v.brand === selectedBrand);
    if (minYear) filtered = filtered.filter(v => v.year >= parseInt(minYear));
    if (maxYear) filtered = filtered.filter(v => v.year <= parseInt(maxYear));
    if (minPrice) filtered = filtered.filter(v => v.sale_price >= parseFloat(minPrice));
    if (maxPrice) filtered = filtered.filter(v => v.sale_price <= parseFloat(maxPrice));
    if (fuelType) filtered = filtered.filter(v => v.fuel_type === fuelType);
    if (transmission) filtered = filtered.filter(v => v.transmission === transmission);

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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card/80 backdrop-blur border-b border-border sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 bg-primary rounded-lg">
                <Car className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">LuxCar</h1>
                <p className="text-xs text-muted-foreground">Encontre seu próximo veículo</p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <ThemeToggle />
              <Button asChild variant="ghost" className="hidden sm:inline-flex">
                <Link to="/auth/login">Sou Lojista</Link>
              </Button>
              <Button asChild>
                <Link to="/client/login">Sou Cliente</Link>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border bg-gradient-to-br from-primary/10 via-background to-background">
        <div className="max-w-7xl mx-auto px-4 py-14 text-center">
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground">
            O carro certo, <span className="text-primary">no preço certo</span>
          </h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            Explore o estoque das melhores lojas em um só lugar. Filtre por marca, ano, preço e encontre seu próximo veículo.
          </p>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Search Bar */}
        <Card className="mb-6 -mt-12 relative z-10 shadow-lg">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Busque por marca ou modelo..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 h-11"
                />
              </div>
              <Button variant="secondary" size="lg" onClick={() => setShowFilters(!showFilters)}>
                <SlidersHorizontal className="w-4 h-4" />
                {showFilters ? 'Ocultar Filtros' : 'Filtros'}
              </Button>
            </div>

            {showFilters && (
              <div className="mt-6 pt-6 border-t border-border">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label>Marca</Label>
                    <select value={selectedBrand} onChange={(e) => setSelectedBrand(e.target.value)} className={selectClass}>
                      <option value="">Todas</option>
                      {CAR_BRANDS.map(brand => <option key={brand} value={brand}>{brand}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Ano Mínimo</Label>
                    <select value={minYear} onChange={(e) => setMinYear(e.target.value)} className={selectClass}>
                      <option value="">Todos</option>
                      {years.map(year => <option key={year} value={year}>{year}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Ano Máximo</Label>
                    <select value={maxYear} onChange={(e) => setMaxYear(e.target.value)} className={selectClass}>
                      <option value="">Todos</option>
                      {years.map(year => <option key={year} value={year}>{year}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Combustível</Label>
                    <select value={fuelType} onChange={(e) => setFuelType(e.target.value)} className={selectClass}>
                      <option value="">Todos</option>
                      <option value="gasolina">Gasolina</option>
                      <option value="etanol">Etanol</option>
                      <option value="flex">Flex</option>
                      <option value="diesel">Diesel</option>
                      <option value="eletrico">Elétrico</option>
                      <option value="hibrido">Híbrido</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="minPrice">Preço Mínimo</Label>
                    <Input id="minPrice" type="number" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} placeholder="R$ 0" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="maxPrice">Preço Máximo</Label>
                    <Input id="maxPrice" type="number" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} placeholder="R$ 200.000" />
                  </div>
                  <div className="space-y-2">
                    <Label>Câmbio</Label>
                    <select value={transmission} onChange={(e) => setTransmission(e.target.value)} className={selectClass}>
                      <option value="">Todos</option>
                      <option value="manual">Manual</option>
                      <option value="automatica">Automática</option>
                      <option value="automatizada">Automatizada</option>
                      <option value="cvt">CVT</option>
                    </select>
                  </div>
                  <div className="flex items-end">
                    <Button variant="outline" className="w-full" onClick={clearFilters}>Limpar Filtros</Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Results Count */}
        <div className="mb-4">
          <p className="text-muted-foreground">
            <span className="font-semibold text-foreground">{filteredVehicles.length}</span> veículos encontrados
          </p>
        </div>

        {/* Vehicle Grid */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : filteredVehicles.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Car className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">Nenhum veículo encontrado</h3>
              <p className="text-muted-foreground mb-6">Tente ajustar os filtros de busca</p>
              <Button onClick={clearFilters}>Limpar Filtros</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredVehicles.map((vehicle) => (
              <Link key={vehicle.id} to={`/vehicles/${vehicle.id}`} className="group">
                <Card className="overflow-hidden pt-0 gap-0 h-full transition-shadow hover:shadow-lg">
                  <div className="relative h-56 bg-gradient-to-br from-muted to-accent overflow-hidden">
                    {vehicle.images && vehicle.images.length > 0 ? (
                      <img
                        src={vehicle.images[0]}
                        alt={`${vehicle.brand} ${vehicle.model}`}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <Car className="w-20 h-20 text-muted-foreground" />
                      </div>
                    )}
                  </div>

                  <CardContent className="p-5">
                    <h3 className="font-bold text-xl text-foreground mb-1">
                      {vehicle.brand} {vehicle.model}
                    </h3>
                    <p className="text-muted-foreground text-sm mb-3">{vehicle.version}</p>

                    <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
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

                    <div className="pt-4 border-t border-border">
                      <p className="text-3xl font-bold text-primary mb-3">{brl(vehicle.sale_price)}</p>

                      {vehicle.company_name && (
                        <div className="flex items-start gap-2 text-sm text-muted-foreground">
                          <MapPin className="w-4 h-4 shrink-0 mt-0.5" />
                          <div>
                            <p className="font-medium text-foreground">{vehicle.company_name}</p>
                            {vehicle.company_city && vehicle.company_state && (
                              <p>{vehicle.company_city} - {vehicle.company_state}</p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
