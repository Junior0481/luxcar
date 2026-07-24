import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { supabase, Vehicle } from '../../lib/supabase';
import { Calendar, Car, Gauge, MapPin, Search, SlidersHorizontal } from 'lucide-react';
import { CAR_BRANDS } from '../../constants/carBrands';
import { ThemeToggle } from '../components/ThemeToggle';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { EmptyState } from '../components/ui/empty-state';
import { Skeleton } from '../components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '../components/ui/select';

type PublicVehicle = Vehicle & {
  company_name?: string;
  company_city?: string;
  company_state?: string;
  company_phone?: string;
};

const brl = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const ANY = 'all';

export function PublicHome() {
  const [vehicles, setVehicles] = useState<PublicVehicle[]>([]);
  const [filteredVehicles, setFilteredVehicles] = useState<PublicVehicle[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBrand, setSelectedBrand] = useState(ANY);
  const [minYear, setMinYear] = useState(ANY);
  const [maxYear, setMaxYear] = useState(ANY);
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [fuelType, setFuelType] = useState(ANY);
  const [transmission, setTransmission] = useState(ANY);
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
    if (selectedBrand !== ANY) filtered = filtered.filter(v => v.brand === selectedBrand);
    if (minYear !== ANY) filtered = filtered.filter(v => v.year >= parseInt(minYear));
    if (maxYear !== ANY) filtered = filtered.filter(v => v.year <= parseInt(maxYear));
    if (minPrice) filtered = filtered.filter(v => v.sale_price >= parseFloat(minPrice));
    if (maxPrice) filtered = filtered.filter(v => v.sale_price <= parseFloat(maxPrice));
    if (fuelType !== ANY) filtered = filtered.filter(v => v.fuel_type === fuelType);
    if (transmission !== ANY) filtered = filtered.filter(v => v.transmission === transmission);

    setFilteredVehicles(filtered);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedBrand(ANY);
    setMinYear(ANY);
    setMaxYear(ANY);
    setMinPrice('');
    setMaxPrice('');
    setFuelType(ANY);
    setTransmission(ANY);
  };

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 30 }, (_, i) => currentYear - i);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-header border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <Link to="/" className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                <Car className="size-6" />
              </div>
              <div>
                <h1 className="text-xl font-medium text-foreground">LuxCar</h1>
                <p className="text-xs text-muted-foreground">Vitrine automotiva</p>
              </div>
            </Link>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Button asChild variant="ghost" className="hidden sm:inline-flex">
                <Link to="/auth/login">Sou lojista</Link>
              </Button>
              <Button asChild>
                <Link to="/client/login">Sou cliente</Link>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <section className="lux-gradient border-b border-border">
        <div className="mx-auto max-w-7xl px-4 py-14">
          <div className="max-w-3xl">
            <p className="text-sm font-medium uppercase text-muted-foreground">Estoque disponivel</p>
            <h2 className="mt-3 text-4xl font-medium tracking-normal text-foreground md:text-5xl">
              Encontre o carro certo em uma vitrine organizada.
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Compare modelos, preço, ano e loja anunciante com uma experiência clara em qualquer tela.
            </p>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-6">
        <Card className="relative z-10 mb-6 -mt-12">
          <CardContent>
            <div className="flex flex-col gap-4 md:flex-row">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Busque por marca ou modelo"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button variant="secondary" onClick={() => setShowFilters(!showFilters)}>
                <SlidersHorizontal className="size-4" />
                {showFilters ? 'Ocultar filtros' : 'Filtros'}
              </Button>
            </div>

            {showFilters && (
              <div className="mt-6 grid grid-cols-1 gap-4 border-t border-border pt-6 md:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-2">
                  <Label>Marca</Label>
                  <Select value={selectedBrand} onValueChange={setSelectedBrand}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ANY}>Todas</SelectItem>
                      {CAR_BRANDS.map(brand => <SelectItem key={brand} value={brand}>{brand}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Ano mínimo</Label>
                  <Select value={minYear} onValueChange={setMinYear}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ANY}>Todos</SelectItem>
                      {years.map(year => <SelectItem key={year} value={String(year)}>{year}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Ano máximo</Label>
                  <Select value={maxYear} onValueChange={setMaxYear}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ANY}>Todos</SelectItem>
                      {years.map(year => <SelectItem key={year} value={String(year)}>{year}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Combustível</Label>
                  <Select value={fuelType} onValueChange={setFuelType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ANY}>Todos</SelectItem>
                      <SelectItem value="gasolina">Gasolina</SelectItem>
                      <SelectItem value="etanol">Etanol</SelectItem>
                      <SelectItem value="flex">Flex</SelectItem>
                      <SelectItem value="diesel">Diesel</SelectItem>
                      <SelectItem value="eletrico">Elétrico</SelectItem>
                      <SelectItem value="hibrido">Híbrido</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="minPrice">Preço mínimo</Label>
                  <Input id="minPrice" type="number" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} placeholder="R$ 0" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxPrice">Preço máximo</Label>
                  <Input id="maxPrice" type="number" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} placeholder="R$ 200000" />
                </div>
                <div className="space-y-2">
                  <Label>Câmbio</Label>
                  <Select value={transmission} onValueChange={setTransmission}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ANY}>Todos</SelectItem>
                      <SelectItem value="manual">Manual</SelectItem>
                      <SelectItem value="automatica">Automatica</SelectItem>
                      <SelectItem value="automatizada">Automatizada</SelectItem>
                      <SelectItem value="cvt">CVT</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button variant="outline" className="w-full" onClick={clearFilters}>Limpar filtros</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <p className="mb-4 text-muted-foreground">
          <span className="font-medium text-foreground">{filteredVehicles.length}</span> veículos encontrados
        </p>

        {loading ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Skeleton className="h-96" />
            <Skeleton className="h-96" />
            <Skeleton className="h-96" />
          </div>
        ) : filteredVehicles.length === 0 ? (
          <EmptyState
            title="Nenhum veículo encontrado"
            description="Ajuste os filtros para encontrar uma opção compatível com sua busca."
            action={<Button onClick={clearFilters}>Limpar filtros</Button>}
          />
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredVehicles.map((vehicle) => (
              <Link key={vehicle.id} to={`/vehicles/${vehicle.id}`} className="group">
                <Card className="h-full gap-0 overflow-hidden pt-0 lux-card-hover">
                  <div className="relative h-56 overflow-hidden bg-muted">
                    {vehicle.images && vehicle.images.length > 0 ? (
                      <img
                        src={vehicle.images[0]}
                        alt={`${vehicle.brand} ${vehicle.model}`}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <Car className="size-20 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <CardContent className="space-y-4 p-5">
                    <div>
                      <h3 className="text-xl font-medium text-foreground">
                        {vehicle.brand} {vehicle.model}
                      </h3>
                      <p className="text-sm text-muted-foreground">{vehicle.version}</p>
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                      {vehicle.year ? (
                        <span className="flex items-center gap-1"><Calendar className="size-4" />{vehicle.year}</span>
                      ) : null}
                      {vehicle.mileage ? (
                        <span className="flex items-center gap-1"><Gauge className="size-4" />{vehicle.mileage.toLocaleString('pt-BR')} km</span>
                      ) : null}
                    </div>
                    <div className="border-t border-border pt-4">
                      <p className="text-3xl font-medium text-primary">{brl(vehicle.sale_price)}</p>
                      {vehicle.company_name ? (
                        <div className="mt-3 flex items-start gap-2 text-sm text-muted-foreground">
                          <MapPin className="mt-0.5 size-4 shrink-0" />
                          <div>
                            <p className="font-medium text-foreground">{vehicle.company_name}</p>
                            {vehicle.company_city && vehicle.company_state ? (
                              <p>{vehicle.company_city} - {vehicle.company_state}</p>
                            ) : null}
                          </div>
                        </div>
                      ) : null}
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


