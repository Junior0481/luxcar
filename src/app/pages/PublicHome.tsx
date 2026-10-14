import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { supabase, Vehicle } from '../../lib/supabase';
import { AlertCircle, Calendar, Car, Gauge, MapPin, RefreshCw, Search, SlidersHorizontal } from 'lucide-react';
import { CAR_BRANDS } from '../../constants/carBrands';
import { ThemeToggle } from '../components/ThemeToggle';
import { pluralize } from '../../lib/format';
import { thumbUrl } from '../../services/storage.service';
import { useCompany } from '../../contexts/CompanyContext';
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '../components/ui/sheet';

type PublicVehicle = Vehicle & {
  company_name?: string;
  company_slug?: string;
  company_city?: string;
  company_state?: string;
  company_phone?: string;
};

const brl = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const ANY = 'all';

export function PublicHome() {
  const { company } = useCompany();
  const [vehicles, setVehicles] = useState<PublicVehicle[]>([]);
  const [filteredVehicles, setFilteredVehicles] = useState<PublicVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBrand, setSelectedBrand] = useState(ANY);
  const [selectedCompany, setSelectedCompany] = useState(ANY);
  const [minYear, setMinYear] = useState(ANY);
  const [maxYear, setMaxYear] = useState(ANY);
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [fuelType, setFuelType] = useState(ANY);
  const [transmission, setTransmission] = useState(ANY);
  const [showFilters, setShowFilters] = useState(false);
  const [sortOrder, setSortOrder] = useState('newest');

  useEffect(() => {
    loadVehicles();
  }, []);

  useEffect(() => {
    filterVehicles();
  }, [searchTerm, selectedBrand, selectedCompany, minYear, maxYear, minPrice, maxPrice, fuelType, transmission, sortOrder, vehicles]);

  const loadVehicles = async () => {
    try {
      setLoading(true);
      setError(null);
      let { data, error: queryError } = await supabase
        .from('public_vehicles')
        .select('*')
        .eq('status', 'disponivel')
        .order('created_at', { ascending: false });

      if (queryError && queryError.code === '42P01') {
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
      } else if (queryError) {
        throw queryError;
      }

      setVehicles(data || []);
    } catch (err: any) {
      console.error('Error loading vehicles:', err);
      setError(err?.message || 'Erro ao carregar veículos do catálogo.');
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
    if (selectedBrand !== ANY) filtered = filtered.filter(v => v.brand.toLocaleLowerCase() === selectedBrand.toLocaleLowerCase());
    if (selectedCompany !== ANY) filtered = filtered.filter(v => v.company_slug === selectedCompany);
    if (minYear !== ANY) filtered = filtered.filter(v => v.year >= parseInt(minYear));
    if (maxYear !== ANY) filtered = filtered.filter(v => v.year <= parseInt(maxYear));
    if (minPrice) filtered = filtered.filter(v => v.sale_price >= parseFloat(minPrice));
    if (maxPrice) filtered = filtered.filter(v => v.sale_price <= parseFloat(maxPrice));
    if (fuelType !== ANY) filtered = filtered.filter(v => v.fuel_type === fuelType);
    if (transmission !== ANY) filtered = filtered.filter(v => v.transmission === transmission);

    const sorted = [...filtered];
    if (sortOrder === 'price-asc') sorted.sort((a, b) => Number(a.sale_price) - Number(b.sale_price));
    if (sortOrder === 'price-desc') sorted.sort((a, b) => Number(b.sale_price) - Number(a.sale_price));
    if (sortOrder === 'year-desc') sorted.sort((a, b) => Number(b.year) - Number(a.year));
    setFilteredVehicles(sorted);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedBrand(ANY);
    setSelectedCompany(ANY);
    setMinYear(ANY);
    setMaxYear(ANY);
    setMinPrice('');
    setMaxPrice('');
    setFuelType(ANY);
    setTransmission(ANY);
    setSortOrder('newest');
  };

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 30 }, (_, i) => currentYear - i);
  const companies = Array.from(
    new Map(
      vehicles
        .filter((vehicle) => vehicle.company_slug && vehicle.company_name)
        .map((vehicle) => [vehicle.company_slug!, vehicle.company_name!])
    ).entries()
  );

  const renderFilterFields = (prefix: string) => (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor={`${prefix}-brand`}>Marca</Label>
        <Select value={selectedBrand} onValueChange={setSelectedBrand}>
          <SelectTrigger id={`${prefix}-brand`}><SelectValue placeholder="Todas as marcas" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>Todas as marcas</SelectItem>
            {CAR_BRANDS.map((brand) => <SelectItem key={brand} value={brand}>{brand}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {companies.length > 0 && <div className="space-y-2">
        <Label htmlFor={`${prefix}-company`}>Loja</Label>
        <Select value={selectedCompany} onValueChange={setSelectedCompany}>
          <SelectTrigger id={`${prefix}-company`}><SelectValue placeholder="Todas as lojas" /></SelectTrigger>
          <SelectContent><SelectItem value={ANY}>Todas as lojas</SelectItem>{companies.map(([slug, name]) => <SelectItem key={slug} value={slug}>{name}</SelectItem>)}</SelectContent>
        </Select>
      </div>}
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Preço</legend>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1"><Label htmlFor={`${prefix}-min-price`} className="text-xs text-muted-foreground">Mínimo</Label><Input id={`${prefix}-min-price`} type="number" min="0" value={minPrice} onChange={(event) => setMinPrice(event.target.value)} placeholder="R$ 0" /></div>
          <div className="space-y-1"><Label htmlFor={`${prefix}-max-price`} className="text-xs text-muted-foreground">Máximo</Label><Input id={`${prefix}-max-price`} type="number" min="0" value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)} placeholder="Sem limite" /></div>
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          {[{ label: 'Até R$ 80 mil', min: '', max: '80000' }, { label: 'R$ 80–150 mil', min: '80000', max: '150000' }, { label: 'Acima de R$ 150 mil', min: '150000', max: '' }].map((range) => <Button key={range.label} type="button" variant="outline" size="sm" className="h-8 px-2 text-xs" onClick={() => { setMinPrice(range.min); setMaxPrice(range.max); }}>{range.label}</Button>)}
        </div>
      </fieldset>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Ano</legend>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1"><Label htmlFor={`${prefix}-min-year`} className="text-xs text-muted-foreground">De</Label><Select value={minYear} onValueChange={setMinYear}><SelectTrigger id={`${prefix}-min-year`} aria-label="Ano mínimo"><SelectValue placeholder="De" /></SelectTrigger><SelectContent><SelectItem value={ANY}>Todos</SelectItem>{years.map((year) => <SelectItem key={year} value={String(year)}>{year}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1"><Label htmlFor={`${prefix}-max-year`} className="text-xs text-muted-foreground">Até</Label><Select value={maxYear} onValueChange={setMaxYear}><SelectTrigger id={`${prefix}-max-year`} aria-label="Ano máximo"><SelectValue placeholder="Até" /></SelectTrigger><SelectContent><SelectItem value={ANY}>Todos</SelectItem>{years.map((year) => <SelectItem key={year} value={String(year)}>{year}</SelectItem>)}</SelectContent></Select></div>
        </div>
      </fieldset>
      <div className="space-y-2"><Label htmlFor={`${prefix}-transmission`}>Câmbio</Label><Select value={transmission} onValueChange={setTransmission}><SelectTrigger id={`${prefix}-transmission`}><SelectValue placeholder="Todos" /></SelectTrigger><SelectContent><SelectItem value={ANY}>Todos</SelectItem><SelectItem value="automatica">Automático</SelectItem><SelectItem value="manual">Manual</SelectItem><SelectItem value="automatizada">Automatizado</SelectItem><SelectItem value="cvt">CVT</SelectItem></SelectContent></Select></div>
      <div className="space-y-2"><Label htmlFor={`${prefix}-fuel`}>Combustível</Label><Select value={fuelType} onValueChange={setFuelType}><SelectTrigger id={`${prefix}-fuel`}><SelectValue placeholder="Todos" /></SelectTrigger><SelectContent><SelectItem value={ANY}>Todos</SelectItem><SelectItem value="gasolina">Gasolina</SelectItem><SelectItem value="etanol">Etanol</SelectItem><SelectItem value="flex">Flex</SelectItem><SelectItem value="diesel">Diesel</SelectItem><SelectItem value="eletrico">Elétrico</SelectItem><SelectItem value="hibrido">Híbrido</SelectItem></SelectContent></Select></div>
      <Button type="button" variant="outline" className="w-full" onClick={clearFilters}>Limpar filtros</Button>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-header border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <Link to="/" className="flex items-center gap-3">
              {company?.logo_url ? (
                <img src={company.logo_url} alt={`Logo ${company.name}`} className="size-10 rounded-2xl object-contain" />
              ) : (
                <div className="flex size-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                  <Car className="size-6" aria-hidden="true" />
                </div>
              )}
              <div>
                <h1 className="text-xl font-medium text-foreground">{company?.name || 'LuxCar'}</h1>
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
        <div className="mx-auto max-w-7xl px-4 py-12 sm:py-14">
          <div className="max-w-3xl">
            <p className="text-sm font-medium uppercase text-muted-foreground">Estoque disponível</p>
            <h2 className="mt-3 text-4xl font-bold leading-tight tracking-tight text-foreground [font-family:var(--font-display)] md:text-5xl">
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
                  aria-label="Buscar veículos por marca ou modelo"
                  placeholder="Busque por marca ou modelo"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex gap-2">
                <Sheet open={showFilters} onOpenChange={setShowFilters}>
                  <Button type="button" variant="secondary" className="lg:hidden" onClick={() => setShowFilters(true)}>
                    <SlidersHorizontal className="size-4" />Filtros
                  </Button>
                  <SheetContent side="left" className="w-[min(88vw,360px)] overflow-y-auto p-0 lg:hidden">
                    <SheetHeader className="border-b border-border pr-12">
                      <SheetTitle>Filtros</SheetTitle>
                      <SheetDescription>Refine os veículos pelo que você procura.</SheetDescription>
                    </SheetHeader>
                    <div className="p-4">{renderFilterFields('mobile')}</div>
                  </SheetContent>
                </Sheet>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid items-start gap-6 lg:grid-cols-[248px_minmax(0,1fr)]">
          <aside className="hidden lg:block" aria-label="Filtros de veículos">
            <Card><CardContent><h2 className="mb-5 text-lg font-semibold text-foreground">Filtros</h2>{renderFilterFields('desktop')}</CardContent></Card>
          </aside>
          <section className="min-w-0">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground"><span className="font-semibold tabular-nums text-foreground">{pluralize(filteredVehicles.length, 'veículo encontrado', 'veículos encontrados')}</span></p>
              <div className="flex items-center gap-2">
                <Label htmlFor="vehicle-sort" className="whitespace-nowrap text-sm text-muted-foreground">Ordenar</Label>
                <Select value={sortOrder} onValueChange={setSortOrder}>
                  <SelectTrigger id="vehicle-sort" className="w-[190px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Mais recentes</SelectItem>
                    <SelectItem value="price-asc">Menor preço</SelectItem>
                    <SelectItem value="price-desc">Maior preço</SelectItem>
                    <SelectItem value="year-desc">Ano mais recente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

        {loading ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Skeleton className="h-96" />
            <Skeleton className="h-96" />
            <Skeleton className="h-96" />
          </div>
        ) : error ? (
          <div role="alert" className="flex flex-col gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 p-6 text-destructive sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 size-5 shrink-0" />
              <div>
                <p className="font-medium">Erro ao carregar catálogo</p>
                <p className="text-sm text-destructive/80">{error}</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => loadVehicles()} className="w-fit">
              <RefreshCw className="size-4" />
              Tentar novamente
            </Button>
          </div>
        ) : filteredVehicles.length === 0 ? (
          <EmptyState
            title="Nenhum veículo encontrado"
            description="Ajuste os filtros para encontrar uma opção compatível com sua busca."
            action={<Button onClick={clearFilters}>Limpar filtros</Button>}
          />
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {filteredVehicles.map((vehicle) => (
              <Link key={vehicle.id} to={`/vehicles/${vehicle.id}`} className="group">
                <Card className="h-full gap-0 overflow-hidden pt-0 lux-card-hover">
                  <div className="relative aspect-[4/3] overflow-hidden bg-muted">
                    {vehicle.images && vehicle.images.length > 0 ? (
                      <img
                        src={thumbUrl(vehicle.images[0])}
                        alt={`${vehicle.brand} ${vehicle.model}`}
                        loading="lazy"
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
                      <h3 className="text-[19px] font-semibold text-foreground [font-family:var(--font-display)]">
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
                      <p className="text-[28px] font-bold tabular-nums text-foreground [font-family:var(--font-display)]">{brl(vehicle.sale_price)}</p>
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
          </section>
        </div>
      </div>
    </div>
  );
}


