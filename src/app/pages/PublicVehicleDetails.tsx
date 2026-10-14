import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router';
import { supabase, Vehicle } from '../../lib/supabase';
import { AlertCircle, ArrowLeft, Car, Calendar, ChevronLeft, ChevronRight, Gauge, Fuel, Settings as SettingsIcon, MapPin, Phone, MessageCircle, RefreshCw } from 'lucide-react';
import { LeadForm } from '../components/LeadForm';
import { ThemeToggle } from '../components/ThemeToggle';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { formatFuel, formatPhone, formatTransmission } from '../../lib/format';
import { thumbUrl } from '../../services/storage.service';

type PublicVehicle = Vehicle & {
  company_name?: string;
  company_slug?: string;
  company_city?: string;
  company_state?: string;
  company_phone?: string;
};

const brl = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

export function PublicVehicleDetails() {
  const { id } = useParams();
  const [vehicle, setVehicle] = useState<PublicVehicle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [selectedImage, setSelectedImage] = useState(0);

  useEffect(() => {
    if (id) {
      loadVehicle();
    }
  }, [id]);

  const loadVehicle = async () => {
    try {
      setLoading(true);
      setError(null);
      let { data, error } = await supabase
        .from('public_vehicles')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error && error.code === '42P01') {
        const result = await supabase
          .from('vehicles')
          .select('*')
          .eq('id', id)
          .maybeSingle();

        if (result.error) throw result.error;

        if (!result.data) {
          setVehicle(null);
          return;
        }

        data = {
          ...result.data,
          company_name: null,
          company_slug: null,
          company_city: null,
          company_state: null,
          company_phone: null
        };
      } else if (error) {
        throw error;
      }

      if (!data) {
        setVehicle(null);
        return;
      }
      setVehicle(data);
    } catch (err: any) {
      console.error('Error loading vehicle:', err);
      setError('Não foi possível carregar este anúncio. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background" role="status">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        <span className="sr-only">Carregando veículo...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div role="alert" className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center max-w-md">
          <AlertCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-foreground mb-2">Erro ao carregar veículo</h2>
          <p className="text-sm text-destructive/80 mb-6">{error}</p>
          <div className="flex justify-center gap-3">
            <Button variant="outline" onClick={() => loadVehicle()}>
              <RefreshCw className="size-4" />
              Tentar novamente
            </Button>
            <Button asChild>
              <Link to="/">Voltar para a página inicial</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!vehicle) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Car className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="mb-2 text-2xl font-bold text-foreground">Este anúncio não está mais disponível</h2>
          <Button asChild><Link to="/estoque">Ver outros carros</Link></Button>
        </div>
      </div>
    );
  }

  const images = vehicle.images && vehicle.images.length > 0 ? vehicle.images : [];

  const specs = [
    vehicle.year && { icon: Calendar, label: 'Ano', value: String(vehicle.year) },
    vehicle.mileage && { icon: Gauge, label: 'KM', value: vehicle.mileage.toLocaleString('pt-BR') },
    vehicle.fuel_type && { icon: Fuel, label: 'Combustível', value: formatFuel(vehicle.fuel_type) },
    vehicle.transmission && { icon: SettingsIcon, label: 'Câmbio', value: formatTransmission(vehicle.transmission) }
  ].filter(Boolean) as { icon: any; label: string; value: string; capitalize?: boolean }[];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card/80 backdrop-blur border-b border-border sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <Link to="/" className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 bg-primary rounded-lg">
                <Car className="w-6 h-6 text-primary-foreground" />
              </div>
              <h1 className="text-2xl font-bold text-foreground">LuxCar</h1>
            </Link>
            <div className="flex items-center gap-2 sm:gap-3">
              <ThemeToggle />
              <Button asChild>
                <Link to="/client/login">Entrar</Link>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <Link to="/estoque" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="w-5 h-5" />
          Voltar para a busca
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Image Gallery */}
            <Card className="overflow-hidden rounded-xl py-0">
              {images.length > 0 ? (
                <>
                  <div className="relative aspect-[3/2] max-h-[620px] bg-muted">
                    <img
                      src={images[selectedImage]}
                      alt={`${vehicle.brand} ${vehicle.model}`}
                      className="h-full w-full object-cover"
                    />
                    {images.length > 1 && <>
                      <Button type="button" variant="secondary" size="icon" aria-label="Foto anterior" onClick={() => setSelectedImage((selectedImage - 1 + images.length) % images.length)} className="absolute left-3 top-1/2 size-10 -translate-y-1/2 rounded-full bg-white/90 text-[#15171A] hover:bg-white"><ChevronLeft className="size-5" /></Button>
                      <Button type="button" variant="secondary" size="icon" aria-label="Próxima foto" onClick={() => setSelectedImage((selectedImage + 1) % images.length)} className="absolute right-3 top-1/2 size-10 -translate-y-1/2 rounded-full bg-white/90 text-[#15171A] hover:bg-white"><ChevronRight className="size-5" /></Button>
                      <span className="absolute bottom-3 right-3 rounded-md bg-black/75 px-2.5 py-1 text-xs font-semibold tabular-nums text-white">{selectedImage + 1} / {images.length}</span>
                    </>}
                  </div>
                  {images.length > 1 && (
                    <div className="p-4 grid grid-cols-4 sm:grid-cols-6 gap-2">
                      {images.map((img, index) => (
                        <button
                          key={index}
                          type="button"
                          onClick={() => setSelectedImage(index)}
                          aria-label={`Selecionar foto ${index + 1}`}
                          className={`aspect-[3/2] overflow-hidden rounded-lg border-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                            selectedImage === index ? 'border-primary ring-2 ring-primary/40' : 'border-border'
                          }`}
                        >
                          <img src={thumbUrl(img)} alt={`Foto ${index + 1}`} loading="lazy" className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="h-96 bg-gradient-to-br from-muted to-accent flex items-center justify-center">
                  <Car className="w-24 h-24 text-muted-foreground" />
                </div>
              )}
            </Card>

            {/* Vehicle Info */}
            <Card>
              <CardContent className="p-5 sm:p-6">
                <div className="mb-4">
                  <h1 className="mb-2 text-[30px] font-bold text-foreground [font-family:var(--font-display)]">
                    {vehicle.brand} {vehicle.model}
                  </h1>
                  <p className="text-xl text-muted-foreground">{vehicle.version}</p>
                </div>

                <p className="mb-6 text-4xl font-bold tabular-nums text-foreground [font-family:var(--font-display)]">{brl(vehicle.sale_price)}</p>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  {specs.map((spec) => (
                    <div key={spec.label} className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                      <spec.icon className="w-5 h-5 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">{spec.label}</p>
                        <p className={`font-semibold text-foreground truncate ${spec.capitalize ? 'capitalize' : ''}`}>
                          {spec.value}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {vehicle.description && (
                  <div className="pt-6 border-t border-border">
                    <h3 className="font-semibold text-foreground mb-3">Descrição</h3>
                    <p className="text-muted-foreground whitespace-pre-wrap">{vehicle.description}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar - Contact */}
          <div className="space-y-6">
            <Card className="sticky top-24 rounded-xl">
              <CardContent className="p-6">
                <h3 className="mb-4 text-lg font-bold text-foreground [font-family:var(--font-display)]">Interessado?</h3>

                {vehicle.company_phone && (
                  <Button asChild size="lg" className="mb-3 h-[52px] w-full bg-[#128C4A] text-white hover:bg-[#0F7A40]">
                    <a
                      href={`https://wa.me/55${vehicle.company_phone.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <MessageCircle className="w-5 h-5" />
                      Chamar no WhatsApp
                    </a>
                  </Button>
                )}

                <Button variant="outline" className="mb-4 h-[46px] w-full" onClick={() => setShowLeadForm(true)}>
                  <MessageCircle className="size-4" />Enviar mensagem para a loja
                </Button>

                <div className="pt-4 border-t border-border">
                  <h4 className="font-semibold text-foreground mb-3">Anunciante</h4>

                  {vehicle.company_name && (
                    <p className="font-medium text-foreground mb-3">{vehicle.company_name}</p>
                  )}

                  {vehicle.company_city && vehicle.company_state && (
                    <div className="flex items-start gap-2 text-muted-foreground mb-2">
                      <MapPin className="w-5 h-5 shrink-0 mt-0.5" />
                      <p>{vehicle.company_city} - {vehicle.company_state}</p>
                    </div>
                  )}

                  {vehicle.company_phone && (
                    <div className="flex items-start gap-2 text-muted-foreground">
                      <Phone className="w-5 h-5 shrink-0 mt-0.5" />
                      <p>{formatPhone(vehicle.company_phone)}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 p-3 backdrop-blur md:hidden">
        {vehicle.company_phone ? <Button asChild className="h-12 w-full bg-[#128C4A] text-white hover:bg-[#0F7A40]"><a href={`https://wa.me/55${vehicle.company_phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"><MessageCircle className="size-5" />Chamar no WhatsApp</a></Button> : <Button className="h-12 w-full" onClick={() => setShowLeadForm(true)}><MessageCircle className="size-5" />Enviar mensagem</Button>}
      </div>
      <div className="h-16 md:hidden" aria-hidden="true" />

      {vehicle && (
        <LeadForm
          open={showLeadForm}
          vehicleId={vehicle.id}
          companyId={vehicle.company_id || ''}
          vehicleName={`${vehicle.brand} ${vehicle.model} ${vehicle.year}`}
          onClose={() => setShowLeadForm(false)}
        />
      )}
    </div>
  );
}


