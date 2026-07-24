import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router';
import { supabase, Vehicle } from '../../lib/supabase';
import { ArrowLeft, Car, Calendar, Gauge, Fuel, Settings as SettingsIcon, MapPin, Phone, MessageCircle } from 'lucide-react';
import { LeadForm } from '../components/LeadForm';
import { ThemeToggle } from '../components/ThemeToggle';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';

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
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [selectedImage, setSelectedImage] = useState(0);

  useEffect(() => {
    if (id) {
      loadVehicle();
    }
  }, [id]);

  const loadVehicle = async () => {
    try {
      let { data, error } = await supabase
        .from('public_vehicles')
        .select('*')
        .eq('id', id)
        .single();

      if (error && error.code === '42P01') {
        const result = await supabase
          .from('vehicles')
          .select('*')
          .eq('id', id)
          .single();

        if (result.error) throw result.error;

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

      setVehicle(data);
    } catch (error) {
      console.error('Error loading vehicle:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!vehicle) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Car className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-foreground mb-2">Veículo não encontrado</h2>
          <Link to="/" className="text-primary hover:underline">
            Voltar para a página inicial
          </Link>
        </div>
      </div>
    );
  }

  const images = vehicle.images && vehicle.images.length > 0 ? vehicle.images : [];

  const specs = [
    vehicle.year && { icon: Calendar, label: 'Ano', value: String(vehicle.year) },
    vehicle.mileage && { icon: Gauge, label: 'KM', value: vehicle.mileage.toLocaleString('pt-BR') },
    vehicle.fuel_type && { icon: Fuel, label: 'Combustível', value: vehicle.fuel_type, capitalize: true },
    vehicle.transmission && { icon: SettingsIcon, label: 'Câmbio', value: vehicle.transmission, capitalize: true }
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
            <Card className="overflow-hidden py-0">
              {images.length > 0 ? (
                <>
                  <div className="relative h-96 bg-muted">
                    <img
                      src={images[selectedImage]}
                      alt={`${vehicle.brand} ${vehicle.model}`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  {images.length > 1 && (
                    <div className="p-4 grid grid-cols-6 gap-2">
                      {images.map((img, index) => (
                        <button
                          key={index}
                          onClick={() => setSelectedImage(index)}
                          className={`aspect-video rounded-lg overflow-hidden border-2 transition-colors ${
                            selectedImage === index ? 'border-primary' : 'border-border'
                          }`}
                        >
                          <img src={img} alt={`Foto ${index + 1}`} className="w-full h-full object-cover" />
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
              <CardContent className="p-6">
                <div className="mb-4">
                  <h1 className="text-3xl font-bold text-foreground mb-2">
                    {vehicle.brand} {vehicle.model}
                  </h1>
                  <p className="text-xl text-muted-foreground">{vehicle.version}</p>
                </div>

                <p className="text-4xl font-bold text-primary mb-6">{brl(vehicle.sale_price)}</p>

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
            <Card className="sticky top-24">
              <CardContent className="p-6">
                <h3 className="font-bold text-foreground mb-4">Interessado?</h3>

                <Button className="w-full mb-3" size="lg" onClick={() => setShowLeadForm(true)}>
                  <MessageCircle className="w-5 h-5" />
                  Enviar Mensagem
                </Button>

                {vehicle.company_phone && (
                  <Button asChild variant="secondary" size="lg" className="w-full mb-4">
                    <a
                      href={`https://wa.me/55${vehicle.company_phone.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Phone className="w-5 h-5" />
                      WhatsApp
                    </a>
                  </Button>
                )}

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
                      <p>{vehicle.company_phone}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {showLeadForm && vehicle && (
        <LeadForm
          vehicleId={vehicle.id}
          companyId={vehicle.company_id || ''}
          vehicleName={`${vehicle.brand} ${vehicle.model} ${vehicle.year}`}
          onClose={() => setShowLeadForm(false)}
        />
      )}
    </div>
  );
}


